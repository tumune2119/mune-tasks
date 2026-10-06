"use client";

import { useState } from "react";
import { ChevronDown, GripVertical, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "@/components/confirm-button";
import { ProgressBar } from "@/components/progress";
import { sectionProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import type { SectionNode } from "@/lib/types";
import { restrictToVerticalAxis } from "./dnd-modifiers";
import { useProject } from "./project-context";
import { EditableText } from "./editable-text";
import { TaskRow } from "./task-row";
import { AddItemInput } from "./add-item-input";

export function SectionCard({ section }: { section: SectionNode }) {
  const { mutate, openRegenerate } = useProject();
  const progress = sectionProgress(section);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = section.tasks.map((t) => t.id);
    mutate({
      type: "reorderTasks",
      sectionId: section.id,
      parentId: null,
      ids: arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    });
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("surface group/section rounded-2xl", isDragging && "z-10 opacity-90 shadow-[var(--glow)]")}
      data-testid="section"
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground/40 opacity-0 transition-opacity group-hover/section:opacity-100 hover:text-foreground active:cursor-grabbing"
          aria-label="Drag section"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand section" : "Collapse section"}
        >
          <ChevronDown className={cn("size-4 transition-transform", collapsed && "-rotate-90")} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide text-[#93c5fd]">
          <EditableText
            value={section.title}
            editing={renaming || undefined}
            onEditingChange={(e) => !e && setRenaming(false)}
            onSave={(title) => mutate({ type: "updateSection", sectionId: section.id, title })}
            ariaLabel="Section title"
          />
        </h2>
        <div className="flex w-36 items-center gap-2">
          <ProgressBar percent={progress.percent} thin />
          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums" data-testid="section-percent">
            {progress.percent}%
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openRegenerate(section.id)}
          aria-label="Regenerate section with AI"
          title="Regenerate section with AI"
          className="text-muted-foreground hover:text-[#60a5fa]"
        >
          <Sparkles />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Section menu" className="text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => openRegenerate(section.id)}>
              <Sparkles /> Regenerate with AI
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAdding(true)}>
              <Plus /> Add task
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {section.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {section.tasks.length === 0 && !adding && (
            <p className="px-9 py-2 text-sm text-muted-foreground">No tasks yet.</p>
          )}
          <AddItemInput
            open={adding}
            onOpenChange={setAdding}
            placeholder="Add a task…"
            label="Add task"
            className="ml-7"
            onAdd={(title) => mutate({ type: "addTask", sectionId: section.id, parentId: null, title })}
          />
        </div>
      )}

      <ConfirmButton
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this section?"
        description={`“${section.title}” and all of its tasks will be deleted.`}
        confirmLabel="Delete section"
        destructive
        onConfirm={() => void mutate({ type: "deleteSection", sectionId: section.id })}
      />
    </section>
  );
}
