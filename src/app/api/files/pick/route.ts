import { z } from "zod";
import { pickPaths } from "@/lib/files";

const Body = z.object({
  kind: z.enum(["files", "folder"]),
  title: z.string().max(200).default("Attach files"),
});

/** Shows the Windows file (or folder) picker on this PC and returns the chosen paths. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    return Response.json({ paths: await pickPaths(parsed.data.kind, parsed.data.title) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
