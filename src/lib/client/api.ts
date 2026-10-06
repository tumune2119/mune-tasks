"use client";

import type { ProjectAction } from "../project-actions";
import type { ProjectTree } from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function patchProject(id: string, action: ProjectAction): Promise<ProjectTree> {
  return fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  }).then((r) => json<ProjectTree>(r));
}

export function deleteProjectRequest(id: string): Promise<void> {
  return fetch(`/api/projects/${id}`, { method: "DELETE" }).then((r) => json<void>(r));
}

export function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<T>(r));
}
