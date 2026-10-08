import fs from "node:fs";
import { NotFoundError, getLinkedFile } from "@/lib/projects";
import { openInDefaultApp } from "@/lib/files";

/** Opens an attached file in its default app (folders open in Explorer). Only ids of attached files are accepted. */
export async function POST(_req: Request, ctx: RouteContext<"/api/files/[id]/open">) {
  const { id } = await ctx.params;
  try {
    const f = getLinkedFile(id);
    if (!fs.existsSync(f.path)) return Response.json({ error: `Not found — it may have been moved: ${f.path}` }, { status: 404 });
    openInDefaultApp(f.path);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
