import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { drawPng, type DrawFont } from "@/lib/draw-png";
import { googleFontSubset } from "@/lib/google-font";
import { PEN_TEXT } from "@/lib/quote-video/pen";

/**
 * Draws a poster element to PNG in IBM Plex Sans Thai. The drawing itself — satori 0.33 and
 * resvg rather than next/og, and why — is src/lib/draw-png.ts, which every picture now shares.
 */

export { isAlreadyInitialized } from "@/lib/draw-png";

const FONT_DIR = join(process.cwd(), "src/app/api/card");

let fonts: Promise<{ regular: Buffer; semibold: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "IBMPlexSansThai-Regular.ttf")),
    readFile(join(FONT_DIR, "IBMPlexSansThai-SemiBold.ttf")),
  ]).then(([regular, semibold]) => ({ regular, semibold })).catch((e) => {
    fonts = null;
    throw e;
  });
  return fonts;
}

/**
 * The handwriting face of the clip's pen notes (quote-video/pen.ts), the card's own: fetched once
 * a process, cut to the notes' letters. Without it the notes are written in Plex.
 */
let penFont: Promise<DrawFont[] | undefined> | null = null;
function loadPenFont() {
  penFont ??= googleFontSubset("Sriracha", PEN_TEXT, "400").then((f) => {
    if (!f) penFont = null;
    return f;
  });
  return penFont;
}

export async function renderPng(element: ReactNode, size: { width: number; height: number }, opts: { pen?: boolean } = {}): Promise<Buffer> {
  const [f, pen] = await Promise.all([loadFonts(), opts.pen ? loadPenFont() : undefined]);
  return drawPng(element, size, [
    { name: "Plex", data: f.regular, weight: 400, style: "normal" },
    { name: "Plex", data: f.semibold, weight: 600, style: "normal" },
    ...(pen ?? []),
  ]);
}
