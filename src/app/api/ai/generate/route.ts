import { z } from "zod";
import { streamAiJob } from "@/lib/ai/ndjson";
import { generateStructured } from "@/lib/ai/generate";
import { planSystemPrompt, planUserMessage } from "@/lib/ai/prompts";
import { PlanSchema } from "@/lib/plan-schema";

// ~150k tokens of attachments; above that we ask the user to trim rather than silently truncating.
const MAX_ATTACHMENT_CHARS = 600_000;

const Body = z.object({
  prompt: z.string().trim().min(1, "Describe the project first."),
  detailLevel: z.number().int().min(1).max(5),
  itemCount: z.string().max(200).default(""),
  extraInstructions: z.string().max(5000).default(""),
  files: z.array(z.object({ name: z.string(), size: z.number(), text: z.string() })).default([]),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  const chars = body.files.reduce((a, f) => a + f.text.length, 0);
  if (chars > MAX_ATTACHMENT_CHARS) {
    return Response.json(
      {
        error: `Attachments are too large (${Math.round(chars / 1000)}k characters, limit ${MAX_ATTACHMENT_CHARS / 1000}k). Remove or trim some files.`,
      },
      { status: 413 },
    );
  }

  return streamAiJob(request, ({ provider, signal, onText, onRetry }) =>
    generateStructured({
      system: planSystemPrompt(),
      user: planUserMessage(body),
      schema: PlanSchema,
      track: { kind: "plan" },
      provider,
      signal,
      onText,
      onRetry,
    }),
  );
}
