import { CheckCheck, FolderKanban, Gauge } from "lucide-react";
import { getDashboardStats, listProjectSummaries } from "@/lib/projects";
import { ProjectBrowser } from "@/components/project-browser";
import { ProgressBar } from "@/components/progress";
import { UpNext } from "@/components/up-next";
import { listCalendarTasks } from "@/lib/calendar";

export default function HomePage() {
  const projects = listProjectSummaries();
  const stats = getDashboardStats(projects);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Everything you&apos;re building, in one place.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon={<FolderKanban className="size-5" />}
          label="Projects"
          value={stats.totalProjects}
          hint={`${stats.activeProjects} in progress · ${stats.completedProjects} completed`}
        />
        <StatCard
          icon={<CheckCheck className="size-5" />}
          label="Tasks done this week"
          value={stats.doneThisWeek}
          hint="Checked off since Monday"
        />
        <StatCard
          icon={<Gauge className="size-5" />}
          label="Overall completion"
          value={`${stats.overallPercent}%`}
          hint={`${stats.doneItems} of ${stats.totalItems} items across active projects`}
        >
          <ProgressBar percent={stats.overallPercent} thin className="mt-3" />
        </StatCard>
      </section>

      <UpNext tasks={listCalendarTasks()} />

      <ProjectBrowser projects={projects} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-[#60a5fa] ring-1 ring-primary/25">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}
