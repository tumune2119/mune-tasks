"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, GanttChart, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, parseISODate, todayISO, toISODate } from "@/lib/schedule";
import { patchProject } from "@/lib/client/api";
import type { ProjectAction } from "@/lib/project-actions";
import { PROJECT_COLORS, type CalendarTask } from "@/lib/calendar-types";
import { cn } from "@/lib/utils";
import { MonthGrid } from "./month-grid";
import { Timeline } from "./timeline";

export type CalendarMutate = (task: CalendarTask, action: ProjectAction, optimistic: Partial<CalendarTask>) => void;

/** Monday of the week containing `s`. */
export function weekStart(s: string): string {
  const day = (parseISODate(s).getDay() + 6) % 7;
  return addDays(s, -day);
}

export function CalendarView({
  tasks: initialTasks,
  projects,
  initialProject,
  initialView,
}: {
  tasks: CalendarTask[];
  projects: { id: string; name: string }[];
  initialProject: string | null;
  initialView: "month" | "timeline";
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState(initialView);
  const [projectId, setProjectId] = useState<string>(initialProject ?? "all");
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    // Opened from a project whose work starts later: jump to its first open task. Otherwise today.
    const first = initialProject ? initialTasks.find((t) => t.projectId === initialProject && !t.done) : null;
    return first && first.start > today ? first.start : today;
  });

  // Server data replaces local state after each refresh.
  const pending = useRef(0);
  useEffect(() => {
    if (pending.current === 0) setTasks(initialTasks);
  }, [initialTasks]);

  const visible = useMemo(
    () => tasks.filter((t) => projectId === "all" || t.projectId === projectId),
    [tasks, projectId],
  );
  const shownProjects = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.projectId));
    return projects.filter((p) => ids.has(p.id));
  }, [tasks, projects]);
  const colorOf = useMemo(() => new Map(tasks.map((t) => [t.projectId, PROJECT_COLORS[t.color]])), [tasks]);

  const mutate: CalendarMutate = useCallback(
    (task, action, optimistic) => {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, ...optimistic } : t)));
      pending.current++;
      patchProject(task.projectId, action)
        .catch((err: Error) => {
          toast.error(err.message);
          setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));
        })
        .finally(() => {
          pending.current--;
          if (pending.current === 0) router.refresh();
        });
    },
    [router],
  );

  const cursorDate = parseISODate(cursor);
  const monthLabel = cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const step = (dir: 1 | -1) => {
    if (view === "month") {
      const d = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1);
      setCursor(toISODate(d));
    } else {
      setCursor(addDays(cursor, dir * 14));
    }
  };

  const overdue = visible.filter((t) => !t.done && t.due < today).length;
  const todayCount = visible.filter((t) => !t.done && t.start <= today && t.due >= today).length;

  return (
    <div className="mx-auto max-w-[96rem] px-8 py-8">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length ? (
              <>
                {todayCount} task{todayCount === 1 ? "" : "s"} for today
                {overdue > 0 && <span className="text-red-300"> · {overdue} overdue</span>}
              </>
            ) : (
              "Nothing scheduled yet."
            )}
          </p>
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-60 rounded-xl" aria-label="Filter by project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {shownProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf.get(p.id) }} />
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-xl bg-background/50 p-1 text-sm ring-1 ring-border" role="tablist" aria-label="View">
          {(
            [
              ["month", "Month", <LayoutGrid key="m" className="size-4" />],
              ["timeline", "Timeline", <GanttChart key="t" className="size-4" />],
            ] as const
          ).map(([v, label, icon]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors",
                view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" className="rounded-lg" onClick={() => step(-1)} aria-label="Previous">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setCursor(today)}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" className="rounded-lg" onClick={() => step(1)} aria-label="Next">
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-lg font-semibold" data-testid="calendar-label">
          {view === "month" ? monthLabel : `Weeks from ${parseISODate(weekStart(cursor)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        </h2>
        {/* Legend: colour is never the only cue — each chip also carries its project's name on hover/click. */}
        {projectId === "all" && shownProjects.length > 1 && (
          <ul className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Projects">
            {shownProjects.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: colorOf.get(p.id) }} />
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyCalendar />
      ) : view === "month" ? (
        <MonthGrid month={cursor.slice(0, 7)} tasks={visible} today={today} mutate={mutate} />
      ) : (
        <Timeline start={weekStart(cursor)} tasks={visible} today={today} mutate={mutate} />
      )}
    </div>
  );
}

function EmptyCalendar() {
  return (
    <div className="surface grid place-items-center rounded-2xl px-6 py-20 text-center">
      <CalendarDays className="mb-4 size-10 text-[#60a5fa]" />
      <p className="text-lg font-medium">Your calendar is empty</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Turn on <span className="text-foreground">Schedule on calendar</span> when creating a project, or open a project and click{" "}
        <span className="text-foreground">Schedule</span> to lay its tasks out over your working days.
      </p>
      <Button asChild className="mt-5 rounded-xl">
        <Link href="/">Go to projects</Link>
      </Button>
    </div>
  );
}
