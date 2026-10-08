import { sqliteTable, text, integer, real, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  prompt: text("prompt").notNull().default(""),
  detailLevel: integer("detail_level").notNull().default(3),
  itemCount: text("item_count").notNull().default(""),
  extraInstructions: text("extra_instructions").notNull().default(""),
  attachments: text("attachments").notNull().default("[]"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  completedAt: integer("completed_at"),
  /** JSON ScheduleOptions used for the last auto-schedule, or null if never scheduled. */
  schedule: text("schedule"),
});

export const sections = sqliteTable(
  "sections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [index("sections_project_idx").on(t.projectId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: text("priority", { enum: ["low", "med", "high"] }),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: integer("done_at"),
    position: integer("position").notNull(),
    createdAt: integer("created_at").notNull(),
    // Calendar: local dates as YYYY-MM-DD (top-level tasks only); hours from Claude's estimate.
    startDate: text("start_date"),
    dueDate: text("due_date"),
    estimateHours: real("estimate_hours"),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_section_idx").on(t.sectionId),
    index("tasks_parent_idx").on(t.parentId),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** One row per Claude request made by the app (plan, section, expand, connection test). */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    kind: text("kind", { enum: ["plan", "section", "expand", "estimate", "test"] }).notNull(),
    provider: text("provider", { enum: ["api", "cli"] }).notNull(),
    model: text("model").notNull(),
    // No foreign key: usage history outlives deleted projects (the name is kept for display).
    projectId: text("project_id"),
    projectName: text("project_name"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    attempts: integer("attempts").notNull().default(1),
    status: text("status", { enum: ["ok", "error"] }).notNull(),
    error: text("error"),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt)],
);

/** Files or folders linked to a task. Only the path is stored; the file stays where it is. */
export const taskFiles = sqliteTable(
  "task_files",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    kind: text("kind", { enum: ["file", "folder"] }).notNull().default("file"),
    position: integer("position").notNull(),
    addedAt: integer("added_at").notNull(),
  },
  (t) => [index("task_files_task_idx").on(t.taskId)],
);
