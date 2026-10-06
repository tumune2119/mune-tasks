import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type DB } from "./db";
import { projects, sections, tasks } from "./db/schema";
import { insertProject, insertSection, insertTask, type NewProjectInput } from "./db/write-plan";
import type { ProjectAction } from "./project-actions";
import { projectProgress } from "./progress";
import type {
  AttachmentMeta,
  DashboardStats,
  ProjectMeta,
  ProjectSummary,
  ProjectTree,
  SectionNode,
  TaskNode,
} from "./types";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export class NotFoundError extends Error {}

// A "leaf" is a subtask, or a top-level task that has no subtasks.
const LEAF = sql`(t.parent_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM tasks s WHERE s.parent_id = t.id))`;

export function listProjectSummaries(): ProjectSummary[] {
  const rows = getDb().all<{
    id: string;
    name: string;
    summary: string;
    status: "active" | "archived";
    created_at: number;
    updated_at: number;
    total: number;
    done: number;
  }>(sql`
    SELECT p.id, p.name, p.summary, p.status, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND ${LEAF}) AS total,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.done = 1 AND ${LEAF}) AS done
    FROM projects p
    ORDER BY p.updated_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    summary: r.summary,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    total: r.total,
    done: r.done,
    percent: r.total === 0 ? 0 : Math.round((r.done / r.total) * 100),
  }));
}

function startOfWeek(now = new Date()): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function getDashboardStats(summaries = listProjectSummaries()): DashboardStats {
  const weekStart = startOfWeek();
  const row = getDb().get<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM tasks t
    WHERE t.done = 1 AND t.done_at >= ${weekStart} AND ${LEAF}
  `);
  const active = summaries.filter((s) => s.status === "active");
  const totalItems = active.reduce((a, s) => a + s.total, 0);
  const doneItems = active.reduce((a, s) => a + s.done, 0);
  return {
    totalProjects: summaries.length,
    activeProjects: active.filter((s) => s.percent < 100 || s.total === 0).length,
    completedProjects: active.filter((s) => s.total > 0 && s.percent === 100).length,
    doneThisWeek: row?.n ?? 0,
    overallPercent: totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100),
    totalItems,
    doneItems,
  };
}

function toMeta(p: typeof projects.$inferSelect): ProjectMeta {
  let attachments: AttachmentMeta[] = [];
  try {
    attachments = JSON.parse(p.attachments);
  } catch {}
  return {
    id: p.id,
    name: p.name,
    summary: p.summary,
    prompt: p.prompt,
    detailLevel: p.detailLevel,
    itemCount: p.itemCount,
    extraInstructions: p.extraInstructions,
    attachments,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    completedAt: p.completedAt,
  };
}

function loadTree(db: DB | Tx, id: string): ProjectTree | null {
  const p = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!p) return null;
  const secRows = db.select().from(sections).where(eq(sections.projectId, id)).orderBy(asc(sections.position)).all();
  const taskRows = db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.position)).all();

  const byId = new Map<string, TaskNode>();
  for (const t of taskRows) {
    byId.set(t.id, {
      id: t.id,
      sectionId: t.sectionId,
      parentId: t.parentId,
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      done: t.done,
      doneAt: t.doneAt,
      position: t.position,
      subtasks: [],
    });
  }
  const sectionMap = new Map<string, SectionNode>(
    secRows.map((s) => [s.id, { id: s.id, title: s.title, position: s.position, tasks: [] }]),
  );
  for (const t of taskRows) {
    const node = byId.get(t.id)!;
    if (t.parentId) byId.get(t.parentId)?.subtasks.push(node);
    else sectionMap.get(t.sectionId)?.tasks.push(node);
  }
  return { ...toMeta(p), sections: [...sectionMap.values()] };
}

export function getProjectTree(id: string): ProjectTree | null {
  return loadTree(getDb(), id);
}

export function createProject(input: NewProjectInput): string {
  const db = getDb();
  return db.transaction((tx) => insertProject(tx, input));
}

export function deleteProject(id: string) {
  const res = getDb().delete(projects).where(eq(projects.id, id)).run();
  if (res.changes === 0) throw new NotFoundError("Project not found");
}

// ---------------------------------------------------------------------------
// Edits

