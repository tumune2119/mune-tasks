"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Code2, Loader2, RotateCcw, Save, Sparkles, Square, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone, type UploadEntry } from "./file-dropzone";
import { PlanPreview } from "./plan-preview";
import { PlanEditor, countDraft, fromDraft, toDraft, type DraftPlan } from "./plan-editor";
import { parsePartialJson, streamAi } from "@/lib/client/ai-stream";
import { UsageLine } from "@/components/usage-line";
import type { UsageInfo } from "@/lib/ai/events";
import { postJson } from "@/lib/client/api";
import { DETAIL_LEVELS } from "@/lib/ai/prompts";
import type { Plan } from "@/lib/plan-schema";
import { cn } from "@/lib/utils";

type Phase = "idle" | "generating" | "review";
const DRAFT_KEY = "mune-tasks:new-project-draft";

const LEVEL_HINTS: Record<number, string> = {
  1: "A handful of milestones, no subtasks",
  2: "Broad tasks of half a day or more",
  3: "Hour-sized tasks, subtasks where useful",
  4: "~1h tasks split into 15–30 min subtasks",
  5: "Every step is 5–15 minutes",
};

export function NewProjectForm({ providerLabel }: { providerLabel: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [detailLevel, setDetailLevel] = useState(3);
  const [itemCount, setItemCount] = useState("");
  const [extra, setExtra] = useState("");
  const [files, setFiles] = useState<UploadEntry[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [raw, setRaw] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rawRef = useRef<HTMLPreElement>(null);

  // Keep the text fields around if the page is closed by accident. Restored after hydration
  // (localStorage doesn't exist on the server), so this has to be an effect.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrompt(saved.prompt ?? "");
        setDetailLevel(saved.detailLevel ?? 3);
        setItemCount(saved.itemCount ?? "");
        setExtra(saved.extra ?? "");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt, detailLevel, itemCount, extra }));
    } catch {}
  }, [prompt, detailLevel, itemCount, extra]);

  useEffect(() => {
    if (showRaw && rawRef.current) rawRef.current.scrollTop = rawRef.current.scrollHeight;
  }, [raw, showRaw]);

  const preview = useMemo(() => (phase === "generating" ? parsePartialJson<Partial<Plan>>(raw) : null), [raw, phase]);
  const uploading = files.some((f) => f.status === "loading");
  const readyFiles = files.filter((f) => f.status === "ready");
  const canGenerate = prompt.trim().length > 0 && !uploading && phase !== "generating";

  async function generate() {
    if (!canGenerate) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("generating");
    setRaw("");
    setError(null);
    setStatus(null);
    setDraft(null);
    setUsage(null);
    try {
      const { data: plan, usage } = await streamAi<Plan>(
        "/api/ai/generate",
        {
          prompt,
          detailLevel,
          itemCount,
          extraInstructions: extra,
          files: readyFiles.map((f) => ({ name: f.name, size: f.size, text: f.text })),
        },
        {
          onMeta: (label) => setStatus(`Writing with ${label}`),
          onText: (d) => setRaw((r) => r + d),
          onRetry: (reason) => {
            setStatus("Response didn't validate — retrying once…");
            setRaw("");
            console.warn("Retrying generation:", reason);
          },
        },
        ctrl.signal,
      );
      setDraft(toDraft(plan));
      setUsage(usage);
      setPhase("review");
    } catch (err) {
      if (ctrl.signal.aborted) {
        setPhase("idle");
        toast("Generation stopped");
      } else {
        setError((err as Error).message);
        setPhase("idle");
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function save() {
    if (!draft) return;
    const plan = fromDraft(draft);
    if (!plan.sections.length) {
      toast.error("The plan is empty — add at least one task.");
      return;
    }
    setSaving(true);
    try {
      const { id } = await postJson<{ id: string }>("/api/projects", {
        plan,
        usageId: usage?.id,
        meta: {
          prompt,
          detailLevel,
          itemCount,
          extraInstructions: extra,
          attachments: readyFiles.map((f) => ({ name: f.name, size: f.size, chars: f.text.length })),
        },
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      toast.success("Project saved");
      router.push(`/projects/${id}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  }

  const counts = draft ? countDraft(draft) : null;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-8 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ---------------- Form ---------------- */}
      <section className="space-y-6 lg:sticky lg:top-10 lg:self-start">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">New project</h1>
          <p className="mt-1 text-muted-foreground">Describe it, attach context, and Claude drafts the plan.</p>
        </header>

        <div className="surface space-y-5 rounded-2xl p-5">
          <div className="space-y-2">
            <Label htmlFor="prompt">Project description</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate();
              }}
              placeholder="What are you building? Goals, constraints, tech stack, deadlines — the more context, the better the plan."
              className="min-h-44 resize-y rounded-xl bg-background/50 text-[0.95rem] leading-relaxed"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <FileDropzone files={files} onChange={setFiles} />
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label>Detail level</Label>
              <span className="text-sm">
                <span className="font-semibold text-[#60a5fa]">{detailLevel}</span>
                <span className="text-muted-foreground"> · {DETAIL_LEVELS[detailLevel].label}</span>
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[detailLevel]}
              onValueChange={([v]) => setDetailLevel(v)}
              aria-label="Detail level"
            />
            <div className="flex justify-between text-[0.7rem] text-muted-foreground">
              <span>Vague milestones</span>
              <span>{LEVEL_HINTS[detailLevel]}</span>
              <span>5–15 min steps</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="count">
                Number of items <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="count"
                value={itemCount}
                onChange={(e) => setItemCount(e.target.value)}
                placeholder="about 10 tasks · max 30 subtasks"
                className="rounded-xl bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra">
                Extra instructions <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="extra"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="group by phase, include testing steps"
                className="rounded-xl bg-background/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {phase === "generating" ? (
              <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => abortRef.current?.abort()}>
                <Square className="fill-current" /> Stop
              </Button>
            ) : (
              <Button className="h-10 rounded-xl px-5" onClick={generate} disabled={!canGenerate}>
                {draft ? <RotateCcw /> : <Wand2 />}
                {draft ? "Regenerate" : "Generate plan"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {uploading ? "Waiting for files…" : `${providerLabel} · Ctrl+Enter`}
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- Output ---------------- */}
      <section className="surface relative min-h-[32rem] overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          {phase === "generating" ? (
            <Loader2 className="size-4 animate-spin text-[#60a5fa]" />
          ) : (
            <Sparkles className="size-4 text-[#60a5fa]" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {phase === "generating"
              ? (status ?? "Starting…")
              : phase === "review" && counts
                ? `${counts.sections} sections · ${counts.tasks} tasks · ${counts.subtasks} subtasks — edit anything, then save`
                : "Your plan will appear here"}
          </span>
          {phase === "generating" && (
            <Button size="sm" variant="ghost" onClick={() => setShowRaw((s) => !s)} className="text-muted-foreground">
              <Code2 /> {showRaw ? "Tree" : "Raw"}
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button size="sm" variant="ghost" onClick={() => (setDraft(null), setPhase("idle"))}>
                <X /> Discard
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="rounded-lg">
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save project
              </Button>
            </>
          )}
        </div>

        <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "idle" && !error && <IdleIllustration />}

          {phase === "generating" &&
            (showRaw ? (
              <pre
                ref={rawRef}
                className="max-h-[60vh] overflow-auto rounded-xl bg-background/60 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-sky-100/80"
              >
                {raw || "…"}
              </pre>
            ) : (
              <PlanPreview plan={preview} />
            ))}

          {phase === "review" && usage && (
            <div className="mb-4 flex justify-end">
              <UsageLine usage={usage} />
            </div>
          )}
          {phase === "review" && draft && <PlanEditor draft={draft} onChange={setDraft} />}
        </div>
      </section>
    </div>
  );
}

function IdleIllustration() {
  return (
    <div className="grid min-h-[26rem] place-items-center text-center">
      <div>
        <div className="mx-auto mb-5 grid w-56 gap-2">
          {[0.9, 0.7, 0.8, 0.55].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn("size-3.5 rounded border", i === 0 ? "border-primary bg-primary/70" : "border-[rgb(96_165_250/0.35)]")} />
              <span className="h-2.5 rounded-full bg-[rgb(96_165_250/0.14)]" style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="font-medium">Describe your project to get started</p>
        <p className="mt-1 text-sm text-muted-foreground">The plan streams in live, then you can edit it before saving.</p>
      </div>
    </div>
  );
}
