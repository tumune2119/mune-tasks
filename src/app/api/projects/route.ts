import { z } from "zod";
import { PlanSchema } from "@/lib/plan-schema";
import { createProject, getDashboardStats, listProjectSummaries } from "@/lib/projects";
import { linkUsageToProject } from "@/lib/usage";

export async function GET() {
  const projects = listProjectSummaries();
  return Response.json({ projects, stats: getDashboardStats(projects) });
}

const Body = z.object({
  plan: PlanSchema,
  /** The usage-log id of the generation that produced this plan. */
  usageId: z.string().max(64).nullish(),
  meta: z.object({
    prompt: z.string().default(""),
    detailLevel: z.number().int().min(1).max(5).default(3),
    itemCount: z.string().default(""),
    extraInstructions: z.string().default(""),
    attachments: z
      .array(z.object({ name: z.string(), size: z.number(), chars: z.number() }))
      .default([]),
  }),
});

/** Saves a (possibly user-edited) generated plan as a new project. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid plan" }, { status: 400 });
  }
  const { plan, meta, usageId } = parsed.data;
  const id = createProject({
    name: plan.title,
    summary: plan.summary ?? "",
    sections: plan.sections,
    ...meta,
  });
  if (usageId) linkUsageToProject(usageId, id, plan.title);
  return Response.json({ id }, { status: 201 });
}
