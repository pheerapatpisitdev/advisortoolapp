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

/**
 * A face for a script Plex has not got (a วิดีโอนำเสนอ clip in Chinese, Russian or Burmese, owner
 * 2026-10-15): fetched once a process for the letters asked, as the iHealthy card does. A clip
 * draws hundreds of frames from the same letters, so the last one asked is kept.
 */
let scriptFont: { key: string; faces: Promise<DrawFont[] | undefined> } | null = null;
function loadScriptFont(family: string, text: string) {
  const key = `${family}\n${[...new Set(text)].sort().join("")}`;
  if (scriptFont?.key !== key) {
    const faces = googleFontSubset(family, text).then((f) => {
      if (!f && scriptFont?.key === key) scriptFont = null;
      return f;
    });
    scriptFont = { key, faces };
  }
  return scriptFont.faces;
}

/**
 * The handwriting face of คลิปเล่าเรื่อง's titles (Mali): fetched once a process for the letters
 * asked, the last ones kept. Not having it is not a failure: the titles fall back to Plex.
 */
let handFont: { key: string; faces: Promise<DrawFont[] | undefined> } | null = null;
function loadHandFont(text: string) {
  const key = [...new Set(text)].sort().join("");
  if (handFont?.key !== key) {
    const faces = googleFontSubset("Mali", text).then((f) => {
      if (!f && handFont?.key === key) handFont = null;
      return f;
    });
    handFont = { key, faces };
  }
  return handFont.faces;
}

export async function renderPng(
  element: ReactNode,
  size: { width: number; height: number },
  opts: { pen?: boolean; script?: { family: string; text: string }; hand?: string } = {},
): Promise<Buffer> {
  const [f, pen, script, hand] = await Promise.all([
    loadFonts(),
    opts.pen ? loadPenFont() : undefined,
    opts.script ? loadScriptFont(opts.script.family, opts.script.text) : undefined,
    opts.hand ? loadHandFont(opts.hand) : undefined,
  ]);
  // a clip in a script without its face would be boxes where the words go: no picture rather than that
  if (opts.script && !script) throw new Error(`font ${opts.script.family} not loaded`);
  return drawPng(element, size, [
    { name: "Plex", data: f.regular, weight: 400, style: "normal" },
    { name: "Plex", data: f.semibold, weight: 600, style: "normal" },
    ...(pen ?? []),
    ...(script ?? []),
    ...(hand ?? []),
  ]);
}
