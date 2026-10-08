import "server-only";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TaskFile } from "./types";

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"]);

export function describeFile(row: { id: string; path: string; kind: "file" | "folder" }): TaskFile {
  const ext = row.kind === "folder" ? "" : path.extname(row.path).slice(1).toLowerCase();
  return {
    id: row.id,
    path: row.path,
    name: path.basename(row.path) || row.path,
    kind: row.kind,
    ext,
    isImage: IMAGE_EXTENSIONS.has(ext),
    exists: fs.existsSync(row.path),
  };
}

/** Validates a path typed or picked by the user; returns its absolute form and whether it is a folder. */
export function checkLocalPath(input: string): { path: string; kind: "file" | "folder" } {
  const cleaned = input.trim().replace(/^"(.*)"$/, "$1");
  if (!path.isAbsolute(cleaned)) throw new Error(`Not a full path: ${cleaned}`);
  const abs = path.resolve(cleaned);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`File not found: ${abs}`);
  }
  return { path: abs, kind: stat.isDirectory() ? "folder" : "file" };
}

/** In tests, record what would be opened instead of opening windows on the desktop. */
const DRY_RUN = process.env.MUNE_TASKS_DRY_OPEN === "1";

/** Opens a file in its default app (or a folder in Explorer). */
export function openInDefaultApp(p: string) {
  if (DRY_RUN) return console.log(`[dry-open] open ${p}`);
  // `explorer "<path>"` hands the file to its registered app, just like double-clicking it.
  spawn("explorer.exe", [`"${p}"`], { windowsVerbatimArguments: true, detached: true, stdio: "ignore" }).unref();
}

/** Opens Explorer with the file selected. */
export function revealInExplorer(p: string) {
  if (DRY_RUN) return console.log(`[dry-open] reveal ${p}`);
  spawn("explorer.exe", [`/select,"${p}"`], { windowsVerbatimArguments: true, detached: true, stdio: "ignore" }).unref();
}

/**
 * Shows the native Windows "Open" dialog on this PC and returns the chosen paths (empty if cancelled).
 * A browser file picker can't reveal real paths, but the local server can show the dialog itself.
 */
export function pickPaths(kind: "files" | "folder", title: string): Promise<string[]> {
  const safeTitle = title.replace(/['\r\n]/g, " ").slice(0, 120);
  const dialog =
    kind === "folder"
      ? `$d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${safeTitle}'; $d.UseDescriptionForTitle = $true;
         if ($d.ShowDialog($owner) -eq 'OK') { $paths = @($d.SelectedPath) }`
      : `$d = New-Object System.Windows.Forms.OpenFileDialog; $d.Multiselect = $true; $d.Title = '${safeTitle}';
         if ($d.ShowDialog($owner) -eq 'OK') { $paths = @($d.FileNames) }`;
  const script = `
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    # Node starts PowerShell hidden, and Windows applies that "hidden" flag to the first window shown.
    # An invisible, off-screen, top-most owner is shown first to absorb it; it also keeps the dialog
    # in front of the app window.
    $owner = New-Object System.Windows.Forms.Form -Property @{
      TopMost = $true; ShowInTaskbar = $false; FormBorderStyle = 'None'; Opacity = 0
      StartPosition = 'Manual'; Location = New-Object System.Drawing.Point(-32000, -32000); Size = New-Object System.Drawing.Size(1, 1)
    }
    $owner.Show(); $owner.Activate()
    $paths = @()
    ${dialog}
    $owner.Dispose()
    ConvertTo-Json -InputObject @($paths) -Compress`;
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true, timeout: 10 * 60_000, encoding: "utf8" },
      (err, stdout) => {
        if (err) return reject(new Error("The file picker couldn't be opened."));
        try {
          const out = JSON.parse(stdout.trim() || "[]");
          resolve((Array.isArray(out) ? out : [out]).filter((p): p is string => typeof p === "string" && p.length > 0));
        } catch {
          resolve([]);
        }
      },
    );
  });
}
