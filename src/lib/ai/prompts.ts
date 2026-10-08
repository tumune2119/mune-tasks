import type { ExtractedFile, ProjectTree, SectionNode, TaskNode } from "../types";

export const DETAIL_LEVELS: Record<number, { label: string; guide: string }> = {
  1: {
    label: "Milestones",
    guide:
      "Level 1 — high-level milestones only. 1–3 sections with 2–5 tasks each. Each task is a milestone or deliverable that may take days. No subtasks. Notes only if essential.",
  },
  2: {
    label: "Broad tasks",
    guide:
      "Level 2 — broad tasks. 2–5 sections with 3–6 tasks each. Each task is roughly half a day to two days of work. No subtasks.",
  },
  3: {
    label: "Balanced",
    guide:
      "Level 3 — balanced. 3–6 sections with 3–7 tasks each. Each task takes roughly 1–4 hours. Add 2–4 subtasks only to tasks that clearly benefit from being split; most tasks have none.",
  },
  4: {
    label: "Detailed",
    guide:
      "Level 4 — detailed. 3–7 sections. Each task takes about an hour and most tasks have 3–6 subtasks of about 15–30 minutes each.",
  },
  5: {
    label: "Step by step",
    guide:
      "Level 5 — very detailed, step by step. Every task has 3–8 subtasks, and every subtask is one concrete action that takes about 5–15 minutes (e.g. \"Create the users table migration\", not \"Set up the database\"). Leave nothing implicit: include setup, verification and cleanup steps.",
  },
};

const JSON_RULES = `Output rules (critical):
- Respond with ONE JSON object and nothing else: no markdown fences, no commentary before or after.
- Use double-quoted keys and strings, no trailing commas, no comments.
- "estimateHours" is a realistic number of focused hours one person needs (e.g. 0.25, 1.5, 6). Give it for every task and subtask; a task with subtasks is estimated as the sum of its subtasks.
- "priority" is one of "low", "med", "high" or null. Use "high" sparingly: at most about 1 in 5 items, only for blocking or critical work. Use null when there is no meaningful signal.
- "notes" is a short string (max ~2 sentences) with useful specifics (commands, acceptance criteria, gotchas), or null. Never repeat the title in the notes.
- Titles are short, start with a verb, and are specific to this project — avoid generic filler like "Plan the project" or "Do research".
- Write in the same language as the user's description.`;

const SHARED_INTRO = `You are MUNE TASKS, an expert project planner. You turn project descriptions into clear, actionable, well-ordered todo lists. Tasks are ordered in the sequence they should be done; sections are phases or logical groups.`;

const COUNT_RULES = `Item-count requests:
- If the user asks for a number of items, treat it as a hard constraint. "tasks" means top-level tasks, "subtasks" means subtasks, "items"/"steps"/"todos" means every checkable line (tasks without subtasks plus all subtasks).
- "about N" means within ±20% of N. "max N" / "at most N" / "no more than N" means never exceed N. "at least N" means never fewer.
- The count request overrides the per-level ranges below; keep the granularity of the detail level as far as the count allows.
- Plan the count before writing, then check it: e.g. "about 12 tasks" means 10–14 top-level tasks in total across all sections.`;

export function planSystemPrompt(): string {
  return `${SHARED_INTRO}

Granularity by detail level:
${Object.values(DETAIL_LEVELS)
  .map((d) => `- ${d.guide}`)
  .join("\n")}

${COUNT_RULES}

Use attached files as context (specs, notes, existing code). Base tasks on what they actually contain, and reference concrete names from them where helpful.

Return exactly this shape:
{
  "title": "Short project name (max ~60 chars)",
  "summary": "One or two sentences describing the outcome",
  "sections": [
    {
      "title": "Section / phase name",
      "tasks": [
        {
          "title": "Task title",
          "notes": "string or null",
          "priority": "low" | "med" | "high" | null, "estimateHours": number,
          "subtasks": [ { "title": "Subtask title", "notes": "string or null", "priority": "low" | "med" | "high" | null, "estimateHours": number } ]
        }
      ]
    }
  ]
}
"subtasks" may be an empty array or omitted when the detail level calls for none. Every section has at least one task.

${JSON_RULES}`;
}

export interface PlanRequest {
  prompt: string;
  detailLevel: number;
  itemCount: string;
  extraInstructions: string;
  files: ExtractedFile[];
}

