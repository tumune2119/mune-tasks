"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Coins, FileText, ScrollText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DETAIL_LEVELS } from "@/lib/ai/prompts";
import { formatBytes, formatTokens, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectTree } from "@/lib/types";
import type { UsageTotals } from "@/lib/usage";

export function PromptPanel({ project, usage }: { project: ProjectTree; usage: UsageTotals }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
        <ScrollText className="size-4" />
        Original prompt
        {project.attachments.length > 0 && (
          <span className="text-xs">
            · {project.attachments.length} file{project.attachments.length === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="surface mt-2 space-y-4 rounded-2xl p-5 text-sm">
          <p className="leading-relaxed whitespace-pre-wrap text-foreground/90">{project.prompt || "—"}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Detail level</dt>
            <dd>
              {project.detailLevel} · {DETAIL_LEVELS[project.detailLevel]?.label}
            </dd>
            <dt className="text-muted-foreground">Number of items</dt>
            <dd>{project.itemCount || "—"}</dd>
            <dt className="text-muted-foreground">Extra instructions</dt>
            <dd>{project.extraInstructions || "—"}</dd>
            <dt className="text-muted-foreground">Claude usage</dt>
            <dd className="flex items-center gap-1.5 tabular-nums">
              <Coins className="size-3.5 text-[#60a5fa]" />
              {usage.calls
                ? `${usage.calls} request${usage.calls === 1 ? "" : "s"} · ${formatTokens(usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens)} in · ${formatTokens(usage.outputTokens)} out · ${formatUsd(usage.costUsd)}`
                : "none recorded"}
              <Link href="/usage" className="ml-1 text-[#60a5fa] hover:underline">
                details
              </Link>
            </dd>
          </dl>
          {project.attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {project.attachments.map((a, i) => (
                <li key={i} className="flex items-center gap-1.5 rounded-lg bg-secondary/70 px-2.5 py-1 text-xs ring-1 ring-border">
                  <FileText className="size-3.5 text-[#60a5fa]" />
                  {a.name}
                  <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
