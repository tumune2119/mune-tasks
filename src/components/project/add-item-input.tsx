"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** "+ Add task" link that becomes an input; Enter adds and keeps it open for the next item. */
export function AddItemInput({
  open,
  onOpenChange,
  onAdd,
  placeholder,
  label,
  className,
  small = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (title: string) => void;
  placeholder: string;
  label: string;
  className?: string;
  small?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => onOpenChange(true)}
        className={cn(
          "mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
          small ? "text-xs" : "text-sm",
          className,
        )}
      >
        <Plus className={small ? "size-3.5" : "size-4"} /> {label}
      </button>
    );
  }
  return (
    <div className={cn("mt-1", className)}>
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value.trim() && onOpenChange(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
          if (e.key === "Escape") {
            setValue("");
            onOpenChange(false);
          }
        }}
        className={cn(
          "w-full rounded-lg border border-ring/50 bg-background/60 px-2.5 outline-none ring-2 ring-ring/15 placeholder:text-muted-foreground",
          small ? "h-7 text-[0.8rem]" : "h-8 text-sm",
        )}
      />
    </div>
  );
}
