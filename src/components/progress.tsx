"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ProgressRing({
  percent,
  size = 28,
  stroke = 3,
  className,
  showLabel = false,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const gradId = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const complete = percent >= 100;
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(96 165 250 / 0.14)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? "#34d399" : `url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c - (c * Math.min(percent, 100)) / 100 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ filter: "drop-shadow(0 0 3px rgb(59 130 246 / 0.6))" }}
        />
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      {showLabel && (
        <span className="absolute text-[0.62rem] font-semibold tabular-nums text-foreground/90">{percent}%</span>
      )}
    </div>
  );
}

export function ProgressBar({ percent, className, thin = false }: { percent: number; className?: string; thin?: boolean }) {
  const complete = percent >= 100;
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-full bg-[rgb(96_165_250/0.12)]", thin ? "h-1.5" : "h-2.5", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn(
          "h-full rounded-full",
          complete
            ? "bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-[0_0_12px_rgb(52_211_153/0.6)]"
            : "bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] shadow-[0_0_12px_rgb(59_130_246/0.7)]",
        )}
        initial={false}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
      />
    </div>
  );
}
