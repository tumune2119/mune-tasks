"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { hasEstimates, parseISODate, scheduleProject, todayISO } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ProjectTree, ScheduleOptions } from "@/lib/types";
import { useProject } from "./project-context";

export const dateInputClass =
  "h-9 w-full rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus-visible:border-ring [color-scheme:dark]";

const longDate = (s: string) =>
  parseISODate(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Shared fields for laying a plan out on the calendar (also used on the New Project screen). */
export function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleOptions;
  onChange: (v: ScheduleOptions) => void;
}) {
  const mode = value.end ? "end" : "hours";
  const set = (patch: Partial<ScheduleOptions>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sched-start">Start on</Label>
          <input
            id="sched-start"
            type="date"
            value={value.start}
            onChange={(e) => e.target.value && set({ start: e.target.value })}
            className={dateInputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Pace</Label>
          <div className="grid h-9 grid-cols-2 rounded-xl bg-background/50 p-0.5 text-xs ring-1 ring-border" role="radiogroup">
            {(["hours", "end"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => set({ end: m === "end" ? (value.end ?? value.start) : null })}
                className={cn(
                  "rounded-lg font-medium transition-colors",
                  mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "hours" ? "Hours per day" : "Finish by"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mode === "hours" ? (
        <div className="space-y-1.5">
          <Label htmlFor="sched-hours">Focused hours per working day</Label>
          <input
            id="sched-hours"
            type="number"
            min={0.5}
            max={16}
            step={0.5}
            value={value.hoursPerDay}
            onChange={(e) => set({ hoursPerDay: Math.min(16, Math.max(0.5, Number(e.target.value) || 1)) })}
            className={cn(dateInputClass, "w-32")}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="sched-end">Finish by</Label>
          <input
            id="sched-end"
            type="date"
            min={value.start}
            value={value.end ?? ""}
            onChange={(e) => e.target.value && set({ end: e.target.value })}
            className={cn(dateInputClass, "w-48")}
          />
        </div>
      )}
      <label className="flex items-center gap-2.5 text-sm">
        <Switch checked={value.weekends} onCheckedChange={(weekends) => set({ weekends })} aria-label="Include weekends" />
        Work on weekends too
      </label>
    </div>
  );
}

export function defaultSchedule(saved?: ScheduleOptions | null): ScheduleOptions {
  return saved ? { ...saved, start: saved.start < todayISO() ? todayISO() : saved.start } : { start: todayISO(), end: null, hoursPerDay: 2, weekends: false };
}

/** "12 tasks · about 34 h · finishes Fri, Oct 24 (2 h a day)". */
export function schedulePreview(project: ProjectTree, opts: ScheduleOptions) {
  const { dates, totalHours, hoursPerDay, lastDay } = scheduleProject(project, opts);
  if (!dates.size) return "Every task is already done — nothing to schedule.";
  const pace = `${Math.round(hoursPerDay * 10) / 10} h a day`;
  return `${dates.size} task${dates.size === 1 ? "" : "s"} · about ${Math.round(totalHours)} h of work · finishes ${longDate(lastDay!)} (${pace})`;
}

export function ScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { project } = useProject();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        {/* Remounts on every open, so it starts from the project's last schedule. */}
        {open && <ScheduleForm project={project} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({ project, onDone }: { project: ProjectTree; onDone: () => void }) {
  const { mutate } = useProject();
  const router = useRouter();
  const [opts, setOpts] = useState(() => defaultSchedule(project.schedule));
  const needsEstimates = !hasEstimates(project);
  const [useClaude, setUseClaude] = useState(needsEstimates);
  const [busy, setBusy] = useState<null | "estimating" | "scheduling">(null);
  const scheduled = project.sections.some((s) => s.tasks.some((t) => t.dueDate));
  const preview = useMemo(() => schedulePreview(project, opts), [project, opts]);

  async function apply() {
    try {
      if (useClaude) {
        setBusy("estimating");
        const res = await fetch("/api/ai/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "Claude couldn't estimate the tasks.");
      }
      setBusy("scheduling");
      const next = await mutate({ type: "schedule", options: opts });
      if (next) {
        toast.success("Added to your calendar", {
          action: { label: "Open calendar", onClick: () => router.push(`/calendar?project=${project.id}`) },
        });
        onDone();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-[#60a5fa]" /> Schedule on calendar
        </DialogTitle>
        <DialogDescription>
          Unfinished tasks are laid out in plan order across your working days. You can move any task afterwards.
        </DialogDescription>
      </DialogHeader>

      <ScheduleFields value={opts} onChange={setOpts} />

      <label className="flex items-start gap-2.5 rounded-xl bg-background/40 p-3 text-sm ring-1 ring-border">
        <Switch checked={useClaude} onCheckedChange={setUseClaude} aria-label="Ask Claude to estimate durations" className="mt-0.5" />
        <span>
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5 text-[#60a5fa]" /> Ask Claude to estimate durations first
          </span>
          <span className="block text-xs text-muted-foreground">
            {needsEstimates
              ? "Some tasks have no estimate yet, so without this they use a rough guess based on the detail level."
              : "Every task already has an estimate; turn this on to re-estimate."}
          </span>
        </span>
      </label>

      <p className="rounded-xl bg-primary/8 px-3 py-2 text-sm text-[#bfdbfe] ring-1 ring-primary/20" data-testid="schedule-preview">
        {preview}
        {useClaude && <span className="block text-xs text-muted-foreground">The finish date updates after Claude&apos;s estimates.</span>}
      </p>

      <DialogFooter className="sm:justify-between">
        {scheduled ? (
          <Button
            variant="ghost"
            className="rounded-xl text-muted-foreground"
            disabled={!!busy}
            onClick={async () => {
              if (await mutate({ type: "clearSchedule" })) {
                toast.success("Removed from the calendar");
                onDone();
              }
            }}
          >
            Remove from calendar
          </Button>
        ) : (
          <Button asChild variant="ghost" className="rounded-xl text-muted-foreground">
            <Link href="/calendar">View calendar</Link>
          </Button>
        )}
        <Button className="rounded-xl" onClick={apply} disabled={!!busy}>
          {busy ? <Loader2 className="animate-spin" /> : <CalendarDays />}
          {busy === "estimating" ? "Claude is estimating…" : busy === "scheduling" ? "Scheduling…" : scheduled ? "Reschedule" : "Schedule"}
        </Button>
      </DialogFooter>
    </>
  );
}
