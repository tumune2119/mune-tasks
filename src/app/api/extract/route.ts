import { extractText } from "@/lib/extract";

/** Accepts multipart uploads and returns the extracted text of each file. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const results = await Promise.all(
    files.map(async (f) => extractText(f.name, Buffer.from(await f.arrayBuffer()))),
  );
  return Response.json({ files: results });
}