export function planUserMessage(req: PlanRequest): string {
  const parts: string[] = [];
  if (req.files.length) {
    parts.push(
      "<attachments>\n" +
        req.files
          .map((f) => `<file name="${escapeAttr(f.name)}">\n${f.text}\n</file>`)
          .join("\n") +
        "\n</attachments>",
    );
  }
  parts.push(`<project_description>\n${req.prompt.trim()}\n</project_description>`);
  parts.push(`Detail level: ${req.detailLevel} of 5 (${DETAIL_LEVELS[req.detailLevel]?.label}).`);
  parts.push(
    req.itemCount.trim()
      ? `Requested number of items: ${req.itemCount.trim()}`
      : "Requested number of items: none specified — use the ranges for the detail level.",
  );
  if (req.extraInstructions.trim()) {
    parts.push(`<extra_instructions>\n${req.extraInstructions.trim()}\n</extra_instructions>`);
  }
  parts.push("Create the todo list now. Respond with the JSON object only.");
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Partial regeneration

export function sectionSystemPrompt(): string {
  return `${SHARED_INTRO}

You are regenerating ONE section of an existing project plan. Keep it consistent with the rest of the project and do not duplicate work covered by other sections.

Granularity by detail level:
${Object.values(DETAIL_LEVELS)
  .map((d) => `- ${d.guide}`)
  .join("\n")}

Return exactly this shape:
{
  "title": "Section title (keep the current one unless the user's guidance suggests otherwise)",
  "tasks": [
    { "title": "...", "notes": "string or null", "priority": "low" | "med" | "high" | null, "estimateHours": number,
      "subtasks": [ { "title": "...", "notes": "string or null", "priority": "low" | "med" | "high" | null, "estimateHours": number } ] }
  ]
}

${JSON_RULES}`;
}

export function expandSystemPrompt(): string {
  return `${SHARED_INTRO}

You are expanding ONE task into detailed, concrete steps. Each step is a single action that takes about 5–15 minutes, starts with a verb, and is specific enough that someone could start it immediately. Typically produce 4–10 steps in execution order, including any setup and verification needed.

Return exactly this shape:
{ "subtasks": [ { "title": "...", "notes": "string or null", "priority": "low" | "med" | "high" | null, "estimateHours": number } ] }

${JSON_RULES}`;
}

function outline(project: ProjectTree, highlightSectionId?: string): string {
  return project.sections
    .map((s) => {
      const mark = s.id === highlightSectionId ? "  ← (this section)" : "";
      const tasks = s.tasks.map((t) => `  - ${t.title}`).join("\n");
      return `## ${s.title}${mark}\n${tasks}`;
    })
    .join("\n");
}

function projectContext(project: ProjectTree): string {
  return [
    `<project name="${escapeAttr(project.name)}">`,
    project.summary ? `Summary: ${project.summary}` : "",
    `Original description:\n${project.prompt}`,
    project.extraInstructions ? `Original extra instructions: ${project.extraInstructions}` : "",
    `</project>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function sectionUserMessage(
  project: ProjectTree,
  section: SectionNode,
  detailLevel: number,
  guidance: string,
): string {
  const current = section.tasks
    .map((t) => `- ${t.title}${t.subtasks.length ? "\n" + t.subtasks.map((s) => `  - ${s.title}`).join("\n") : ""}`)
    .join("\n");
  return [
    projectContext(project),
    `<plan_outline>\n${outline(project, section.id)}\n</plan_outline>`,
    `<section_to_regenerate title="${escapeAttr(section.title)}">\n${current || "(empty)"}\n</section_to_regenerate>`,
    `Detail level: ${detailLevel} of 5 (${DETAIL_LEVELS[detailLevel]?.label}).`,
    guidance.trim()
      ? `<user_guidance>\n${guidance.trim()}\n</user_guidance>`
      : "No extra guidance: produce an improved version of this section.",
    "Regenerate this section now. Respond with the JSON object only.",
  ].join("\n\n");
}

export function expandUserMessage(project: ProjectTree, section: SectionNode, task: TaskNode, guidance: string): string {
  return [
    projectContext(project),
    `<plan_outline>\n${outline(project, section.id)}\n</plan_outline>`,
    `<task_to_expand section="${escapeAttr(section.title)}">\nTitle: ${task.title}${task.notes ? `\nNotes: ${task.notes}` : ""}${
      task.subtasks.length ? `\nCurrent subtasks:\n${task.subtasks.map((s) => `- ${s.title}`).join("\n")}` : ""
    }\n</task_to_expand>`,
    guidance.trim() ? `<user_guidance>\n${guidance.trim()}\n</user_guidance>` : "",
    "Break this task into detailed steps now. Respond with the JSON object only.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Duration estimates for an existing plan (used before putting it on the calendar)

export function estimateSystemPrompt(): string {
  return `${SHARED_INTRO}

You are estimating how long each task of an existing plan takes, so it can be scheduled on a calendar. For every task id you are given, return a realistic number of focused hours for one person (e.g. 0.5, 2, 8). Count the subtasks listed under a task as part of it. Base estimates on the project description; don't pad them.

Return exactly this shape:
{ "estimates": [ { "id": "<task id as given>", "hours": number } ] }

Output rules (critical):
- Respond with ONE JSON object and nothing else: no markdown fences, no commentary.
- Include every id exactly once, copied exactly.`;
}

export function estimateUserMessage(project: ProjectTree, items: { id: string; task: TaskNode; section: string }[]): string {
  const list = items
    .map(({ id, task, section }) => {
      const notes = task.notes ? `\n    notes: ${task.notes}` : "";
      const subs = task.subtasks.map((st) => `\n    - ${st.title}`).join("");
      return `[${id}] ${task.title} (section: ${section})${notes}${subs}`;
    })
    .join("\n");
  return [
    projectContext(project),
    `<tasks_to_estimate>\n${list}\n</tasks_to_estimate>`,
    "Estimate every task now. Respond with the JSON object only.",
  ].join("\n\n");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "'");
}
