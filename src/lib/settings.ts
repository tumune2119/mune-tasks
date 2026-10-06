import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { settings } from "./db/schema";
import type { AppSettings } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "auto",
  model: DEFAULT_MODEL,
  effort: "medium",
  cliPath: "",
};

export function getSettings(): AppSettings {
  const row = getDb().select().from(settings).where(eq(settings.key, "app")).get();
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: AppSettings) {
  const value = JSON.stringify(next);
  getDb()
    .insert(settings)
    .values({ key: "app", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}
