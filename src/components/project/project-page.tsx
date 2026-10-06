"use client";

import { useState } from "react";
import type { ProjectTree } from "@/lib/types";
import type { UsageTotals } from "@/lib/usage";
import { ProjectProvider } from "./project-context";
import { ProjectView } from "./project-view";
import { ExpandTaskDialog, RegenerateSectionDialog } from "./ai-dialogs";

export function ProjectPage({ initial, usage }: { initial: ProjectTree; usage: UsageTotals }) {
  const [expandTaskId, setExpandTaskId] = useState<string | null>(null);
  const [regenSectionId, setRegenSectionId] = useState<string | null>(null);

  return (
    <ProjectProvider initial={initial} openExpand={setExpandTaskId} openRegenerate={setRegenSectionId}>
      <ProjectView usage={usage} />
      <ExpandTaskDialog taskId={expandTaskId} onClose={() => setExpandTaskId(null)} />
      <RegenerateSectionDialog sectionId={regenSectionId} onClose={() => setRegenSectionId(null)} />
    </ProjectProvider>
  );
}
