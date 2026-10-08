"use client";

import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, diffDays, isWeekend, parseISODate } from "@/lib/schedule";
import { PROJECT_COLORS, type CalendarTask } from "@/lib/calendar-types";
import { dateState } from "@/components/date-range";
import { cn } from "@/lib/utils";
import { TaskPopover } from "./task-popover";
import { weekStart, type CalendarMutate } from "./calendar-view";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

/** A multi-day task shows on each weekday it covers (weekends only when it starts or ends there). */
function coversDay(t: CalendarTask, day: string) {
  return t.start <= day && day <= t.due && (!isWeekend(day) || day === t.start || day === t.due);
}

export function MonthGrid({
  month,
  tasks,
  today,
  mutate,
}: {
  /** YYYY-MM */
  month: string;
  tasks: CalendarTask[];
  today: string;
  mutate: CalendarMutate;
}) {
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const [dropDay, setDropDay] = useState<string | null>(null);

  // Drag a chip to another day: the task keeps its length and moves by the same number of days.
  const onDrop = (day: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropDay(null);
    const [taskId, fromDay] = e.dataTransfer.getData("text/x-mune-task").split("|");
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !fromDay) return;
    const shift = diffDays(fromDay, day);
    if (!shift) return;
    const start = addDays(t.start, shift);
    const due = addDays(t.due, shift);
    mutate(t, { type: "setTaskDates", taskId: t.id, startDate: start, dueDate: due }, { start, due });
  };

  return (
    <div className="surface overflow-hidden rounded-2xl" data-testid="month-grid">
      <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const inMonth = day.startsWith(month);
          const list = tasks.filter((t) => coversDay(t, day));
          const extra = list.length - MAX_CHIPS;
          return (
            <div
              key={day}
              data-day={day}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("text/x-mune-task")) {
                  e.preventDefault();
                  setDropDay(day);
                }
              }}
              onDragLeave={() => setDropDay((d) => (d === day ? null : d))}
              onDrop={(e) => onDrop(day, e)}
              className={cn(
                "min-h-28 border-border p-1.5 transition-colors",
                i % 7 !== 6 && "border-r",
                i < 35 && "border-b",
                !inMonth && "bg-background/40",
                isWeekend(day) && inMonth && "bg-background/20",
                dropDay === day && "bg-primary/10 ring-1 ring-primary/50 ring-inset",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                    day === today
                      ? "bg-primary font-semibold text-white shadow-[0_0_10px_rgb(59_130_246/0.6)]"
                      : inMonth
                        ? "text-foreground/85"
                        : "text-muted-foreground/50",
                  )}
                >
                  {parseISODate(day).getDate()}
                </span>
              </div>
              <ul className="space-y-1">
                {list.slice(0, MAX_CHIPS).map((t) => (
                  <li key={t.id}>
                    <Chip task={t} day={day} today={today} mutate={mutate} />
                  </li>
                ))}
              </ul>
              {extra > 0 && (
                <Popover>
                  <PopoverTrigger className="mt-1 w-full rounded-md px-1.5 py-0.5 text-left text-[0.7rem] text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                    +{extra} more
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-1 rounded-xl p-2" align="start">
                    <p className="px-1 pb-1 text-xs text-muted-foreground">
                      {parseISODate(day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    {list.map((t) => (
                      <Chip key={t.id} task={t} day={day} today={today} mutate={mutate} />
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ task, day, today, mutate }: { task: CalendarTask; day: string; today: string; mutate: CalendarMutate }) {
  const state = dateState(task.start, task.due, task.done, today);
  const color = PROJECT_COLORS[task.color];
  return (
    <TaskPopover task={task} mutate={mutate}>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/x-mune-task", `${task.id}|${day}`);
          e.dataTransfer.effectAllowed = "move";
        }}
        data-testid="calendar-chip"
        data-task-id={task.id}
        title={`${task.title} — ${task.projectName}`}
        className={cn(
          "flex w-full cursor-grab items-center gap-1.5 rounded-md py-0.5 pr-1.5 pl-1 text-left text-[0.72rem] leading-snug transition-colors active:cursor-grabbing",
          "bg-secondary/80 hover:bg-accent",
          state === "overdue" && "ring-1 ring-red-400/60",
          task.done && "opacity-55",
        )}
      >
        <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: color }} />
        {task.done && <Check className="size-3 shrink-0 text-emerald-300" />}
        {state === "overdue" && <AlertCircle className="size-3 shrink-0 text-red-300" aria-label="Overdue" />}
        <span className={cn("truncate", task.done && "line-through")}>{task.title}</span>
      </button>
    </TaskPopover>
  );
}
