import fs from "node:fs";
import path from "node:path";
import { NotFoundError, getLinkedFile } from "@/lib/projects";
import { openInDefaultApp, revealInExplorer } from "@/lib/files";

/** Opens Explorer with the attached file selected (or its folder, if the file itself is gone). */
export async function POST(_req: Request, ctx: RouteContext<"/api/files/[id]/reveal">) {
  const { id } = await ctx.params;
  try {
    const f = getLinkedFile(id);
    if (fs.existsSync(f.path)) revealInExplorer(f.path);
    else if (fs.existsSync(path.dirname(f.path))) openInDefaultApp(path.dirname(f.path));
    else return Response.json({ error: `Neither the file nor its folder exists any more: ${f.path}` }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
