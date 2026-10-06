"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Text that turns into an input on click (or when `editing` is forced on).
 * Enter / blur saves, Escape cancels.
 */
export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  editing: forced,
  onEditingChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const [local, setLocal] = useState(false);
  const editing = forced ?? local;
  const setEditing = (v: boolean) => {
    setLocal(v);
    onEditingChange?.(v);
  };

  if (!editing) {
    return (
      <span
        className={cn("cursor-text", className)}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  return (
    <EditInput
      initial={value}
      ariaLabel={ariaLabel}
      className={inputClassName}
      onDone={(v) => {
        setEditing(false);
        if (v !== null && v && v !== value) onSave(v);
      }}
    />
  );
}

/** Mounted fresh for each edit, so its draft always starts from the current value. */
function EditInput({
  initial,
  ariaLabel,
  className,
  onDone,
}: {
  initial: string;
  ariaLabel: string;
  className?: string;
  onDone: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const finished = useRef(false); // Enter + the blur from unmounting must not save twice
  const finish = (v: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(v);
  };
  return (
    <input
      autoFocus
      value={draft}
      aria-label={ariaLabel}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(draft.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(draft.trim());
        if (e.key === "Escape") finish(null);
      }}
      className={cn(
        "w-full rounded-md border border-ring/60 bg-background/70 px-1.5 py-0.5 outline-none ring-2 ring-ring/20",
        className,
      )}
    />
  );
}
