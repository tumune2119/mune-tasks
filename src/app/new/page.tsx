import type { Metadata } from "next";
import { NewProjectForm } from "@/components/new-project/new-project-form";
import { getSettings } from "@/lib/settings";
import { hasApiKey } from "@/lib/ai/provider-api";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  const s = getSettings();
  const viaApi = s.provider === "api" || (s.provider === "auto" && hasApiKey());
  const providerLabel = `${viaApi ? "API key" : "Claude Code CLI"} · ${s.model}`;
  return <NewProjectForm providerLabel={providerLabel} />;
}
