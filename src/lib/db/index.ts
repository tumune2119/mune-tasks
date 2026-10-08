import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type DB = BetterSQLite3Database<typeof schema>;

const DEFAULT_PATH = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "mune-tasks.db");
const LEGACY_PATH = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "taskforge.db");

/**
 * The app was called Taskforge before; move its database to the new name once. The WAL is folded
 * into the main file first (journal_mode=DELETE), so only one file has to move. If the old file is
 * still in use by an old server, keep using it for this run and try again next start.
 */
function resolveDbPath(): string {
  const configured = process.env.MUNE_TASKS_DB_PATH || process.env.TASKFORGE_DB_PATH;
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);
  if (fs.existsSync(DEFAULT_PATH) || !fs.existsSync(LEGACY_PATH)) return DEFAULT_PATH;
  try {
    const legacy = new Database(LEGACY_PATH);
    legacy.pragma("wal_checkpoint(TRUNCATE)");
    legacy.pragma("journal_mode = DELETE");
    legacy.close();
    fs.renameSync(LEGACY_PATH, DEFAULT_PATH);
    console.log(`[MUNE TASKS] Moved database ${LEGACY_PATH} -> ${DEFAULT_PATH}`);
    return DEFAULT_PATH;
  } catch (err) {
    console.warn(`[MUNE TASKS] Old database is in use (${(err as Error).message}); using it for now.`);
    return LEGACY_PATH;
  }
}

let dbPath: string | null = null;
/** Resolved on first use (not at import), so builds never touch the database. */
export function getDbPath(): string {
  dbPath ??= resolveDbPath();
  return dbPath;
}

// Idempotent schema; runs on every start so a fresh ./data folder just works.
const DDL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  detail_level INTEGER NOT NULL DEFAULT 3,
  item_count TEXT NOT NULL DEFAULT '',
  extra_instructions TEXT NOT NULL DEFAULT '',
  attachments TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sections_project_idx ON sections(project_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at INTEGER,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_section_idx ON tasks(section_id);
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks(parent_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  project_id TEXT,
  project_name TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at);
CREATE TABLE IF NOT EXISTS task_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS task_files_task_idx ON task_files(task_id);
`;

// Columns added after the first release; ALTER TABLE adds them to existing databases.
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["tasks", "start_date", "TEXT"],
  ["tasks", "due_date", "TEXT"],
  ["tasks", "estimate_hours", "REAL"],
  ["projects", "schedule", "TEXT"],
];

function addMissingColumns(sqlite: Database.Database) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function open(): DB {
  const file = getDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(DDL);
  addMissingColumns(sqlite);
  const db = drizzle(sqlite, { schema });
  seedIfEmpty(db);
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __muneTasksDb?: DB };

export function getDb(): DB {
  if (!g.__muneTasksDb) g.__muneTasksDb = open();
  return g.__muneTasksDb;
}
