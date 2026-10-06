"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AnimatedCheckbox({
  checked,
  partial = false,
  onChange,
  size = "md",
  label,
}: {
  checked: boolean;
  /** Some (not all) subtasks done. */
  partial?: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  label: string;
}) {
  const dim = size === "sm" ? 16 : 20;
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked ? true : partial ? "mixed" : false}
      aria-label={label}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      whileTap={{ scale: 0.85 }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md border transition-colors duration-200",
        checked
          ? "border-primary bg-primary shadow-[0_0_10px_rgb(59_130_246/0.6)]"
          : "border-[rgb(96_165_250/0.4)] bg-[rgb(15_23_42/0.6)] hover:border-[#60a5fa]",
      )}
      style={{ width: dim, height: dim }}
    >
      <svg viewBox="0 0 16 16" width={dim - 4} height={dim - 4} aria-hidden>
        <motion.path
          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
          fill="none"
          stroke="white"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        />
      </svg>
      {!checked && partial && <span className="absolute h-0.5 w-2 rounded bg-[#60a5fa]" />}
    </motion.button>
  );
}
