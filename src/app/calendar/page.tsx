import type { Metadata } from "next";
import { listCalendarTasks } from "@/lib/calendar";
import { listProjectSummaries } from "@/lib/projects";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const sp = await props.searchParams;
  const tasks = listCalendarTasks();
  const active = listProjectSummaries().filter((p) => p.status === "active");
  return (
    <CalendarView
      tasks={tasks}
      projects={active.map((p) => ({ id: p.id, name: p.name }))}
      initialProject={typeof sp.project === "string" ? sp.project : null}
      initialView={sp.view === "timeline" ? "timeline" : "month"}
    />
  );
}