function nextPosition(tx: Tx, sectionId: string, parentId: string | null): number {
  const row = tx
    .select({ max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(and(eq(tasks.sectionId, sectionId), parentId ? eq(tasks.parentId, parentId) : isNull(tasks.parentId)))
    .get();
  return (row?.max ?? -1) + 1;
}

/** A parent with subtasks is done exactly when all of its subtasks are done. */
function syncParent(tx: Tx, parentId: string, now: number) {
  const subs = tx.select({ done: tasks.done }).from(tasks).where(eq(tasks.parentId, parentId)).all();
  if (subs.length === 0) return;
  const allDone = subs.every((s) => s.done);
  const parent = tx.select().from(tasks).where(eq(tasks.id, parentId)).get();
  if (!parent || parent.done === allDone) return;
  tx.update(tasks)
    .set({ done: allDone, doneAt: allDone ? now : null })
    .where(eq(tasks.id, parentId))
    .run();
}

function getTaskIn(tx: Tx, projectId: string, taskId: string) {
  const t = tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
    .get();
  if (!t) throw new NotFoundError("Task not found");
  return t;
}

function getSectionIn(tx: Tx, projectId: string, sectionId: string) {
  const s = tx
    .select()
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.projectId, projectId)))
    .get();
  if (!s) throw new NotFoundError("Section not found");
  return s;
}

function applyInTx(tx: Tx, projectId: string, action: ProjectAction, now: number) {
  switch (action.type) {
    case "renameProject":
      tx.update(projects).set({ name: action.name }).where(eq(projects.id, projectId)).run();
      return;
    case "setStatus":
      tx.update(projects).set({ status: action.status }).where(eq(projects.id, projectId)).run();
      return;

    case "addSection": {
      const row = tx
        .select({ max: sql<number | null>`MAX(${sections.position})` })
        .from(sections)
        .where(eq(sections.projectId, projectId))
        .get();
      insertSection(tx, projectId, { title: action.title, tasks: [] }, (row?.max ?? -1) + 1, now);
      return;
    }
    case "updateSection":
      getSectionIn(tx, projectId, action.sectionId);
      tx.update(sections).set({ title: action.title }).where(eq(sections.id, action.sectionId)).run();
      return;
    case "deleteSection":
      getSectionIn(tx, projectId, action.sectionId);
      tx.delete(sections).where(eq(sections.id, action.sectionId)).run();
      return;
    case "reorderSections":
      action.ids.forEach((sid, i) =>
        tx
          .update(sections)
          .set({ position: i })
          .where(and(eq(sections.id, sid), eq(sections.projectId, projectId)))
          .run(),
      );
      return;
    case "replaceSection": {
      getSectionIn(tx, projectId, action.sectionId);
      tx.update(sections).set({ title: action.section.title }).where(eq(sections.id, action.sectionId)).run();
      tx.delete(tasks).where(eq(tasks.sectionId, action.sectionId)).run();
      action.section.tasks.forEach((t, i) => insertTask(tx, projectId, action.sectionId, null, t, i, now));
      return;
    }

    case "addTask": {
      getSectionIn(tx, projectId, action.sectionId);
      if (action.parentId) {
        const parent = getTaskIn(tx, projectId, action.parentId);
        if (parent.parentId) throw new Error("Subtasks cannot have their own subtasks.");
      }
      const pos = nextPosition(tx, action.sectionId, action.parentId);
      insertTask(tx, projectId, action.sectionId, action.parentId, { title: action.title }, pos, now);
      if (action.parentId) syncParent(tx, action.parentId, now);
      return;
    }
    case "updateTask": {
      getTaskIn(tx, projectId, action.taskId);
      const patch: Partial<typeof tasks.$inferInsert> = {};
      if (action.title !== undefined) patch.title = action.title;
      if (action.notes !== undefined) patch.notes = action.notes?.trim() ? action.notes : null;
      if (action.priority !== undefined) patch.priority = action.priority;
      if (Object.keys(patch).length) tx.update(tasks).set(patch).where(eq(tasks.id, action.taskId)).run();
      return;
    }
    case "toggleTask": {
      const t = getTaskIn(tx, projectId, action.taskId);
      const doneAt = action.done ? now : null;
      tx.update(tasks).set({ done: action.done, doneAt }).where(eq(tasks.id, t.id)).run();
      if (t.parentId) {
        syncParent(tx, t.parentId, now);
      } else {
        // Ticking a parent ticks (or unticks) all its subtasks; keep existing timestamps.
        tx.update(tasks)
          .set({ done: action.done, doneAt: action.done ? sql`COALESCE(${tasks.doneAt}, ${now})` : null })
          .where(and(eq(tasks.parentId, t.id), eq(tasks.done, !action.done)))
          .run();
      }
      return;
    }
    case "deleteTask": {
      const t = getTaskIn(tx, projectId, action.taskId);
      tx.delete(tasks).where(eq(tasks.id, t.id)).run();
      if (t.parentId) syncParent(tx, t.parentId, now);
      return;
    }
    case "reorderTasks": {
      const owned = tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, projectId),
            eq(tasks.sectionId, action.sectionId),
            action.parentId ? eq(tasks.parentId, action.parentId) : isNull(tasks.parentId),
            inArray(tasks.id, action.ids),
          ),
        )
        .all();
      const ok = new Set(owned.map((o) => o.id));
      action.ids
        .filter((tid) => ok.has(tid))
        .forEach((tid, i) => tx.update(tasks).set({ position: i }).where(eq(tasks.id, tid)).run());
      return;
    }
    case "replaceSubtasks": {
      const t = getTaskIn(tx, projectId, action.taskId);
      if (t.parentId) throw new Error("Only top-level tasks can be expanded.");
      tx.delete(tasks).where(eq(tasks.parentId, t.id)).run();
      action.subtasks.forEach((s, i) => insertTask(tx, projectId, t.sectionId, t.id, s, i, now));
      syncParent(tx, t.id, now);
      return;
    }
  }
}

