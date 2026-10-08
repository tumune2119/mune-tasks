import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { estimateSystemPrompt, estimateUserMessage } from "@/lib/ai/prompts";
import { EstimateSchema } from "@/lib/plan-schema";
import { applyProjectAction, getProjectTree } from "@/lib/projects";

const Body = z.object({ projectId: z.string().min(1) });

/**
 * Asks Claude how many hours each unfinished task takes and saves the estimates, so an older plan
 * (made before estimates existed) can be scheduled realistically.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const project = getProjectTree(parsed.data.projectId);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  // Short ids ("t1", "t2", …) are cheaper for Claude to copy back exactly than database ids.
  const items = project.sections.flatMap((s) =>
    s.tasks.filter((t) => !t.done).map((task) => ({ task, section: s.title })),
  ).map((x, i) => ({ ...x, id: `t${i + 1}` }));
  if (!items.length) return Response.json({ estimated: 0 });

  try {
    const { data, usage } = await generateStructured({
      system: estimateSystemPrompt(),
      user: estimateUserMessage(project, items),
      schema: EstimateSchema,
      track: { kind: "estimate", projectId: project.id, projectName: project.name },
      signal: request.signal,
    });
    const byShortId = new Map(items.map((x) => [x.id, x.task.id]));
    const estimates = data.estimates
      .filter((e) => byShortId.has(e.id))
      .map((e) => ({ taskId: byShortId.get(e.id)!, hours: e.hours }));
    applyProjectAction(project.id, { type: "setEstimates", estimates });
    return Response.json({ estimated: estimates.length, of: items.length, usage });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
