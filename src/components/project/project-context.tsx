"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { patchProject } from "@/lib/client/api";
import type { ProjectAction } from "@/lib/project-actions";
import type { ProjectTree } from "@/lib/types";
import { applyOptimistic } from "./optimistic";

interface Ctx {
  project: ProjectTree;
  mutate: (action: ProjectAction) => Promise<ProjectTree | null>;
  openExpand: (taskId: string) => void;
  openRegenerate: (sectionId: string) => void;
}

const ProjectCtx = createContext<Ctx | null>(null);

export function useProject() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}

export function ProjectProvider({
  initial,
  openExpand,
  openRegenerate,
  children,
}: {
  initial: ProjectTree;
  openExpand: (taskId: string) => void;
  openRegenerate: (sectionId: string) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const confirmed = useRef(initial); // last state the server agreed with
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (refreshTimer.current && clearTimeout(refreshTimer.current)), []);

  // Mutations run one at a time so responses can never arrive out of order.
  const mutate = useCallback(
    (action: ProjectAction) => {
      setProject((p) => applyOptimistic(p, action));
      pending.current++;
      const run = queue.current.then(async () => {
        try {
          const next = await patchProject(confirmed.current.id, action);
          confirmed.current = next;
          return next;
        } catch (err) {
          toast.error((err as Error).message);
          return null;
        } finally {
          pending.current--;
        }
      });
      queue.current = run;
      return run.then((next) => {
        if (pending.current === 0) {
          setProject(confirmed.current);
          // Refresh server components (sidebar progress) once things settle.
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 350);
        }
        return next;
      });
    },
    [router],
  );

  return <ProjectCtx.Provider value={{ project, mutate, openExpand, openRegenerate }}>{children}</ProjectCtx.Provider>;
}
