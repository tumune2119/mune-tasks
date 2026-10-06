import { z } from "zod";
import { streamAiJob } from "@/lib/ai/ndjson";
import { generateStructured } from "@/lib/ai/generate";
import { expandSystemPrompt, expandUserMessage } from "@/lib/ai/prompts";
import { ExpandSchema } from "@/lib/plan-schema";
import { getProjectTree } from "@/lib/projects";

const Body = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  guidance: z.string().max(5000).default(""),
});

/** Breaks one task into detailed subtasks. Nothing is saved until the client applies it. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { projectId, taskId, guidance } = parsed.data;

  const project = getProjectTree(projectId);
  const section = project?.sections.find((s) => s.tasks.some((t) => t.id === taskId));
  const task = section?.tasks.find((t) => t.id === taskId);
  if (!project || !section || !task) return Response.json({ error: "Task not found" }, { status: 404 });

  return streamAiJob(request, ({ provider, signal, onText, onRetry }) =>
    generateStructured({
      system: expandSystemPrompt(),
      user: expandUserMessage(project, section, task, guidance),
      schema: ExpandSchema,
      track: { kind: "expand", projectId: project.id, projectName: project.name },
      provider,
      signal,
      onText,
      onRetry,
    }),
  );
}
