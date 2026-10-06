"use client";

import { ChevronDown, ChevronRight, Plus, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PrioritySelect } from "@/components/priority-select";
import type { Plan } from "@/lib/plan-schema";
import type { Priority } from "@/lib/types";

interface DraftItem {
  key: string;
  title: string;
  notes: string;
  priority: Priority | null;
}
interface DraftTask extends DraftItem {
  subtasks: DraftItem[];
}
interface DraftSection {
  key: string;
  title: string;
  tasks: DraftTask[];
}
export interface DraftPlan {
  title: string;
  summary: string;
  sections: DraftSection[];
}

const k = () => crypto.randomUUID();

export function toDraft(plan: Plan): DraftPlan {
  const item = (t: { title: string; notes?: string | null; priority?: Priority | null }): DraftItem => ({
    key: k(),
    title: t.title,
    notes: t.notes ?? "",
    priority: t.priority ?? null,
  });
  return {
    title: plan.title,
    summary: plan.summary ?? "",
    sections: plan.sections.map((s) => ({
      key: k(),
      title: s.title,
      tasks: s.tasks.map((t) => ({ ...item(t), subtasks: (t.subtasks ?? []).map(item) })),
    })),
  };
}

/** Back to the API shape; drops empty rows and empty sections. */
export function fromDraft(d: DraftPlan): Plan {
  const item = (i: DraftItem) => ({ title: i.title.trim(), notes: i.notes.trim() || null, priority: i.priority });
  return {
    title: d.title.trim() || "Untitled project",
    summary: d.summary.trim() || null,
    sections: d.sections
      .map((s) => ({
        title: s.title.trim() || "Untitled section",
        tasks: s.tasks
          .filter((t) => t.title.trim())
          .map((t) => ({ ...item(t), subtasks: t.subtasks.filter((st) => st.title.trim()).map(item) })),
      }))
      .filter((s) => s.tasks.length > 0),
  };
}

export function countDraft(d: DraftPlan) {
  let tasks = 0;
  let subtasks = 0;
  for (const s of d.sections) {
    tasks += s.tasks.length;
    for (const t of s.tasks) subtasks += t.subtasks.length;
  }
  return { sections: d.sections.length, tasks, subtasks };
}

/** Lightweight editor for a generated plan before it is saved. */
export function PlanEditor({ draft, onChange }: { draft: DraftPlan; onChange: (d: DraftPlan) => void }) {
  const set = (fn: (d: DraftPlan) => void) => {
    const next = structuredClone(draft);
    fn(next);
    onChange(next);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Input
          value={draft.title}
          onChange={(e) => set((d) => void (d.title = e.target.value))}
          className="h-11 rounded-xl border-transparent bg-transparent px-2 text-xl font-semibold tracking-tight hover:border-border focus-visible:border-ring"
          aria-label="Project title"
        />
        <Textarea
          value={draft.summary}
          onChange={(e) => set((d) => void (d.summary = e.target.value))}
          placeholder="Summary"
          rows={2}
          className="min-h-0 resize-none rounded-xl border-transparent bg-transparent px-2 text-sm text-muted-foreground hover:border-border"
        />
      </div>

      {draft.sections.map((s, si) => (
        <div key={s.key} className="rounded-2xl border border-border bg-background/30 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={s.title}
              onChange={(e) => set((d) => void (d.sections[si].title = e.target.value))}
              className="h-8 border-transparent bg-transparent px-2 text-xs font-semibold tracking-wider text-[#60a5fa] uppercase hover:border-border"
              aria-label="Section title"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => set((d) => void d.sections.splice(si, 1))}
              aria-label="Delete section"
            >
              <Trash2 />
            </Button>
          </div>
          <ul className="mt-1 space-y-1">
            {s.tasks.map((t, ti) => (
              <DraftTaskRow
                key={t.key}
                task={t}
                onChange={(fn) => set((d) => fn(d.sections[si].tasks[ti]))}
                onDelete={() => set((d) => void d.sections[si].tasks.splice(ti, 1))}
              />
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 text-muted-foreground"
            onClick={() =>
              set((d) => void d.sections[si].tasks.push({ key: k(), title: "", notes: "", priority: null, subtasks: [] }))
            }
          >
            <Plus /> Add task
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={() => set((d) => void d.sections.push({ key: k(), title: "New section", tasks: [] }))}
      >
        <Plus /> Add section
      </Button>
    </div>
  );
}

function DraftTaskRow({
  task,
  onChange,
  onDelete,
}: {
  task: DraftTask;
  onChange: (fn: (t: DraftTask) => void) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasMore = task.subtasks.length > 0 || !!task.notes;
  return (
    <li className="group rounded-xl px-1 py-0.5 hover:bg-accent/30">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Input
          value={task.title}
          onChange={(e) => onChange((t) => void (t.title = e.target.value))}
          placeholder="Task title"
          className="h-8 flex-1 border-transparent bg-transparent px-2 text-sm hover:border-border"
          autoFocus={!task.title}
        />
        {hasMore && !open && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {task.subtasks.length ? `${task.subtasks.length} sub` : <StickyNote className="size-3.5" />}
          </span>
        )}
        <PrioritySelect
          value={task.priority}
          onChange={(p) => onChange((t) => void (t.priority = p))}
          emptyClassName="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
        <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={onDelete} aria-label="Delete task">
          <Trash2 />
        </Button>
      </div>
      {open && (
        <div className="mt-1 mb-2 ml-7 space-y-1.5">
          <Textarea
            value={task.notes}
            onChange={(e) => onChange((t) => void (t.notes = e.target.value))}
            placeholder="Notes (optional)"
            rows={2}
            className="min-h-0 resize-none text-sm"
          />
          {task.subtasks.map((st, i) => (
            <div key={st.key} className="flex items-center gap-1 border-l border-border pl-2">
              <Input
                value={st.title}
                onChange={(e) => onChange((t) => void (t.subtasks[i].title = e.target.value))}
                placeholder="Subtask"
                className="h-7 flex-1 border-transparent bg-transparent px-2 text-[0.8rem] hover:border-border"
                autoFocus={!st.title}
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onChange((t) => void t.subtasks.splice(i, 1))}
                aria-label="Delete subtask"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => onChange((t) => void t.subtasks.push({ key: k(), title: "", notes: "", priority: null }))}
          >
            <Plus /> Subtask
          </Button>
        </div>
      )}
    </li>
  );
}
