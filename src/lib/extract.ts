import "server-only";
import path from "node:path";
import type { ExtractedFile } from "./types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(
  (
    "md markdown txt text rst adoc csv tsv json jsonc yaml yml toml ini cfg conf env xml html htm css scss sass less " +
    "js jsx mjs cjs ts tsx mts cts vue svelte astro py rb php java kt kts scala go rs c h cpp cc hpp cs fs swift m mm " +
    "dart lua pl r jl sh bash zsh ps1 psm1 bat cmd sql graphql gql proto prisma dockerfile makefile gradle tf hcl log"
  ).split(" "),
);

function looksLikeText(buf: Buffer) {
  const sample = buf.subarray(0, 8000);
  return !sample.includes(0);
}

export async function extractText(name: string, buf: Buffer): Promise<ExtractedFile> {
  const ext = path.extname(name).slice(1).toLowerCase();
  const base = { name, size: buf.length };
  try {
    if (buf.length > MAX_FILE_BYTES) {
      return { ...base, text: "", error: "File is larger than 20 MB." };
    }
    if (ext === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n\n") : text).trim();
      if (!clean) return { ...base, text: "", error: "No extractable text (scanned PDF?)." };
      return { ...base, text: clean };
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { ...base, text: value.trim() };
    }
    // Any UTF-8 text file works (code, notes, configs); binaries are rejected.
    if (looksLikeText(buf)) {
      return { ...base, text: buf.toString("utf8").replace(/^﻿/, "") };
    }
    return {
      ...base,
      text: "",
      error: TEXT_EXTENSIONS.has(ext) ? "File looks binary — not supported." : `Unsupported file type (.${ext}).`,
    };
  } catch (err) {
    return { ...base, text: "", error: `Could not read file: ${(err as Error).message}` };
  }
}
