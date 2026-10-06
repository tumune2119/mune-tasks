"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, FileText, Loader2, Paperclip, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtractedFile } from "@/lib/types";

export interface UploadEntry extends ExtractedFile {
  key: string;
  status: "loading" | "ready" | "error";
}

const ACCEPT =
  ".md,.markdown,.txt,.pdf,.docx,.json,.yaml,.yml,.toml,.csv,.html,.css,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.cs,.php,.swift,.sql,.sh,.ps1,.xml,.vue,.svelte";

export function FileDropzone({
  files,
  onChange,
}: {
  files: UploadEntry[];
  onChange: (update: (prev: UploadEntry[]) => UploadEntry[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    const entries: UploadEntry[] = arr.map((f) => ({
      key: `${f.name}-${f.size}-${crypto.randomUUID()}`,
      name: f.name,
      size: f.size,
      text: "",
      status: "loading",
    }));
    onChange((prev) => [...prev, ...entries]);

    const form = new FormData();
    arr.forEach((f) => form.append("files", f));
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { files: results } = (await res.json()) as { files: ExtractedFile[] };
      onChange((prev) =>
        prev.map((e) => {
          const i = entries.findIndex((n) => n.key === e.key);
          if (i === -1) return e;
          const r = results[i];
          return { ...e, text: r.text, error: r.error, status: r.error ? "error" : "ready" };
        }),
      );
    } catch (err) {
      const keys = new Set(entries.map((e) => e.key));
      onChange((prev) =>
        prev.map((e) => (keys.has(e.key) ? { ...e, status: "error", error: (err as Error).message } : e)),
      );
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-all",
          over
            ? "border-[#60a5fa] bg-primary/10 shadow-[0_0_24px_-6px_rgb(59_130_246/0.7)]"
            : "border-[rgb(96_165_250/0.25)] bg-background/40 hover:border-[rgb(96_165_250/0.5)] hover:bg-primary/5",
        )}
      >
        <Paperclip className="size-5 text-[#60a5fa]" />
        <p className="text-sm">
          <span className="font-medium text-foreground">Drop files here</span>
          <span className="text-muted-foreground"> or click to browse</span>
        </p>
        <p className="text-xs text-muted-foreground">.md, .txt, code, .pdf, .docx — used as context</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <ul className="mt-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {files.map((f) => (
            <motion.li
              key={f.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2.5 rounded-lg bg-secondary/60 px-3 py-2 text-sm ring-1 ring-border">
                {f.status === "loading" ? (
                  <Loader2 className="size-4 animate-spin text-[#60a5fa]" />
                ) : f.status === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : (
                  <FileText className="size-4 text-[#60a5fa]" />
                )}
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className={cn("shrink-0 text-xs", f.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                  {f.status === "error"
                    ? f.error
                    : f.status === "loading"
                      ? "Extracting…"
                      : `${formatBytes(f.size)} · ${f.text.length.toLocaleString()} chars`}
                </span>
                <button
                  type="button"
                  onClick={() => onChange((prev) => prev.filter((p) => p.key !== f.key))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
