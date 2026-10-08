"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, House, Plus, Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/logo";
import { ProgressRing } from "@/components/progress";
import { Kbd } from "@/components/kbd";
import { filterProjects, type ProjectFilter } from "@/lib/project-filter";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

const FILTERS: { value: ProjectFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Done" },
  { value: "archived", label: "Archived" },
];

export function Sidebar({ projects, footer }: { projects: ProjectSummary[]; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("active");

  const visible = useMemo(
    () => filterProjects(projects, { filter: query ? "all" : filter, query, sort: "recent" }),
    [projects, filter, query],
  );

  return (
    <aside className="sticky top-0 flex h-dvh w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <LogoMark className="size-8 drop-shadow-[0_0_10px_rgb(59_130_246/0.5)]" />
        <Link href="/" className="text-[0.95rem]" aria-label="MUNE TASKS home">
          <Wordmark />
        </Link>
      </div>

      <div className="space-y-3 px-4">
        <Button asChild className="h-9 w-full justify-between rounded-xl">
          <Link href="/new">
            <span className="flex items-center gap-2">
              <Plus /> New project
            </span>
            <Kbd className="border-white/25 bg-white/15 text-white">N</Kbd>
          </Link>
        </Button>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search="sidebar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
            placeholder="Search projects"
            className="h-9 rounded-xl bg-background/50 pr-8 pl-8"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
        </div>

        {!query && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-background/50 p-1 text-xs">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-lg py-1.5 font-medium transition-colors",
                  filter === f.value ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? "No matching projects." : "Nothing here yet."}
          </p>
        )}
        <ul className="space-y-0.5">
          {visible.map((p) => {
            const active = pathname === `/projects/${p.id}`;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                    active ? "bg-sidebar-accent ring-1 ring-primary/30" : "hover:bg-sidebar-accent/60",
                  )}
                >
                  <ProgressRing percent={p.percent} size={30} stroke={3} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", active ? "text-foreground" : "text-foreground/85")}>
                      {p.name}
                    </span>
                    <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
                      {p.percent}% · {relativeTime(p.updatedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <SideLink href="/" icon={<House className="size-4" />} label="Dashboard" active={pathname === "/"} />
        <SideLink href="/calendar" icon={<CalendarDays className="size-4" />} label="Calendar" active={pathname === "/calendar"} />
        <SideLink href="/usage" icon={<BarChart3 className="size-4" />} label="Claude usage" active={pathname === "/usage"} />
        <SideLink href="/settings" icon={<Settings className="size-4" />} label="Settings" active={pathname === "/settings"} />
        {footer}
        <p className="px-2.5 pt-2 text-[0.68rem] leading-relaxed whitespace-nowrap text-muted-foreground/80">
          <Kbd>N</Kbd> new · <Kbd>C</Kbd> calendar · <Kbd>/</Kbd> search · <Kbd>Space</Kbd> tick
        </p>
      </div>
    </aside>
  );
}

function SideLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
