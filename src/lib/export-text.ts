import type { ProjectTree } from "./types";

export interface TextExportOptions {
  /** Add each item's notes on an indented line under it. */
  notes?: boolean;
  /** "text" = plain bullets that paste cleanly into Figma; "markdown" = headings and - lists. */
  format?: "text" | "markdown";
}

/** A project's plan as a plain list: sections, tasks, subtasks. No done/undone state, no priorities. */
export function projectToText(p: ProjectTree, { notes = false, format = "text" }: TextExportOptions = {}): string {
  const md = format === "markdown";
  const lines: string[] = [md ? `# ${p.name}` : p.name.toUpperCase()];
  if (p.summary) lines.push("", p.summary);

  for (const s of p.sections) {
    lines.push("", md ? `## ${s.title}` : s.title.toUpperCase(), "");
    for (const t of s.tasks) {
      lines.push(`${md ? "-" : "•"} ${t.title}`);
      if (notes && t.notes) lines.push(`${md ? "  " : "   "}${md ? "_" : ""}${oneLine(t.notes)}${md ? "_" : ""}`);
      for (const st of t.subtasks) {
        lines.push(`${md ? "  -" : "    –"} ${st.title}`);
        if (notes && st.notes) lines.push(`${md ? "    " : "      "}${md ? "_" : ""}${oneLine(st.notes)}${md ? "_" : ""}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

function oneLine(s: string) {
  return s.replace(/\s*\n\s*/g, " ").trim();
}

/** Safe file name from a project name. */
export function exportFileName(name: string, ext: string) {
  const base = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "project";
  return `${base}.${ext}`;
}
