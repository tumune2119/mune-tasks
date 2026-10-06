"use client";

import { motion } from "framer-motion";
import { PriorityBadge } from "@/components/priority-badge";
import type { Priority } from "@/lib/types";

type Partial = {
  title?: string;
  summary?: string | null;
  sections?: {
    title?: string;
    tasks?: { title?: string; priority?: Priority | null; subtasks?: { title?: string }[] | null }[];
  }[];
};

/** Read-only tree rendered from partially-streamed JSON while Claude is still writing. */
export function PlanPreview({ plan }: { plan: Partial | null }) {
  if (!plan?.title && !plan?.sections?.length) {
    return (
      <div className="space-y-3">
        <div className="shimmer h-6 w-2/3 rounded-lg" />
        <div className="shimmer h-4 w-full rounded-lg" />
        <div className="shimmer h-4 w-5/6 rounded-lg" />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {plan.title && <h3 className="text-xl font-semibold tracking-tight">{plan.title}</h3>}
      {plan.summary && <p className="-mt-3 text-sm text-muted-foreground">{plan.summary}</p>}
      {plan.sections?.map((s, si) => (
        <motion.div key={si} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wider text-[#60a5fa] uppercase">{s.title}</h4>
          <ul className="space-y-1.5">
            {s.tasks?.map((t, ti) => (
              <motion.li key={ti} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="size-3.5 shrink-0 rounded border border-[rgb(96_165_250/0.4)]" />
                  <span className="min-w-0 flex-1">{t.title}</span>
                  <PriorityBadge priority={t.priority} />
                </div>
                {!!t.subtasks?.length && (
                  <ul className="mt-1 ml-6 space-y-1 border-l border-border pl-3">
                    {t.subtasks.map((st, i) => (
                      <li key={i} className="text-[0.8rem] text-muted-foreground">
                        {st.title}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}
