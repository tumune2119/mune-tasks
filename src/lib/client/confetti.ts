"use client";

import confetti from "canvas-confetti";

const COLORS = ["#3b82f6", "#60a5fa", "#93c5fd", "#ffffff", "#34d399"];

/** A small celebratory burst from both bottom corners. */
export function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const base = { particleCount: 70, spread: 70, startVelocity: 45, ticks: 220, colors: COLORS, scalar: 0.9 };
  confetti({ ...base, angle: 60, origin: { x: 0.15, y: 0.9 } });
  confetti({ ...base, angle: 120, origin: { x: 0.85, y: 0.9 } });
}
