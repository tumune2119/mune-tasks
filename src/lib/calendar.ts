import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { PROJECT_COLORS, type CalendarTask } from "./calendar-types";

/** Every scheduled top-level task in active projects, for the calendar and the dashboard. */
export function listCalendarTasks(): CalendarTask[] {
  const rows = getDb().all<{
    id: string;
    project_id: string;
    project_name: string;
    project_order: number;
    section_title: string;
    title: string;
    start_date: string | null;
    due_date: string | null;
    done: number;
    priority: "low" | "med" | "high" | null;
    estimate_hours: number | null;
    sub_total: number;
    sub_done: number;
    file_count: number;
  }>(sql`
    SELECT t.id, t.project_id, p.name AS project_name,
      (SELECT COUNT(*) FROM projects p2 WHERE p2.created_at < p.created_at) AS project_order,
      s.title AS section_title, t.title, t.start_date, t.due_date, t.done, t.priority, t.estimate_hours,
      (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id) AS sub_total,
      (SELECT COUNT(*) FROM tasks st WHERE st.parent_id = t.id AND st.done = 1) AS sub_done,
      (SELECT COUNT(*) FROM task_files f WHERE f.task_id = t.id) AS file_count
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN sections s ON s.id = t.section_id
    WHERE p.status = 'active' AND t.parent_id IS NULL
      AND (t.start_date IS NOT NULL OR t.due_date IS NOT NULL)
    ORDER BY COALESCE(t.start_date, t.due_date), p.created_at, s.position, t.position
  `);
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    // Colour follows the project (by creation order), so it never changes when filters change.
    color: r.project_order % PROJECT_COLORS.length,
    section: r.section_title,
    title: r.title,
    start: (r.start_date ?? r.due_date)!,
    due: (r.due_date ?? r.start_date)!,
    done: r.done === 1,
    priority: r.priority,
    estimateHours: r.estimate_hours,
    subTotal: r.sub_total,
    subDone: r.sub_done,
    fileCount: r.file_count,
  }));
}
