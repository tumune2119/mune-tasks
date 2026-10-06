import { nanoid } from "nanoid";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { projects, sections, tasks } from "./schema";
import type * as schema from "./schema";
import type { PlanSection, PlanSubtask, PlanTask } from "../plan-schema";
import type { AttachmentMeta } from "../types";

type Tx = Pick<BetterSQLite3Database<typeof schema>, "insert">;

export interface NewProjectInput {
  name: string;
  summary: string;
  prompt: string;
  detailLevel: number;
  itemCount: string;
  extraInstructions: string;
  attachments: AttachmentMeta[];
  sections: PlanSection[];
}

export function insertProject(tx: Tx, input: NewProjectInput, now = Date.now()): string {
  const id = nanoid(12);
  tx.insert(projects)
    .values({
      id,
      name: input.name,
      summary: input.summary,
      prompt: input.prompt,
      detailLevel: input.detailLevel,
      itemCount: input.itemCount,
      extraInstructions: input.extraInstructions,
      attachments: JSON.stringify(input.attachments),
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .run();
  input.sections.forEach((s, i) => insertSection(tx, id, s, i, now));
  return id;
}

export function insertSection(tx: Tx, projectId: string, s: PlanSection, position: number, now = Date.now()): string {
  const sectionId = nanoid(12);
  tx.insert(sections).values({ id: sectionId, projectId, title: s.title, position }).run();
  s.tasks.forEach((t, i) => insertTask(tx, projectId, sectionId, null, t, i, now));
  return sectionId;
}

export function insertTask(
  tx: Tx,
  projectId: string,
  sectionId: string,
  parentId: string | null,
  t: PlanTask | PlanSubtask,
  position: number,
  now = Date.now(),
): string {
  const id = nanoid(12);
  tx.insert(tasks)
    .values({
      id,
      projectId,
      sectionId,
      parentId,
      title: t.title,
      notes: t.notes ?? null,
      priority: t.priority ?? null,
      done: false,
      position,
      createdAt: now,
    })
    .run();
  const subs = "subtasks" in t ? t.subtasks : null;
  subs?.forEach((st, i) => insertTask(tx, projectId, sectionId, id, st, i, now));
  return id;
}
