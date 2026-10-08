import { z } from "zod";
import { exportAll, importBackup, type BackupFile } from "@/lib/projects";

export async function GET() {
  const data = exportAll();
  const stamp = new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mune-tasks-backup-${stamp}.json"`,
    },
  });
}

const Task: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string(),
    notes: z.string().nullish(),
    priority: z.enum(["low", "med", "high"]).nullish(),
    done: z.boolean(),
    doneAt: z.number().nullish(),
    startDate: z.string().nullish(),
    dueDate: z.string().nullish(),
    estimateHours: z.number().nullish(),
    files: z
      .array(z.object({ id: z.string().min(1), path: z.string().min(1), kind: z.enum(["file", "folder"]).default("file") }))
      .default([]),
    subtasks: z.array(Task).default([]),
  }),
);

const Backup = z.object({
  app: z.enum(["mune-tasks", "taskforge"]),
  version: z.literal(1),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      summary: z.string().nullish(),
      prompt: z.string().nullish(),
      detailLevel: z.number().nullish(),
      itemCount: z.string().nullish(),
      extraInstructions: z.string().nullish(),
      attachments: z.array(z.object({ name: z.string(), size: z.number(), chars: z.number() })).nullish(),
      status: z.enum(["active", "archived"]),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().nullish(),
      schedule: z
        .object({ start: z.string(), end: z.string().nullable(), hoursPerDay: z.number(), weekends: z.boolean() })
        .nullish(),
      sections: z.array(z.object({ id: z.string().min(1), title: z.string(), tasks: z.array(Task) })),
    }),
  ),
});

export async function POST(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "replace" ? "replace" : "merge";
  const parsed = Backup.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That file isn't a valid MUNE TASKS backup." }, { status: 400 });
  }
  const count = importBackup(parsed.data as unknown as BackupFile, mode);
  return Response.json({ imported: count, mode });
}
