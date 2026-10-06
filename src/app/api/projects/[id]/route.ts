import { ProjectActionSchema } from "@/lib/project-actions";
import { NotFoundError, applyProjectAction, deleteProject, getProjectTree } from "@/lib/projects";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const project = getProjectTree(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json(project);
}

/** Applies one edit action and returns the updated project tree. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const parsed = ProjectActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid action" }, { status: 400 });
  }
  try {
    return Response.json(applyProjectAction(id, parsed.data));
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  try {
    deleteProject(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
