import type { ProjectAction } from "@/lib/project-actions";
import type { ProjectTree, TaskNode } from "@/lib/types";

/** Mirrors the server's rules locally so the UI updates instantly; the server response then replaces it. */
export function applyOptimistic(p: ProjectTree, a: ProjectAction): ProjectTree {
  const next = structuredClone(p);
  const now = Date.now();
  const findTask = (id: string): { task: TaskNode; list: TaskNode[]; parent: TaskNode | null } | null => {
    for (const s of next.sections) {
      for (const t of s.tasks) {
        if (t.id === id) return { task: t, list: s.tasks, parent: null };
        const st = t.subtasks.find((x) => x.id === id);
        if (st) return { task: st, list: t.subtasks, parent: t };
      }
    }
    return null;
  };
  const syncParent = (parent: TaskNode) => {
    if (!parent.subtasks.length) return;
    const all = parent.subtasks.every((s) => s.done);
    if (all !== parent.done) {
      parent.done = all;
      parent.doneAt = all ? now : null;
    }
  };

  switch (a.type) {
    case "renameProject":
      next.name = a.name;
      break;
    case "setStatus":
      next.status = a.status;
      break;
    case "updateSection": {
      const s = next.sections.find((x) => x.id === a.sectionId);
      if (s) s.title = a.title;
      break;
    }
    case "deleteSection":
      next.sections = next.sections.filter((s) => s.id !== a.sectionId);
      break;
    case "reorderSections":
      next.sections.sort((x, y) => a.ids.indexOf(x.id) - a.ids.indexOf(y.id));
      break;
    case "toggleTask": {
      const f = findTask(a.taskId);
      if (!f) break;
      f.task.done = a.done;
      f.task.doneAt = a.done ? now : null;
      if (f.parent) syncParent(f.parent);
      else
        f.task.subtasks.forEach((s) => {
          if (s.done !== a.done) {
            s.done = a.done;
            s.doneAt = a.done ? now : null;
          }
        });
      break;
    }
    case "updateTask": {
      const f = findTask(a.taskId);
      if (!f) break;
      if (a.title !== undefined) f.task.title = a.title;
      if (a.notes !== undefined) f.task.notes = a.notes?.trim() ? a.notes : null;
      if (a.priority !== undefined) f.task.priority = a.priority;
      break;
    }
    case "deleteTask": {
      const f = findTask(a.taskId);
      if (!f) break;
      f.list.splice(f.list.indexOf(f.task), 1);
      if (f.parent) syncParent(f.parent);
      break;
    }
    case "reorderTasks": {
      const s = next.sections.find((x) => x.id === a.sectionId);
      if (!s) break;
      const list = a.parentId ? s.tasks.find((t) => t.id === a.parentId)?.subtasks : s.tasks;
      list?.sort((x, y) => a.ids.indexOf(x.id) - a.ids.indexOf(y.id));
      break;
    }
    case "setTaskDates": {
      const f = findTask(a.taskId);
      if (!f) break;
      let start = a.startDate ?? a.dueDate;
      let due = a.dueDate ?? a.startDate;
      if (start && due && due < start) [start, due] = [due, start];
      f.task.startDate = start;
      f.task.dueDate = due;
      break;
    }
    case "removeFile":
      for (const s of next.sections)
        for (const t of s.tasks)
          for (const node of [t, ...t.subtasks]) node.files = node.files.filter((x) => x.id !== a.fileId);
      break;
    default:
      // addSection / addTask / addFiles / schedule / replace* depend on the server — wait for the response.
      break;
  }
  return next;
}
