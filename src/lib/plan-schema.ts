import { z } from "zod";

/** Accepts "medium"/"MED"/"" etc. and normalises to low | med | high | null. */
const priority = z.preprocess((v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "" || s === "none" || s === "null") return null;
  if (s === "medium" || s === "normal") return "med";
  return s;
}, z.enum(["low", "med", "high"]).nullable());

const notes = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(4000).nullish(),
);

export const SubtaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  notes,
  priority: priority.optional(),
});

export const TaskSchema = SubtaskSchema.extend({
  subtasks: z.array(SubtaskSchema).nullish(),
});

export const SectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  tasks: z.array(TaskSchema).min(1),
});

export const PlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000).nullish(),
  sections: z.array(SectionSchema).min(1),
});

export const ExpandSchema = z.object({
  subtasks: z.array(SubtaskSchema).min(1),
});

export type PlanSubtask = z.infer<typeof SubtaskSchema>;
export type PlanTask = z.infer<typeof TaskSchema>;
export type PlanSection = z.infer<typeof SectionSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ExpandResult = z.infer<typeof ExpandSchema>;

/** Pulls the JSON object out of a model response (tolerates code fences / stray prose). */
export function extractJsonText(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in the response.");
  return t.slice(start, end + 1);
}

export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}
