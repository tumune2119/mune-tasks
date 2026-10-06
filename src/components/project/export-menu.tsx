"use client";

import { useState } from "react";
import { Copy, Download, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportFileName, projectToText } from "@/lib/export-text";
import type { ProjectTree } from "@/lib/types";

function download(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the plan as a plain list (no tick state) — e.g. to paste into Figma. */
export function ExportMenu({ project }: { project: ProjectTree }) {
  const [notes, setNotes] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(projectToText(project, { notes }));
      toast.success("List copied — paste it into a Figma text box");
    } catch {
      toast.error("Couldn't access the clipboard. Use Download .txt instead.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <FileDown /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Task list as text (no done state)</DropdownMenuLabel>
        <DropdownMenuItem onSelect={copy}>
          <Copy /> Copy to clipboard
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => download(projectToText(project, { notes }), exportFileName(project.name, "txt"), "text/plain")}
        >
          <Download /> Download .txt
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            download(
              projectToText(project, { notes, format: "markdown" }),
              exportFileName(project.name, "md"),
              "text/markdown",
            )
          }
        >
          <FileText /> Download .md
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={notes}
          onCheckedChange={(v) => setNotes(v === true)}
          onSelect={(e) => e.preventDefault()} // keep the menu open while toggling
        >
          Include notes
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