export function applyProjectAction(projectId: string, action: ProjectAction): ProjectTree {
  const db = getDb();
  return db.transaction((tx) => {
    const exists = tx.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get();
    if (!exists) throw new NotFoundError("Project not found");
    const now = Date.now();
    applyInTx(tx, projectId, action, now);

    const tree = loadTree(tx, projectId)!;
    const progress = projectProgress(tree.sections);
    const complete = progress.total > 0 && progress.done === progress.total;
    const completedAt = complete ? (tree.completedAt ?? now) : null;
    tx.update(projects).set({ updatedAt: now, completedAt }).where(eq(projects.id, projectId)).run();
    return { ...tree, updatedAt: now, completedAt };
  });
}

// ---------------------------------------------------------------------------
// Backup

export interface BackupFile {
  app: "mune-tasks";
  version: 1;
  exportedAt: string;
  projects: ProjectTree[];
}

export function exportAll(): BackupFile {
  const db = getDb();
  const ids = db.select({ id: projects.id }).from(projects).orderBy(asc(projects.createdAt)).all();
  return {
    app: "mune-tasks",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: ids.map((r) => loadTree(db, r.id)!).filter(Boolean),
  };
}

/** Restores projects exactly (ids, done state, timestamps). Existing projects with the same id are replaced. */
export function importBackup(backup: BackupFile, mode: "merge" | "replace"): number {
  const db = getDb();
  return db.transaction((tx) => {
    if (mode === "replace") tx.delete(projects).run();
    for (const p of backup.projects) {
      tx.delete(projects).where(eq(projects.id, p.id)).run();
      tx.insert(projects)
        .values({
          id: p.id,
          name: p.name,
          summary: p.summary ?? "",
          prompt: p.prompt ?? "",
          detailLevel: p.detailLevel ?? 3,
          itemCount: p.itemCount ?? "",
          extraInstructions: p.extraInstructions ?? "",
          attachments: JSON.stringify(p.attachments ?? []),
          status: p.status === "archived" ? "archived" : "active",
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          completedAt: p.completedAt ?? null,
        })
        .run();
      p.sections.forEach((s, si) => {
        tx.insert(sections).values({ id: s.id, projectId: p.id, title: s.title, position: si }).run();
        const writeTask = (t: TaskNode, parentId: string | null, pos: number) => {
          tx.insert(tasks)
            .values({
              id: t.id,
              projectId: p.id,
              sectionId: s.id,
              parentId,
              title: t.title,
              notes: t.notes ?? null,
              priority: t.priority ?? null,
              done: !!t.done,
              doneAt: t.doneAt ?? null,
              position: pos,
              createdAt: p.createdAt,
            })
            .run();
          (t.subtasks ?? []).forEach((st, i) => writeTask(st, t.id, i));
        };
        s.tasks.forEach((t, ti) => writeTask(t, null, ti));
      });
    }
    return backup.projects.length;
  });
}
