import { z } from "zod";
import { SectionSchema, SubtaskSchema } from "./plan-schema";

const id = z.string().min(1).max(64);
const priority = z.enum(["low", "med", "high"]).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date like 2026-10-08");

export const ScheduleOptionsSchema = z.object({
  start: isoDate,
  end: isoDate.nullable(),
  hoursPerDay: z.number().min(0.25).max(24),
  weekends: z.boolean(),
});

/** Every edit on the project page goes through one of these actions (PATCH /api/projects/[id]). */
export const ProjectActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("renameProject"), name: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("setStatus"), status: z.enum(["active", "archived"]) }),

  z.object({ type: z.literal("addSection"), title: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("updateSection"), sectionId: id, title: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("deleteSection"), sectionId: id }),
  z.object({ type: z.literal("reorderSections"), ids: z.array(id) }),
  z.object({
    type: z.literal("replaceSection"),
    sectionId: id,
    section: SectionSchema,
  }),

  z.object({
    type: z.literal("addTask"),
    sectionId: id,
    parentId: id.nullable(),
    title: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal("updateTask"),
    taskId: id,
    title: z.string().trim().min(1).max(300).optional(),
    notes: z.string().max(4000).nullable().optional(),
    priority: priority.optional(),
  }),
  z.object({ type: z.literal("toggleTask"), taskId: id, done: z.boolean() }),
  z.object({ type: z.literal("deleteTask"), taskId: id }),
  z.object({ type: z.literal("reorderTasks"), sectionId: id, parentId: id.nullable(), ids: z.array(id) }),
  z.object({ type: z.literal("replaceSubtasks"), taskId: id, subtasks: z.array(SubtaskSchema).min(1) }),

  // Calendar
  z.object({ type: z.literal("setTaskDates"), taskId: id, startDate: isoDate.nullable(), dueDate: isoDate.nullable() }),
  z.object({
    type: z.literal("setEstimates"),
    estimates: z.array(z.object({ taskId: id, hours: z.number().min(0.1).max(1000) })),
  }),
  z.object({ type: z.literal("schedule"), options: ScheduleOptionsSchema }),
  z.object({ type: z.literal("clearSchedule") }),

  // Files linked by path (nothing is uploaded)
  z.object({ type: z.literal("addFiles"), taskId: id, paths: z.array(z.string().min(1).max(2000)).min(1).max(50) }),
  z.object({ type: z.literal("removeFile"), fileId: id }),
]);

export type ProjectAction = z.infer<typeof ProjectActionSchema>;
