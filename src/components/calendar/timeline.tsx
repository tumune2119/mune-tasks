"use client";

import { Fragment } from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, diffDays, isWeekend, parseISODate } from "@/lib/schedule";
import { PROJECT_COLORS, type CalendarTask } from "@/lib/calendar-types";
import { dateState, formatRange } from "@/components/date-range";
import { cn } from "@/lib/utils";
import { TaskPopover } from "./task-popover";
import type { CalendarMutate } from "./calendar-view";

const DAYS = 35;

/** Five weeks of scheduled tasks as bars, grouped by project, with a line for today. */
export function Timeline({
  start,
  tasks,
  today,
  mutate,
}: {
  /** First day shown (a Monday). */
  start: string;
  tasks: CalendarTask[];
  today: string;
  mutate: CalendarMutate;
}) {
  const end = addDays(start, DAYS - 1);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const inRange = tasks.filter((t) => t.due >= start && t.start <= end);

  const groups = new Map<string, { name: string; projectId: string; color: string; tasks: CalendarTask[] }>();
  for (const t of inRange) {
    const g = groups.get(t.projectId) ?? { name: t.projectName, projectId: t.projectId, color: PROJECT_COLORS[t.color], tasks: [] };
    g.tasks.push(t);
    groups.set(t.projectId, g);
  }

  const todayIndex = diffDays(start, today);
  const cols = { gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` };

  return (
    <div className="surface overflow-hidden rounded-2xl" data-testid="timeline">
      <div className="grid grid-cols-[16rem_minmax(0,1fr)]">
        {/* Day header */}
        <div className="border-r border-b border-border px-4 py-2 text-xs text-muted-foreground">Task</div>
        <div className="grid border-b border-border" style={cols}>
          {days.map((d, i) => {
            const date = parseISODate(d);
            const showMonth = i === 0 || date.getDate() === 1;
            return (
              <div
                key={d}
                className={cn(
                  "relative py-1 text-center text-[0.65rem] tabular-nums",
                  isWeekend(d) ? "text-muted-foreground/50" : "text-muted-foreground",
                  d === today && "font-semibold text-[#93c5fd]",
                )}
              >
                {showMonth && (
                  <span className="absolute -top-0.5 left-1 text-[0.6rem] text-foreground/80">
                    {date.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                )}
                <span className="block pt-2.5">{date.getDate()}</span>
              </div>
            );
          })}
        </div>

        {inRange.length === 0 && (
          <div className="col-span-2 px-6 py-14 text-center text-sm text-muted-foreground">
            Nothing scheduled in these five weeks. Use the arrows to move through time.
          </div>
        )}

        {[...groups.values()].map((g) => (
          <Fragment key={g.projectId}>
            <div className="border-r border-border bg-background/30 px-4 pt-3 pb-1.5">
              <Link href={`/projects/${g.projectId}`} className="flex items-center gap-2 text-xs font-semibold hover:text-[#93c5fd]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                <span className="truncate">{g.name}</span>
              </Link>
            </div>
            <BackgroundRow days={days} today={today} className="bg-background/30" />
            {g.tasks.map((t) => {
              const from = Math.max(0, diffDays(start, t.start));
              const to = Math.min(DAYS - 1, diffDays(start, t.due));
              const state = dateState(t.start, t.due, t.done, today);
              return (
                <Fragment key={t.id}>
                  <div className="truncate border-r border-border px-4 py-1.5 pl-8 text-xs text-foreground/85" title={t.title}>
                    {t.title}
                  </div>
                  <div className="relative">
                    <BackgroundRow days={days} today={today} className="absolute inset-0" />
                    <div className="relative grid h-full items-center py-1" style={cols}>
                      <TaskPopover task={t} mutate={mutate}>
                        <button
                          type="button"
                          data-testid="timeline-bar"
                          title={`${t.title} · ${formatRange(t.start, t.due)}`}
                          style={{
                            gridColumn: `${from + 1} / ${to + 2}`,
                            background: `color-mix(in oklab, ${g.color} 30%, transparent)`,
                            borderLeft: `3px solid ${g.color}`,
                          }}
                          className={cn(
                            "flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-left text-[0.68rem] text-foreground transition-[filter] hover:brightness-125",
                            state === "overdue" && "ring-1 ring-red-400/70",
                            t.done && "opacity-50",
                          )}
                        >
                          {diffDays(start, t.start) < 0 && <ChevronLeft className="size-3 shrink-0" aria-label="Starts earlier" />}
                          {state === "overdue" && <AlertCircle className="size-3 shrink-0 text-red-300" aria-label="Overdue" />}
                          <span className={cn("truncate", t.done && "line-through")}>{t.title}</span>
                          {diffDays(start, t.due) > DAYS - 1 && <ChevronRight className="ml-auto size-3 shrink-0" aria-label="Continues" />}
                        </button>
                      </TaskPopover>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
      {todayIndex >= 0 && todayIndex < DAYS && (
        <p className="border-t border-border px-4 py-2 text-[0.7rem] text-muted-foreground">
          <span className="mr-1.5 inline-block h-3 w-0.5 translate-y-0.5 bg-primary" /> Today
        </p>
      )}
    </div>
  );
}

/** Weekend shading and the today line behind a row of bars. */
function BackgroundRow({ days, today, className }: { days: string[]; today: string; className?: string }) {
  return (
    <div className={cn("grid", className)} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden>
      {days.map((d) => (
        <div key={d} className={cn("relative", isWeekend(d) && "bg-background/35")}>
          {d === today && <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary/80" />}
        </div>
      ))}
    </div>
  );
}
