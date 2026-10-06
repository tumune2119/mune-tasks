import { exportFileName, projectToText } from "@/lib/export-text";
import { getProjectTree, listProjectSummaries } from "@/lib/projects";

/**
 * Every project's task list as one text file (no done state).
 * ?notes=1 adds notes · ?format=md for Markdown · ?archived=1 includes archived projects.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const format = q.get("format") === "md" ? "markdown" : "text";
  const notes = q.get("notes") === "1";
  const withArchived = q.get("archived") === "1";

  const parts = listProjectSummaries()
    .filter((p) => withArchived || p.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => getProjectTree(p.id))
    .filter((p) => p !== null)
    .map((p) => projectToText(p, { notes, format }));

  const separator = format === "markdown" ? "\n---\n\n" : "\n\n";
  const stamp = new Date().toLocaleDateString("sv-SE");
  return new Response(parts.join(separator), {
    headers: {
      "Content-Type": `${format === "markdown" ? "text/markdown" : "text/plain"}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${exportFileName(`MUNE TASKS lists ${stamp}`, format === "markdown" ? "md" : "txt")}"`,
    },
  });
}
