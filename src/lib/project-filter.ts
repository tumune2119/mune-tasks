import type { ProjectSummary } from "./types";

export type ProjectFilter = "active" | "completed" | "archived" | "all";
export type ProjectSort = "recent" | "progress" | "name";

export function isCompleted(p: ProjectSummary) {
  return p.status === "active" && p.total > 0 && p.done === p.total;
}

export function filterProjects(
  list: ProjectSummary[],
  { filter, query, sort }: { filter: ProjectFilter; query: string; sort: ProjectSort },
): ProjectSummary[] {
  const q = query.trim().toLowerCase();
  const out = list.filter((p) => {
    if (filter === "archived" && p.status !== "archived") return false;
    if (filter === "completed" && !isCompleted(p)) return false;
    if (filter === "active" && (p.status !== "active" || isCompleted(p))) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.summary.toLowerCase().includes(q)) return false;
    return true;
  });
  return out.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "progress") return b.percent - a.percent || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
}
