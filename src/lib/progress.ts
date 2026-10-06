import type { SectionNode, TaskNode } from "./types";

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

/**
 * Progress is counted on leaf items: a task without subtasks is one item,
 * a task with subtasks contributes one item per subtask.
 */
export function taskProgress(task: TaskNode): Progress {
  if (task.subtasks.length === 0) {
    return finish(task.done ? 1 : 0, 1);
  }
  const done = task.subtasks.filter((s) => s.done).length;
  return finish(done, task.subtasks.length);
}

export function sectionProgress(section: SectionNode): Progress {
  let done = 0;
  let total = 0;
  for (const t of section.tasks) {
    const p = taskProgress(t);
    done += p.done;
    total += p.total;
  }
  return finish(done, total);
}

export function projectProgress(sections: SectionNode[]): Progress {
  let done = 0;
  let total = 0;
  for (const s of sections) {
    const p = sectionProgress(s);
    done += p.done;
    total += p.total;
  }
  return finish(done, total);
}

function finish(done: number, total: number): Progress {
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
