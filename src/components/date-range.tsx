"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseISODate, todayISO } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const fmt = (s: string, withMonth = true) =>
  parseISODate(s).toLocaleDateString(undefined, withMonth ? { month: "short", day: "numeric" } : { day: "numeric" });

/** "Oct 12", "Oct 12 – 14" or "Oct 30 – Nov 2". */
export function formatRange(start: string, due: string): string {
  if (start === due) return fmt(start);
  const sameMonth = start.slice(0, 7) === due.slice(0, 7);
  return `${fmt(start)} – ${fmt(due, !sameMonth)}`;
}

export type DateState = "overdue" | "today" | "upcoming" | "done";

export function dateState(start: string, due: string, done: boolean, today = todayISO()): DateState {
  if (done) return "done";
  if (due < today) return "overdue";
  if (start <= today) return "today";
  return "upcoming";
}

/** Compact date pill for a task row. */
export function DateChip({ start, due, done, className }: { start: string; due: string; done: boolean; className?: string }) {
  const state = dateState(start, due, done);
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[0.68rem] font-medium tabular-nums ring-1 ring-inset",
        state === "overdue" && "bg-red-500/12 text-red-300 ring-red-400/35",
        state === "today" && "bg-primary/15 text-[#93c5fd] ring-primary/40",
        state === "upcoming" && "text-muted-foreground ring-border",
        state === "done" && "text-muted-foreground/70 ring-border line-through",
        className,
      )}
      title={state === "overdue" ? `Overdue — was due ${formatRange(due, due)}` : undefined}
    >
      <CalendarDays className="size-3" />
      {formatRange(start, due)}
    </span>
  );
}

/** Popover with start / due date inputs. Leaving one empty makes it a one-day task. */
export function DateRangeEditor({
  start,
  due,
  onSave,
  children,
  open,
  onOpenChange,
}: {
  start: string | null;
  due: string | null;
  onSave: (start: string | null, due: string | null) => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = open ?? localOpen;
  const setOpen = (o: boolean) => {
    setLocalOpen(o);
    onOpenChange?.(o);
  };
  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      {children ? <PopoverTrigger asChild>{children}</PopoverTrigger> : <PopoverTrigger className="sr-only">Dates</PopoverTrigger>}
      <PopoverContent align="end" className="w-72 rounded-xl" onClick={(e) => e.stopPropagation()}>
        {isOpen && <DateForm start={start} due={due} onDone={() => setOpen(false)} onSave={onSave} />}
      </PopoverContent>
    </Popover>
  );
}

function DateForm({
  start,
  due,
  onSave,
  onDone,
}: {
  start: string | null;
  due: string | null;
  onSave: (start: string | null, due: string | null) => void;
  onDone: () => void;
}) {
  const [s, setS] = useState(start ?? "");
  const [d, setD] = useState(due ?? "");
  const input = "h-8 w-full rounded-lg border border-input bg-background/60 px-2 text-sm [color-scheme:dark]";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(s || null, d || null);
        onDone();
      }}
    >
      <p className="text-sm font-medium">Calendar dates</p>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Start
        <input type="date" value={s} onChange={(e) => setS(e.target.value)} className={input} aria-label="Start date" />
      </label>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Due
        <input type="date" value={d} min={s || undefined} onChange={(e) => setD(e.target.value)} className={input} aria-label="Due date" />
      </label>
      <div className="flex justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onSave(null, null);
            onDone();
          }}
        >
          Remove dates
        </Button>
        <Button type="submit" size="sm" className="rounded-lg">
          Save
        </Button>
      </div>
    </form>
  );
}
