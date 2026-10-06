"use client";

import { Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/priority-badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

/**
 * Compact priority picker: shows the badge (or a faint flag) and opens a menu.
 * `emptyClassName` applies only when no priority is set (e.g. to reveal the flag on hover).
 */
export function PrioritySelect({
  value,
  onChange,
  emptyClassName,
}: {
  value: Priority | null;
  onChange: (p: Priority | null) => void;
  emptyClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "grid h-6 min-w-6 place-items-center rounded-md text-muted-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100",
          !value && emptyClassName,
        )}
        aria-label="Set priority"
      >
        {value ? <PriorityBadge priority={value} /> : <Flag className="size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup
          value={value ?? "none"}
          onValueChange={(v) => onChange(v === "none" ? null : (v as Priority))}
        >
          <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="med">Medium</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
