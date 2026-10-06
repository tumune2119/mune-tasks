"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PriorityBadge } from "@/components/priority-badge";
import { parsePartialJson, streamAi } from "@/lib/client/ai-stream";
import { DETAIL_LEVELS } from "@/lib/ai/prompts";
import type { ExpandResult, PlanSection, PlanSubtask, PlanTask } from "@/lib/plan-schema";
import { useProject } from "./project-context";
import { UsageLine } from "@/components/usage-line";
import type { UsageInfo } from "@/lib/ai/events";

type Phase = "input" | "generating" | "result";

interface AiDialogProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  endpoint: string;
  body: (guidance: string) => unknown;
  controls?: React.ReactNode;
  renderItems: (data: Partial<T> | null) => React.ReactNode;
  applyLabel: string;
  onApply: (result: T) => Promise<void>;
}

/** Shared flow: optional guidance → stream from Claude with a live preview → review → apply. */
function AiDialog<T>(props: AiDialogProps<T>) {
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-2xl sm:max-w-2xl">
        {/* Content unmounts when closed, so every open starts from a clean state. */}
        <AiDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function AiDialogBody<T>({
  onClose,
  title,
  description,
  endpoint,
  body,
  controls,
  renderItems,
  applyLabel,
  onApply,
}: AiDialogProps<T>) {
  const [guidance, setGuidance] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<T | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const partial = useMemo(() => (phase === "generating" ? parsePartialJson<Partial<T>>(raw) : null), [raw, phase]);

  async function run() {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("generating");
    setRaw("");
    setError(null);
    setStatus("Starting…");
    try {
      const { data, usage } = await streamAi<T>(
        endpoint,
        body(guidance),
        {
          onMeta: (label) => setStatus(`Writing with ${label}`),
          onText: (d) => setRaw((r) => r + d),
          onRetry: () => {
            setStatus("Response didn't validate — retrying once…");
            setRaw("");
          },
        },
        ctrl.signal,
      );
      setResult(data);
      setUsage(usage);
      setPhase("result");
    } catch (err) {
      if (!ctrl.signal.aborted) setError((err as Error).message);
      setPhase("input");
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    try {
      await onApply(result);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#60a5fa]" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase === "input" && (
          <div className="space-y-4">
            {controls}
            <div className="space-y-2">
              <Label htmlFor="ai-guidance">
                Guidance <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="ai-guidance"
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && run()}
                placeholder="e.g. focus on testing, use PostgreSQL, keep it under 6 steps"
                className="min-h-20 rounded-xl"
              />
            </div>
            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-200">{error}</p>
            )}
          </div>
        )}

        {phase !== "input" && (
          <div className="max-h-[50vh] min-h-40 overflow-y-auto rounded-xl bg-background/50 p-4 ring-1 ring-border">
            {phase === "generating" && (
              <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-[#60a5fa]" /> {status}
              </p>
            )}
            {phase === "result" && usage && <UsageLine usage={usage} className="mb-3" />}
            {renderItems(phase === "result" ? (result as Partial<T>) : partial)}
          </div>
        )}

        <DialogFooter>
          {phase === "input" && (
            <Button onClick={run} className="rounded-xl">
              <Sparkles /> Generate
            </Button>
          )}
          {phase === "generating" && (
            <Button variant="outline" className="rounded-xl" onClick={() => abort.current?.abort()}>
              <Square className="fill-current" /> Stop
            </Button>
          )}
          {phase === "result" && (
            <>
              <Button variant="ghost" className="rounded-xl" onClick={run}>
                <RotateCcw /> Try again
              </Button>
              <Button className="rounded-xl" onClick={apply} disabled={applying}>
                {applying ? <Loader2 className="animate-spin" /> : <Check />} {applyLabel}
              </Button>
            </>
          )}
        </DialogFooter>
    </>
  );
}

function ItemList({ items }: { items?: Partial<PlanTask>[] | Partial<PlanSubtask>[] | null }) {
  if (!items?.length) return <div className="shimmer h-4 w-2/3 rounded" />;
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i}>
          <div className="flex items-center gap-2 text-sm">
            <span className="size-3.5 shrink-0 rounded border border-[rgb(96_165_250/0.4)]" />
            <span className="min-w-0 flex-1">{t.title}</span>
            <PriorityBadge priority={t.priority} />
          </div>
          {t.notes && <p className="ml-5.5 text-xs text-muted-foreground">{t.notes}</p>}
          {"subtasks" in t && !!t.subtasks?.length && (
            <ul className="mt-1 ml-6 space-y-0.5 border-l border-border pl-3">
              {t.subtasks.map((s, j) => (
                <li key={j} className="text-[0.8rem] text-muted-foreground">
                  {s?.title}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ExpandTaskDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { project, mutate } = useProject();
  const task = project.sections.flatMap((s) => s.tasks).find((t) => t.id === taskId);
  return (
    <AiDialog<ExpandResult>
      open={!!task}
      onClose={onClose}
      title="Expand into detailed steps"
      description={
        task
          ? `Claude will break “${task.title}” into 5–15 minute steps.${
              task.subtasks.length ? " Its current subtasks will be replaced." : ""
            }`
          : ""
      }
      endpoint="/api/ai/expand"
      body={(guidance) => ({ projectId: project.id, taskId, guidance })}
      renderItems={(d) => <ItemList items={d?.subtasks} />}
      applyLabel={task?.subtasks.length ? "Replace subtasks" : "Add subtasks"}
      onApply={async (r) => {
        const next = await mutate({ type: "replaceSubtasks", taskId: taskId!, subtasks: r.subtasks });
        if (next) toast.success(`Added ${r.subtasks.length} steps`);
      }}
    />
  );
}

export function RegenerateSectionDialog(props: { sectionId: string | null; onClose: () => void }) {
  // Keyed so the detail level resets to the project's default for each section.
  return <RegenerateSectionDialogInner key={props.sectionId ?? ""} {...props} />;
}

function RegenerateSectionDialogInner({ sectionId, onClose }: { sectionId: string | null; onClose: () => void }) {
  const { project, mutate } = useProject();
  const section = project.sections.find((s) => s.id === sectionId);
  const [level, setLevel] = useState(project.detailLevel);

  return (
    <AiDialog<PlanSection>
      open={!!section}
      onClose={onClose}
      title="Regenerate section"
      description={section ? `Claude will rewrite “${section.title}”. Its current tasks (and their checkmarks) will be replaced.` : ""}
      endpoint="/api/ai/section"
      body={(guidance) => ({ projectId: project.id, sectionId, detailLevel: level, guidance })}
      controls={
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <Label>Detail level</Label>
            <span className="text-sm">
              <span className="font-semibold text-[#60a5fa]">{level}</span>
              <span className="text-muted-foreground"> · {DETAIL_LEVELS[level]?.label}</span>
            </span>
          </div>
          <Slider min={1} max={5} step={1} value={[level]} onValueChange={([v]) => setLevel(v)} aria-label="Detail level" />
        </div>
      }
      renderItems={(d) => (
        <div className="space-y-2">
          {d?.title && <h4 className="text-xs font-semibold tracking-wider text-[#60a5fa] uppercase">{d.title}</h4>}
          <ItemList items={d?.tasks} />
        </div>
      )}
      applyLabel="Replace section"
      onApply={async (r) => {
        const next = await mutate({ type: "replaceSection", sectionId: sectionId!, section: r });
        if (next) toast.success("Section regenerated");
      }}
    />
  );
}
