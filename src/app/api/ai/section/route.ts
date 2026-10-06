import { z } from "zod";
import { streamAiJob } from "@/lib/ai/ndjson";
import { generateStructured } from "@/lib/ai/generate";
import { sectionSystemPrompt, sectionUserMessage } from "@/lib/ai/prompts";
import { SectionSchema } from "@/lib/plan-schema";
import { getProjectTree } from "@/lib/projects";

const Body = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().min(1),
  detailLevel: z.number().int().min(1).max(5),
  guidance: z.string().max(5000).default(""),
});

/** Generates a replacement for one section. Nothing is saved until the client applies it. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { projectId, sectionId, detailLevel, guidance } = parsed.data;

  const project = getProjectTree(projectId);
  const section = project?.sections.find((s) => s.id === sectionId);
  if (!project || !section) return Response.json({ error: "Section not found" }, { status: 404 });

  return streamAiJob(request, ({ provider, signal, onText, onRetry }) =>
    generateStructured({
      system: sectionSystemPrompt(),
      user: sectionUserMessage(project, section, detailLevel, guidance),
      schema: SectionSchema,
      track: { kind: "section", projectId: project.id, projectName: project.name },
      provider,
      signal,
      onText,
      onRetry,
    }),
  );
}
