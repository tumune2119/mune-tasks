"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Link2,
  ListPlus,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimatedCheckbox } from "@/components/animated-checkbox";
import { PrioritySelect } from "@/components/priority-select";
import { DateChip, DateRangeEditor } from "@/components/date-range";
import { AttachByPathDialog, TaskFiles } from "@/components/task-files";
import { pickPaths } from "@/lib/client/files";
import { cn } from "@/lib/utils";
import type { TaskNode } from "@/lib/types";
import { restrictToVerticalAxis } from "./dnd-modifiers";
import { useProject } from "./project-context";
import { EditableText } from "./editable-text";
import { AddItemInput } from "./add-item-input";

/** Moves keyboard focus to the previous/next task row on the page. */
function focusSibling(from: HTMLElement, dir: 1 | -1) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-row]"));
  rows[rows.indexOf(from) + dir]?.focus();
}

export function TaskRow({ task, isSubtask = false }: { task: TaskNode; isSubtask?: boolean }) {
  const { mutate, openExpand } = useProject();
  const [open, setOpen] = useState(task.subtasks.length > 0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [pathDialog, setPathDialog] = useState(false);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Open automatically when a task gains its first subtasks (e.g. after "Expand with AI").
  const prevSubCount = useRef(task.subtasks.length);
  useEffect(() => {
    if (prevSubCount.current === 0 && task.subtasks.length > 0) setOpen(true);
    prevSubCount.current = task.subtasks.length;
  }, [task.subtasks.length]);

  const subDone = task.subtasks.filter((s) => s.done).length;
  const hasSubs = task.subtasks.length > 0;
  const toggle = (done: boolean) => mutate({ type: "toggleTask", taskId: task.id, done });

  const attachPaths = async (paths: string[]) => {
    if (!paths.length) return;
    const next = await mutate({ type: "addFiles", taskId: task.id, paths });
    if (next) toast.success(paths.length === 1 ? "File linked" : `${paths.length} files linked`);
  };
  const pickAndAttach = async (kind: "files" | "folder") => {
    try {
      await attachPaths(await pickPaths(kind, `Attach to: ${task.title}`));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onSubDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = task.subtasks.map((t) => t.id);
    mutate({
      type: "reorderTasks",
      sectionId: task.sectionId,
      parentId: task.id,
      ids: arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
    });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-20")}
      data-testid={isSubtask ? "subtask" : "task"}
    >
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        tabIndex={0}
        data-task-row
        data-done={task.done}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === " ") {
            e.preventDefault();
            toggle(!task.done);
          } else if (e.key === "Enter") {
            e.preventDefault();
            setEditingTitle(true);
          } else if (e.key === "ArrowDown" || e.key === "j") {
            e.preventDefault();
            focusSibling(e.currentTarget, 1);
          } else if (e.key === "ArrowUp" || e.key === "k") {
            e.preventDefault();
            focusSibling(e.currentTarget, -1);
          } else if (e.key === "ArrowRight" && hasSubs) {
            setOpen(true);
          } else if (e.key === "ArrowLeft" && hasSubs) {
            setOpen(false);
          }
        }}
        className={cn(
          "group/row flex items-start gap-2 rounded-xl px-1 outline-none transition-colors",
          isSubtask ? "py-1" : "py-1.5",
          "hover:bg-accent/35 focus-visible:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring/60",
          isDragging && "bg-accent/70 shadow-[var(--glow)]",
        )}
      >
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          tabIndex={-1}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>

        <div className={isSubtask ? "mt-0.5" : "mt-[1px]"}>
          <AnimatedCheckbox
            checked={task.done}
            partial={hasSubs && subDone > 0}
            onChange={toggle}
            size={isSubtask ? "sm" : "md"}
            label={`Mark “${task.title}” ${task.done ? "not done" : "done"}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className={cn("leading-snug", isSubtask ? "text-[0.85rem]" : "text-[0.92rem]")}>
            <EditableText
              value={task.title}
              editing={editingTitle || undefined}
              onEditingChange={(e) => !e && setEditingTitle(false)}
              onSave={(title) => mutate({ type: "updateTask", taskId: task.id, title })}
              ariaLabel="Task title"
              className={cn(
                "transition-colors duration-300",
                task.done ? "text-muted-foreground line-through decoration-[#60a5fa]/50" : "text-foreground",
              )}
            />
          </div>
          {editingNotes ? (
            <NotesEditor
              value={task.notes ?? ""}
              onDone={(notes) => {
                setEditingNotes(false);
                if (notes !== (task.notes ?? "")) mutate({ type: "updateTask", taskId: task.id, notes: notes || null });
              }}
            />
          ) : (
            task.notes && (
              <p
                onClick={() => setEditingNotes(true)}
                className="mt-0.5 cursor-text text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground"
              >
                {task.notes}
              </p>
            )
          )}
          <TaskFiles
            files={task.files}
            onRemove={(fileId) => mutate({ type: "removeFile", fileId })}
            className="mt-1.5"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {!isSubtask && (
            <DateRangeEditor
              start={task.startDate}
              due={task.dueDate}
              open={datesOpen}
              onOpenChange={setDatesOpen}
              onSave={(startDate, dueDate) => mutate({ type: "setTaskDates", taskId: task.id, startDate, dueDate })}
            >
              {task.startDate && task.dueDate ? (
                <button type="button" tabIndex={-1} className="rounded-full" aria-label="Edit dates">
                  <DateChip start={task.startDate} due={task.dueDate} done={task.done} />
                </button>
              ) : (
                <span aria-hidden className="block h-5 w-0" />
              )}
            </DateRangeEditor>
          )}
          {hasSubs && (
            <button
              onClick={() => setOpen((o) => !o)}
              tabIndex={-1}
              className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums hover:bg-accent hover:text-foreground"
              aria-label={open ? "Hide subtasks" : "Show subtasks"}
            >
              {subDone}/{task.subtasks.length}
              <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            </button>
          )}
          <PrioritySelect
            value={task.priority}
            onChange={(priority) => mutate({ type: "updateTask", taskId: task.id, priority })}
            emptyClassName="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              tabIndex={-1}
              className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 outline-none group-hover/row:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Task menu"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setEditingTitle(true)}>
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditingNotes(true)}>
                <StickyNote /> {task.notes ? "Edit notes" : "Add notes"}
              </DropdownMenuItem>
              {!isSubtask && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpen(true);
                      setAddingSub(true);
                    }}
                  >
                    <ListPlus /> Add subtask
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openExpand(task.id)}>
                    <Sparkles /> Expand into detailed steps
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDatesOpen(true)}>
                    <CalendarDays /> {task.dueDate ? "Change dates…" : "Set dates…"}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => pickAndAttach("files")}>
                <Paperclip /> Attach files…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickAndAttach("folder")}>
                <FolderPlus /> Attach folder…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPathDialog(true)}>
                <Link2 /> Link by path…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => mutate({ type: "deleteTask", taskId: task.id })}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
      <AttachByPathDialog open={pathDialog} onOpenChange={setPathDialog} onAttach={attachPaths} />

      {!isSubtask && (
        <AnimatePresence initial={false}>
          {(open || addingSub) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-[3.1rem] border-l border-[rgb(96_165_250/0.15)] pl-2">
                {hasSubs && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubDragEnd} modifiers={[restrictToVerticalAxis]}>
                    <SortableContext items={task.subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <ul>
                        {task.subtasks.map((s) => (
                          <TaskRow key={s.id} task={s} isSubtask />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
                <AddItemInput
                  open={addingSub}
                  onOpenChange={setAddingSub}
                  placeholder="Add a subtask…"
                  label="Add subtask"
                  small
                  className="ml-1"
                  onAdd={(title) => mutate({ type: "addTask", sectionId: task.sectionId, parentId: task.id, title })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </li>
  );
}

function NotesEditor({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      autoFocus
      value={draft}
      rows={Math.min(6, Math.max(2, draft.split("\n").length))}
      placeholder="Notes…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onDone(draft.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onDone(value);
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onDone(draft.trim());
      }}
      className="mt-1 w-full resize-none rounded-lg border border-ring/50 bg-background/60 px-2 py-1.5 text-xs leading-relaxed outline-none ring-2 ring-ring/15"
    />
  );
}
