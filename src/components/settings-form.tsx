"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, KeyRound, Loader2, Plug, Save, Terminal, Upload, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmButton } from "@/components/confirm-button";
import { postJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/format";
import type { AppSettings, Effort, ProviderMode, SettingsStatus } from "@/lib/types";

const MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Default · fast and capable" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "Most capable Opus" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Fastest, cheapest" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1", hint: "Top tier, slowest / priciest" },
];

const PROVIDERS: { value: ProviderMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: "auto", label: "Auto", icon: <Zap className="size-4" />, hint: "API key if set, otherwise Claude Code CLI" },
  { value: "api", label: "API key", icon: <KeyRound className="size-4" />, hint: "Anthropic API, billed per token" },
  { value: "cli", label: "Claude Code CLI", icon: <Terminal className="size-4" />, hint: "Uses your Claude subscription" },
];

export function SettingsForm({ initial }: { initial: SettingsStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [form, setForm] = useState<AppSettings>(initial.settings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [textNotes, setTextNotes] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(status.settings);
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const effective =
    form.provider === "api" || (form.provider === "auto" && status.hasApiKey) ? "API key" : "Claude Code CLI";

  async function save() {
    setSaving(true);
    try {
      const next = await postJson<SettingsStatus>("/api/settings", form, "PUT");
      setStatus(next);
      setForm(next.settings);
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (dirty) await save();
    setTesting(true);
    setTest(null);
    try {
      const r = await postJson<{ ok: boolean; label?: string; reply?: string; error?: string; ms: number; usage?: { costUsd: number } }>("/api/ai/test", {});
      setTest(
        r.ok
          ? { ok: true, text: `${r.label} replied “${r.reply}” in ${(r.ms / 1000).toFixed(1)}s · ${formatUsd(r.usage?.costUsd ?? 0)}` }
          : { ok: false, text: r.error ?? "Unknown error" },
      );
    } catch (err) {
      setTest({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function doImport(data: unknown) {
    try {
      const r = await postJson<{ imported: number }>(`/api/backup?mode=${importMode}`, data);
      toast.success(`Imported ${r.imported} project${r.imported === 1 ? "" : "s"}`);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onFile(file: File) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast.error("That file isn't valid JSON.");
      return;
    }
    if (importMode === "replace") setPendingImport(data);
    else await doImport(data);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">How MUNE TASKS talks to Claude, and your data.</p>
      </header>

      {/* ---------------- AI ---------------- */}
      <section className="surface space-y-6 rounded-2xl p-6">
        <div>
          <h2 className="font-semibold">AI provider</h2>
          <p className="text-sm text-muted-foreground">
            Currently using <span className="text-foreground">{effective}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="AI provider">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              role="radio"
              aria-checked={form.provider === p.value}
              onClick={() => set("provider", p.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                form.provider === p.value
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_-6px_rgb(59_130_246/0.7)]"
                  : "border-border bg-background/40 hover:border-primary/30",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#60a5fa]">{p.icon}</span> {p.label}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl bg-background/40 p-4 text-sm ring-1 ring-border">
          <StatusLine
            ok={status.hasApiKey}
            label="ANTHROPIC_API_KEY"
            detail={status.hasApiKey ? "found in .env.local" : "not set — add it to .env.local and restart"}
          />
          <StatusLine ok={!!status.cliPath} label="Claude Code CLI" detail={status.cliPath ?? "not found"} mono={!!status.cliPath} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              className="rounded-xl bg-background/50 font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  title={m.hint}
                  onClick={() => set("model", m.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs ring-1 transition-colors",
                    form.model === m.id
                      ? "bg-primary/15 text-[#93c5fd] ring-primary/50"
                      : "text-muted-foreground ring-border hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Effort</Label>
            <Select value={form.effort} onValueChange={(v) => set("effort", v as Effort)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low · fastest</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High · most thorough</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cli">
            Claude Code CLI path <span className="font-normal text-muted-foreground">(optional — auto-detected)</span>
          </Label>
          <Input
            id="cli"
            value={form.cliPath}
            onChange={(e) => set("cliPath", e.target.value)}
            placeholder="C:\Users\you\.local\bin\claude.exe"
            className="rounded-xl bg-background/50 font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!dirty || saving} className="rounded-xl">
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
          <Button variant="outline" onClick={runTest} disabled={testing} className="rounded-xl">
            {testing ? <Loader2 className="animate-spin" /> : <Plug />} Test connection
          </Button>
          {test && (
            <span className={cn("text-sm", test.ok ? "text-emerald-300" : "text-red-300")}>{test.text}</span>
          )}
        </div>
      </section>

      {/* ---------------- Data ---------------- */}
      <section className="surface mt-6 space-y-5 rounded-2xl p-6">
        <div>
          <h2 className="font-semibold">Backup</h2>
          <p className="text-sm text-muted-foreground">
            Everything lives in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{status.dbPath}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="rounded-xl">
            <a href="/api/backup" download>
              <Download /> Export all projects (JSON)
            </a>
          </Button>
        </div>
        <div className="space-y-2 rounded-xl bg-background/40 p-4 ring-1 ring-border">
          <p className="text-sm font-medium">Task lists as text</p>
          <p className="text-xs text-muted-foreground">
            Every active project&apos;s sections, tasks and subtasks, without done states. Handy for pasting into Figma. Each
            project page also has its own Export menu.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <a href={`/api/export/text?notes=${textNotes ? 1 : 0}`} download>
                <Download /> All lists (.txt)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <a href={`/api/export/text?format=md&notes=${textNotes ? 1 : 0}`} download>
                <Download /> All lists (.md)
              </a>
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={textNotes} onCheckedChange={setTextNotes} aria-label="Include notes" />
              Include notes
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={importMode} onValueChange={(v) => setImportMode(v as "merge" | "replace")}>
            <SelectTrigger className="w-64 rounded-xl" aria-label="Import mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Merge (keep existing projects)</SelectItem>
              <SelectItem value="replace">Replace everything</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
            <Upload /> Import backup…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Merge restores the backup&apos;s projects and overwrites any with the same id. Replace deletes all current projects first.
        </p>
      </section>

      <ConfirmButton
        open={pendingImport !== null}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title="Replace all projects?"
        description="Every current project will be deleted and replaced with the contents of the backup. Export a backup first if you're unsure."
        confirmLabel="Replace everything"
        destructive
        onConfirm={async () => {
          const data = pendingImport;
          setPendingImport(null);
          await doImport(data);
        }}
      />
    </div>
  );
}

function StatusLine({ ok, label, detail, mono }: { ok: boolean; label: string; detail: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <XCircle className="size-4 shrink-0 text-muted-foreground" />}
      <span className="font-medium">{label}</span>
      <span className={cn("min-w-0 truncate text-muted-foreground", mono && "font-mono text-xs")} title={detail}>
        {detail}
      </span>
    </div>
  );
}
