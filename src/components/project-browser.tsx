"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Archive, Plus, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/progress";
import { Kbd } from "@/components/kbd";
import { filterProjects, isCompleted, type ProjectFilter, type ProjectSort } from "@/lib/project-filter";
import { relativeTime } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";

export function ProjectBrowser({ projects }: { projects: ProjectSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const [sort, setSort] = useState<ProjectSort>("recent");

  const visible = useMemo(() => filterProjects(projects, { filter, query, sort }), [projects, filter, query, sort]);

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">Projects</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search="primary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
            placeholder="Search"
            className="h-9 rounded-xl pr-8 pl-8"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ProjectFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={sort} onValueChange={(v) => setSort(v as ProjectSort)}>
          <SelectTrigger className="w-36 rounded-xl" aria-label="Sort projects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="progress">Progress</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState hasProjects={projects.length > 0} filter={filter} query={query} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
            >
              <Link
                href={`/projects/${p.id}`}
                className="surface group flex h-full flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_rgb(59_130_246/0.6)]"
              >
                <div className="flex items-start gap-4">
                  <ProgressRing percent={p.percent} size={48} stroke={4} showLabel />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-medium leading-snug group-hover:text-white">{p.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>
                      Updated {relativeTime(p.updatedAt)}
                    </p>
                  </div>
                  {p.status === "archived" && <Archive className="size-4 text-muted-foreground" />}
                  {isCompleted(p) && <Sparkles className="size-4 text-emerald-300" />}
                </div>
                {p.summary && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>}
                <p className="mt-auto pt-4 text-xs text-muted-foreground tabular-nums">
                  {p.done} / {p.total} items done
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ hasProjects, filter, query }: { hasProjects: boolean; filter: ProjectFilter; query: string }) {
  if (!hasProjects) {
    return (
      <div className="surface grid place-items-center rounded-2xl px-6 py-16 text-center">
        <p className="text-lg font-medium">No projects yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Describe what you want to build and let Claude plan it.</p>
        <Button asChild className="mt-5 rounded-xl">
          <Link href="/new">
            <Plus /> New project
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="surface rounded-2xl px-6 py-12 text-center text-sm text-muted-foreground">
      {query ? `No projects match “${query}”.` : `No ${filter === "all" ? "" : filter} projects.`}
    </div>
  );
}
