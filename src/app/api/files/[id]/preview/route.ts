import fs from "node:fs";
import path from "node:path";
import { NotFoundError, getLinkedFile } from "@/lib/projects";
import { IMAGE_EXTENSIONS } from "@/lib/files";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
};
const MAX_BYTES = 30 * 1024 * 1024;

/** Thumbnail source for attached images, read straight from where they live. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]/preview">) {
  const { id } = await ctx.params;
  try {
    const f = getLinkedFile(id);
    const ext = path.extname(f.path).slice(1).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return new Response("Not an image", { status: 415 });
    const stat = fs.statSync(f.path, { throwIfNoEntry: false });
    if (!stat?.isFile()) return new Response("Not found", { status: 404 });
    if (stat.size > MAX_BYTES) return new Response("Too large to preview", { status: 413 });
    return new Response(new Uint8Array(fs.readFileSync(f.path)), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        // Re-check when the file changes on disk.
        "Cache-Control": "private, max-age=0, must-revalidate",
        ETag: `"${stat.size}-${stat.mtimeMs}"`,
        // An attached SVG is shown as an image only, never run as a page.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Not found", { status: 404 });
    throw err;
  }
}
