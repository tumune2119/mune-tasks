"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@/components/project/dnd-modifiers";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress";
import { ConfirmButton } from "@/components/confirm-button";
import { celebrate } from "@/lib/client/confetti";
import { deleteProjectRequest } from "@/lib/client/api";
import { projectProgress } from "@/lib/progress";
import { relativeTime } from "@/lib/format";
import { useProject } from "./project-context";
import { EditableText } from "./editable-text";
import { PromptPanel } from "./prompt-panel";
import { SectionCard } from "./section-card";
import { ExportMenu } from "./export-menu";
import type { UsageTotals } from "@/lib/usage";

export function ProjectView({ usage }: { usage: UsageTotals }) {
  const { project, mutate } = useProject();
  const router = useRouter();
  const progress = projectProgress(project.sections);
  const complete = progress.total > 0 && progress.done === progress.total;

  // Confetti when the project crosses into 100% (not on page load).
  const prevComplete = useRef(complete);
  useEffect(() => {
    if (complete && !prevComplete.current) {
      celebrate();
      toast.success("Project complete! 🎉");
    }
    prevComplete.current = complete;
  }, [complete]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onSectionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = project.sections.map((s) => s.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    mutate({ type: "reorderSections", ids: next });
  };

  const [addingSection, setAddingSection] = useState(false);
  const archived = project.status === "archived";

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {archived && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-200 ring-1 ring-amber-300/25">
                <Archive className="size-3" /> Archived
              </span>
            )}
            <h1 className="text-3xl font-semibold tracking-tight">
              <EditableText
                value={project.name}
                onSave={(name) => mutate({ type: "renameProject", name })}
                ariaLabel="Project name"
                inputClassName="text-3xl font-semibold"
              />
            </h1>
            {project.summary && <p className="mt-2 text-muted-foreground">{project.summary}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ExportMenu project={project} />
            <ConfirmButton
              title={archived ? "Restore this project?" : "Archive this project?"}
              description={
                archived
                  ? "It will move back to your active projects."
                  : "It will be hidden from active projects. You can restore it any time from the Archived filter."
              }
              confirmLabel={archived ? "Restore" : "Archive"}
              onConfirm={async () => {
                await mutate({ type: "setStatus", status: archived ? "active" : "archived" });
                toast.success(archived ? "Project restored" : "Project archived");
              }}
            >
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
              </Button>
            </ConfirmButton>
            <ConfirmButton
              title="Delete this project?"
              description={`“${project.name}” and all of its tasks will be permanently deleted. This can't be undone.`}
              confirmLabel="Delete project"
              destructive
              onConfirm={async () => {
                try {
                  await deleteProjectRequest(project.id);
                  toast.success("Project deleted");
                  router.push("/");
                  router.refresh();
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <Trash2 /> Delete
              </Button>
            </ConfirmButton>
          </div>
        </div>

        <div className="surface mt-6 rounded-2xl p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{progress.done}</span> of{" "}
              <span className="tabular-nums">{progress.total}</span> items done
            </span>
            <span
              className={`text-2xl font-semibold tabular-nums ${complete ? "text-emerald-300" : "text-[#60a5fa]"}`}
              data-testid="project-percent"
            >
              {progress.percent}%
            </span>
          </div>
          <ProgressBar percent={progress.percent} />
          <p className="mt-3 text-xs text-muted-foreground" suppressHydrationWarning>
            Created {relativeTime(project.createdAt)} · Updated {relativeTime(project.updatedAt)}
          </p>
        </div>

        <PromptPanel project={project} usage={usage} />
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={project.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {project.sections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-4">
        {addingSection ? (
          <div className="surface rounded-2xl p-3">
            <EditableText
              value=""
              editing
              onEditingChange={(e) => !e && setAddingSection(false)}
              onSave={(title) => mutate({ type: "addSection", title })}
              placeholder="Section name"
              ariaLabel="New section name"
              inputClassName="text-sm"
            />
          </div>
        ) : (
          <Button variant="outline" className="rounded-xl" onClick={() => setAddingSection(true)}>
            <Plus /> Add section
          </Button>
        )}
      </div>
    </div>
  );
}
