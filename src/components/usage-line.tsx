import { Coins } from "lucide-react";
import type { UsageInfo } from "@/lib/ai/events";
import { formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "4.1k in · 1.3k out · $0.02 · 12.8s" for one Claude request. */
export function UsageLine({ usage, className }: { usage: UsageInfo; className?: string }) {
  const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums", className)}
      title={`Input ${usage.inputTokens.toLocaleString()} · cache read ${usage.cacheReadTokens.toLocaleString()} · cache write ${usage.cacheWriteTokens.toLocaleString()} · output ${usage.outputTokens.toLocaleString()}${
        usage.attempts > 1 ? ` · ${usage.attempts} attempts` : ""
      }`}
    >
      <Coins className="size-3.5 text-[#60a5fa]" />
      {formatTokens(input)} in · {formatTokens(usage.outputTokens)} out · {formatUsd(usage.costUsd)} ·{" "}
      {formatDuration(usage.durationMs)}
    </span>
  );
}
