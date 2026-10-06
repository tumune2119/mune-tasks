import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, string> = {
  high: "bg-rose-500/12 text-rose-300 ring-rose-400/30",
  med: "bg-amber-400/10 text-amber-200 ring-amber-300/25",
  low: "bg-sky-400/10 text-sky-200 ring-sky-300/25",
};

const LABELS: Record<Priority, string> = { high: "High", med: "Med", low: "Low" };

export function PriorityBadge({ priority, className }: { priority: Priority | null | undefined; className?: string }) {
  if (!priority) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.68rem] font-medium ring-1 ring-inset",
        STYLES[priority],
        className,
      )}
    >
      {LABELS[priority]}
    </span>
  );
}
