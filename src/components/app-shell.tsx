"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { QuitButton, StoppedScreen, useAppPresence } from "@/components/app-lifetime";
import type { ProjectSummary } from "@/lib/types";

function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog]") !== null;
}

export function AppShell({
  projects,
  launched,
  children,
}: {
  projects: ProjectSummary[];
  /** Started by the desktop launcher: the server stops when the last window closes. */
  launched: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { stopped, setStopped } = useAppPresence(launched);

  // Global shortcuts: N = new project, C = calendar, / = focus search. (Space/arrows live on task rows.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push("/new");
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        router.push("/calendar");
      } else if (e.key === "/") {
        e.preventDefault();
        const el =
          document.querySelector<HTMLInputElement>('[data-search="primary"]') ??
          document.querySelector<HTMLInputElement>('[data-search="sidebar"]');
        el?.focus();
        el?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Register the service worker so the app is installable as a PWA.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-dvh">
      <Sidebar projects={projects} footer={launched && <QuitButton onQuit={() => setStopped(true)} />} />
      <main className="min-w-0 flex-1">{children}</main>
      {stopped && <StoppedScreen />}
    </div>
  );
}
