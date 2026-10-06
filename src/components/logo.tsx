import { cn } from "@/lib/utils";

/** MUNE TASKS mark: a bold "M" with a spark, on the blue-gradient tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="mt-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#mt-logo)" />
      <path
        d="M16 45V20l16 17 16-17v25"
        stroke="#fff"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="51" cy="12.5" r="3" fill="#dbeafe" />
    </svg>
  );
}

/** Two-tone wordmark: MUNE in white, TASKS in electric blue. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-semibold tracking-[0.14em] whitespace-nowrap", className)}>
      MUNE <span className="text-[#60a5fa] drop-shadow-[0_0_10px_rgb(59_130_246/0.55)]">TASKS</span>
    </span>
  );
}
