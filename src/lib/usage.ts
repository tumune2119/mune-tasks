import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { aiUsage } from "./db/schema";
import type { TokenUsage } from "./ai/types";

export type UsageKind = "plan" | "section" | "expand" | "estimate" | "test";

export interface UsageRecordInput {
  kind: UsageKind;
  provider: "api" | "cli";
  model: string;
  projectId?: string | null;
  projectName?: string | null;
  usage: TokenUsage;
  durationMs: number;
  attempts: number;
  status: "ok" | "error";
  error?: string | null;
}

export function recordUsage(r: UsageRecordInput): string {
  const id = nanoid(12);
  getDb()
    .insert(aiUsage)
    .values({
      id,
      createdAt: Date.now(),
      kind: r.kind,
      provider: r.provider,
      model: r.model,
      projectId: r.projectId ?? null,
      projectName: r.projectName ?? null,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
      cacheReadTokens: r.usage.cacheReadTokens,
      cacheWriteTokens: r.usage.cacheWriteTokens,
      costUsd: r.usage.costUsd,
      durationMs: r.durationMs,
      attempts: r.attempts,
      status: r.status,
      error: r.error ?? null,
    })
    .run();
  return id;
}

/** A plan is generated before its project exists; attach the call once the project is saved. */
export function linkUsageToProject(usageId: string, projectId: string, projectName: string) {
  getDb()
    .update(aiUsage)
    .set({ projectId, projectName })
    .where(and(eq(aiUsage.id, usageId), isNull(aiUsage.projectId)))
    .run();
}

export interface UsageTotals {
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
}

const TOTALS = {
  calls: sql<number>`COUNT(*)`,
  failed: sql<number>`COALESCE(SUM(CASE WHEN ${aiUsage.status} = 'error' THEN 1 ELSE 0 END), 0)`,
  inputTokens: sql<number>`COALESCE(SUM(${aiUsage.inputTokens}), 0)`,
  outputTokens: sql<number>`COALESCE(SUM(${aiUsage.outputTokens}), 0)`,
  cacheReadTokens: sql<number>`COALESCE(SUM(${aiUsage.cacheReadTokens}), 0)`,
  cacheWriteTokens: sql<number>`COALESCE(SUM(${aiUsage.cacheWriteTokens}), 0)`,
  costUsd: sql<number>`COALESCE(SUM(${aiUsage.costUsd}), 0)`,
  durationMs: sql<number>`COALESCE(SUM(${aiUsage.durationMs}), 0)`,
};

export type UsageRow = typeof aiUsage.$inferSelect;

export interface UsageReport {
  sinceDays: number;
  totals: UsageTotals;
  allTime: UsageTotals;
  /** One entry per local calendar day in the range, oldest first (empty days included). */
  daily: { day: string; calls: number; tokens: number; costUsd: number }[];
  byKind: ({ kind: UsageKind } & UsageTotals)[];
  byModel: ({ model: string; provider: "api" | "cli" } & UsageTotals)[];
  byProject: ({ projectId: string | null; projectName: string | null } & UsageTotals)[];
  recent: UsageRow[];
}

function dayKey(ts: number) {
  return new Date(ts).toLocaleDateString("sv-SE"); // YYYY-MM-DD, local time
}

export function getUsageReport(sinceDays = 30): UsageReport {
  const db = getDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (sinceDays - 1));
  const since = start.getTime();
  const inRange = gte(aiUsage.createdAt, since);

  const totals = db.select(TOTALS).from(aiUsage).where(inRange).get()!;
  const allTime = db.select(TOTALS).from(aiUsage).get()!;

  // Bucket by local day in JS (SQLite has no notion of the user's timezone).
  const rows = db
    .select({
      createdAt: aiUsage.createdAt,
      tokens: sql<number>`${aiUsage.inputTokens} + ${aiUsage.outputTokens} + ${aiUsage.cacheReadTokens} + ${aiUsage.cacheWriteTokens}`,
      costUsd: aiUsage.costUsd,
    })
    .from(aiUsage)
    .where(inRange)
    .all();
  const days = new Map<string, { day: string; calls: number; tokens: number; costUsd: number }>();
  for (let i = 0; i < sinceDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d.getTime());
    days.set(key, { day: key, calls: 0, tokens: 0, costUsd: 0 });
  }
  for (const r of rows) {
    const b = days.get(dayKey(r.createdAt));
    if (!b) continue;
    b.calls++;
    b.tokens += r.tokens;
    b.costUsd += r.costUsd;
  }

  const byKind = db
    .select({ kind: aiUsage.kind, ...TOTALS })
    .from(aiUsage)
    .where(inRange)
    .groupBy(aiUsage.kind)
    .orderBy(desc(TOTALS.costUsd))
    .all();
  const byModel = db
    .select({ model: aiUsage.model, provider: aiUsage.provider, ...TOTALS })
    .from(aiUsage)
    .where(inRange)
    .groupBy(aiUsage.model, aiUsage.provider)
    .orderBy(desc(TOTALS.costUsd))
    .all();
  const byProject = db
    .select({
      projectId: aiUsage.projectId,
      projectName: sql<string | null>`MAX(${aiUsage.projectName})`,
      ...TOTALS,
    })
    .from(aiUsage)
    .where(inRange)
    .groupBy(aiUsage.projectId)
    .orderBy(desc(TOTALS.costUsd))
    .all();
  const recent = db.select().from(aiUsage).orderBy(desc(aiUsage.createdAt)).limit(50).all();

  return { sinceDays, totals, allTime, daily: [...days.values()], byKind, byModel, byProject, recent };
}

export function getProjectUsage(projectId: string): UsageTotals {
  return getDb().select(TOTALS).from(aiUsage).where(eq(aiUsage.projectId, projectId)).get()!;
}
