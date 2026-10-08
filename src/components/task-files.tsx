"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, File, FileImage, FileText, Folder, FolderOpen, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openFile, revealFile } from "@/lib/client/files";
import { cn } from "@/lib/utils";
import type { TaskFile } from "@/lib/types";

const DOC_EXT = new Set(["pdf", "doc", "docx", "txt", "md", "rtf", "odt", "xls", "xlsx", "csv", "ppt", "pptx", "key", "pages"]);

function FileIcon({ f, className }: { f: TaskFile; className?: string }) {
  if (f.kind === "folder") return <Folder className={className} />;
  if (f.isImage) return <FileImage className={className} />;
  if (DOC_EXT.has(f.ext)) return <FileText className={className} />;
  return <File className={className} />;
}

/**
 * Files linked to a task. Click opens it in its default app; the folder icon shows it in Explorer.
 * Images show a small thumbnail read from where the file lives.
 */
export function TaskFiles({
  files,
  onRemove,
  className,
}: {
  files: TaskFile[];
  onRemove?: (fileId: string) => void;
  className?: string;
}) {
  if (!files.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} data-testid="task-files">
      {files.map((f) => (
        <li
          key={f.id}
          className={cn(
            "group/file flex max-w-64 items-center gap-1.5 rounded-lg bg-secondary/70 py-1 pr-1 pl-1.5 text-xs ring-1 ring-border",
            !f.exists && "ring-amber-400/40",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openFile(f.id);
                }}
                className="flex min-w-0 items-center gap-1.5 rounded text-left hover:text-white"
                aria-label={`Open ${f.name}`}
              >
                {f.isImage && f.exists ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local file preview, not a static asset
                  <img
                    src={`/api/files/${f.id}/preview`}
                    alt=""
                    className="size-6 shrink-0 rounded object-cover ring-1 ring-border"
                    loading="lazy"
                  />
                ) : (
                  <FileIcon f={f} className="size-3.5 shrink-0 text-[#60a5fa]" />
                )}
                <span className="truncate">{f.name}</span>
                {!f.exists && <AlertTriangle className="size-3.5 shrink-0 text-amber-300" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm break-all">
              {f.exists ? f.path : `Missing — moved or deleted? ${f.path}`}
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              revealFile(f.id);
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Show ${f.name} in Explorer`}
            title="Show in Explorer"
          >
            {f.kind === "folder" ? <ExternalLink className="size-3.5" /> : <FolderOpen className="size-3.5" />}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(f.id);
              }}
              className="rounded p-0.5 text-muted-foreground opacity-0 group-hover/file:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
              aria-label={`Remove ${f.name} from this task`}
              title="Remove link (the file itself is kept)"
            >
              <X className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Paste one or more full paths (one per line), e.g. from Explorer's "Copy as path". */
export function AttachByPathDialog({
  open,
  onOpenChange,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttach: (paths: string[]) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const paths = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^"(.*)"$/, "$1"))
    .filter(Boolean);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setText("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link files by path</DialogTitle>
          <DialogDescription>
            One full path per line. In Explorer, Shift + right-click a file → <em>Copy as path</em>. Files stay where they are.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"C:\\Users\\you\\Pictures\\reference.png\nD:\\Specs\\brief.pdf"}
          className="min-h-28 rounded-xl font-mono text-xs"
        />
        <DialogFooter>
          <Button
            className="rounded-xl"
            disabled={!paths.length}
            onClick={async () => {
              await onAttach(paths);
              setText("");
              onOpenChange(false);
            }}
          >
            Link {paths.length > 1 ? `${paths.length} files` : "file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
