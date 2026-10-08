import type { ProjectTree, ScheduleOptions, TaskNode } from "./types";

// ---------------------------------------------------------------------------
// Local calendar dates as "YYYY-MM-DD" strings (no time zones involved).

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function isWeekend(s: string): boolean {
  const day = parseISODate(s).getDay();
  return day === 0 || day === 6;
}

function nextWorkday(s: string, weekends: boolean, inclusive = false): string {
  let d = inclusive ? s : addDays(s, 1);
  while (!weekends && isWeekend(d)) d = addDays(d, 1);
  return d;
}

function countWorkdays(start: string, end: string, weekends: boolean): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (weekends || !isWeekend(d)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Durations

// Rough fallbacks when Claude gave no estimate, by detail level (1 = milestones … 5 = 5–15 min steps).
const TASK_HOURS: Record<number, number> = { 1: 16, 2: 8, 3: 2.5, 4: 1.5, 5: 1 };
const SUBTASK_HOURS: Record<number, number> = { 1: 2, 2: 1.5, 3: 0.75, 4: 0.4, 5: 0.2 };

/** Hours of work in a top-level task: its own estimate, else its subtasks' estimates, else a detail-level guess. */
export function taskHours(t: Pick<TaskNode, "estimateHours" | "subtasks">, detailLevel: number): number {
  if (t.estimateHours && t.estimateHours > 0) return t.estimateHours;
  if (t.subtasks.length) {
    const est = t.subtasks.map((s) => s.estimateHours ?? 0);
    if (est.every((h) => h > 0)) return est.reduce((a, h) => a + h, 0);
    return t.subtasks.length * (SUBTASK_HOURS[detailLevel] ?? 0.5);
  }
  return TASK_HOURS[detailLevel] ?? 2;
}

/** True when every unfinished top-level task already has an estimate from Claude. */
export function hasEstimates(p: ProjectTree): boolean {
  return p.sections.every((s) =>
    s.tasks.every(
      (t) => t.done || (t.estimateHours ?? 0) > 0 || (t.subtasks.length > 0 && t.subtasks.every((st) => (st.estimateHours ?? 0) > 0)),
    ),
  );
}

// ---------------------------------------------------------------------------
// Scheduling

export interface ScheduledDates {
  start: string;
  due: string;
}

/**
 * Lays the unfinished top-level tasks out in plan order across working days.
 * With an end date, work is spread evenly up to it; otherwise each day holds `hoursPerDay`.
 * Finished tasks are left out (they keep whatever dates they had).
 */
export function scheduleProject(
  p: ProjectTree,
  opts: ScheduleOptions,
): { dates: Map<string, ScheduledDates>; totalHours: number; hoursPerDay: number; lastDay: string | null } {
  const units = p.sections.flatMap((s) => s.tasks.filter((t) => !t.done)).map((t) => ({
    id: t.id,
    hours: Math.max(0.25, taskHours(t, p.detailLevel)),
  }));
  const totalHours = units.reduce((a, u) => a + u.hours, 0);
  const first = nextWorkday(opts.start, opts.weekends, true);

  let capacity = Math.max(0.25, opts.hoursPerDay);
  if (opts.end && opts.end >= first) {
    capacity = Math.max(0.25, totalHours / Math.max(1, countWorkdays(first, opts.end, opts.weekends)));
  }

  const dates = new Map<string, ScheduledDates>();
  const EPS = 1e-6;
  let day = first;
  let used = 0;
  for (const u of units) {
    if (used >= capacity - EPS) {
      day = nextWorkday(day, opts.weekends);
      used = 0;
    }
    const start = day;
    let remaining = u.hours;
    for (;;) {
      const free = capacity - used;
      if (remaining <= free + EPS) {
        used += remaining;
        break;
      }
      remaining -= free;
      day = nextWorkday(day, opts.weekends);
      used = 0;
    }
    dates.set(u.id, { start, due: day });
  }
  return { dates, totalHours, hoursPerDay: capacity, lastDay: units.length ? day : null };
}
