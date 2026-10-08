"use client";

import { toast } from "sonner";

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

/** Opens the Windows file/folder picker (shown by the local server) and returns the chosen paths. */
export async function pickPaths(kind: "files" | "folder", title: string): Promise<string[]> {
  const res = (await post("/api/files/pick", { kind, title })) as { paths: string[] };
  return res.paths;
}

export function openFile(id: string) {
  post(`/api/files/${id}/open`).catch((e: Error) => toast.error(e.message));
}

export function revealFile(id: string) {
  post(`/api/files/${id}/reveal`).catch((e: Error) => toast.error(e.message));
}
