"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock, ListChecks, Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AnimatedCheckbox } from "@/components/animated-checkbox";
import { PriorityBadge } from "@/components/priority-badge";
import { formatRange, dateState } from "@/components/date-range";
import { PROJECT_COLORS, type CalendarTask } from "@/lib/calendar-types";
import type { CalendarMutate } from "./calendar-view";

/** Details for a calendar task: tick it, change its dates, jump to the project. */
export function TaskPopover({
  task,
  mutate,
  children,
}: {
  task: CalendarTask;
  mutate: CalendarMutate;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl p-4" align="start">
        {open && <Details task={task} mutate={mutate} />}
      </PopoverContent>
    </Popover>
  );
}

function Details({ task, mutate }: { task: CalendarTask; mutate: CalendarMutate }) {
  const [start, setStart] = useState(task.start);
  const [due, setDue] = useState(task.due);
  const state = dateState(task.start, task.due, task.done);
  const dirty = start !== task.start || due !== task.due;
  const input = "h-8 w-full rounded-lg border border-input bg-background/60 px-2 text-sm [color-scheme:dark]";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">
          <AnimatedCheckbox
            checked={task.done}
            onChange={(done) =>
              mutate(task, { type: "toggleTask", taskId: task.id, done }, { done, subDone: done ? task.subTotal : 0 })
            }
            label={`Mark “${task.title}” ${task.done ? "not done" : "done"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={task.done ? "text-muted-foreground line-through" : "font-medium"}>{task.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[task.color] }} />
            <span className="truncate">
              {task.projectName} · {task.section}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={state === "overdue" ? "font-medium text-red-300" : ""}>
          {state === "overdue" ? "Overdue · " : ""}
          {formatRange(task.start, task.due)}
        </span>
        {task.estimateHours != null && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> ~{Math.round(task.estimateHours * 10) / 10} h
          </span>
        )}
        {task.subTotal > 0 && (
          <span className="flex items-center gap-1">
            <ListChecks className="size-3" /> {task.subDone}/{task.subTotal}
          </span>
        )}
        {task.fileCount > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="size-3" /> {task.fileCount}
          </span>
        )}
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Start
          <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className={input} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Due
          <input type="date" value={due} min={start} onChange={(e) => e.target.value && setDue(e.target.value)} className={input} />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href={`/projects/${task.projectId}`}>
            Open project <ArrowUpRight />
          </Link>
        </Button>
        <Button
          size="sm"
          className="rounded-lg"
          disabled={!dirty}
          onClick={() => {
            const [s, d] = due < start ? [due, start] : [start, due];
            mutate(task, { type: "setTaskDates", taskId: task.id, startDate: s, dueDate: d }, { start: s, due: d });
          }}
        >
          Save dates
        </Button>
      </div>
    </div>
  );
}
