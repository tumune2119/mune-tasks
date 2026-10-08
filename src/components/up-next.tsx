import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarDays } from "lucide-react";
import { DateChip } from "@/components/date-range";
import { PROJECT_COLORS, type CalendarTask } from "@/lib/calendar-types";
import { addDays, todayISO } from "@/lib/schedule";

/** Dashboard panel: overdue work, today's tasks and the next two days, from the calendar. */
export function UpNext({ tasks }: { tasks: CalendarTask[] }) {
  const today = todayISO();
  const soon = addDays(today, 2);
  const open = tasks.filter((t) => !t.done && t.start <= soon);
  if (!open.length) return null;
  const overdue = open.filter((t) => t.due < today);
  const items = [...overdue, ...open.filter((t) => t.due >= today)].slice(0, 6);

  return (
    <section className="surface mt-6 rounded-2xl p-5" data-testid="up-next">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="size-4 text-[#60a5fa]" />
        <h2 className="font-semibold">Up next</h2>
        {overdue.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-300">
            <AlertCircle className="size-3.5" /> {overdue.length} overdue
          </span>
        )}
        <Link href="/calendar" className="ml-auto flex items-center gap-1 text-xs text-[#60a5fa] hover:underline">
          Open calendar <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/projects/${t.projectId}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-accent/30">
              <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[t.color] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.projectName}</span>
              </span>
              {t.subTotal > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t.subDone}/{t.subTotal}
                </span>
              )}
              <DateChip start={t.start} due={t.due} done={t.done} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
