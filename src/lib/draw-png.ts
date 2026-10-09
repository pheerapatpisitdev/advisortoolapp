import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import satori, { type SatoriOptions } from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { googleFontSubset } from "@/lib/google-font";

/**
 * Every picture the app draws, drawn with satori 0.33 and resvg — not with next/og.
 *
 * next/og draws Thai wrongly: a tone mark over an upper vowel is not lifted, so the ้ of
 * "เบี้ย" sits down inside the ี, and in some faces vanishes ("เรื่อง" read "เรือง"). Stacking
 * those marks is the font's job and needs a shaping engine; the satori bundled inside next/og
 * has none, while satori 0.33 shapes with HarfBuzz. The posters moved first (2026-09-23,
 * poster-png.ts); the cards, tables and LINE menu followed when the owner saw the same fault
 * on the value table (2026-10-09).
 *
 * The wasm handling is Maryjane's, with its reasons kept:
 * - the wasm is read from a path built at runtime from process.cwd(), because a literal
 *   ".wasm" import or require.resolve is rewritten by the bundler and breaks in production;
 * - next.config.ts lists both packages as external and traces their .wasm files, or the
 *   deployed function fails with ENOENT on hb.wasm while working on a laptop;
 * - a failed load is forgotten rather than cached, and "Already initialized" (a dev reload
 *   re-running this module while the package keeps its own flag) counts as ready.
 */

export type DrawFont = SatoriOptions["fonts"][number];

export function isAlreadyInitialized(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Already initialized");
}

let wasm: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  const dir = join(process.cwd(), "node_modules", "@resvg", "resvg-wasm");
  wasm ??= initWasm(readFileSync(join(dir, "index_bg.wasm"))).catch((e) => {
    if (isAlreadyInitialized(e)) return;
    wasm = null;
    throw e;
  });
  return wasm;
}

/**
 * The faces next/og would have fetched for letters the card's own fonts lack — a ✦, a word of
 * Chinese — so moving off it does not turn them into empty boxes. The same Noto families it
 * asks Google for, cut to the letters needed.
 */
const FALLBACK: Record<string, string> = {
  "ja-JP": "Noto Sans JP", "ko-KR": "Noto Sans KR", "zh-CN": "Noto Sans SC", "zh-TW": "Noto Sans TC",
  "zh-HK": "Noto Sans HK", "th-TH": "Noto Sans Thai", "my-MM": "Noto Sans Myanmar",
  symbol: "Noto Sans Symbols 2", math: "Noto Sans Math", unknown: "Noto Sans",
};

/** An emoji as Twemoji draws it, the set next/og uses. */
async function emoji(segment: string): Promise<string | undefined> {
  const code = [...segment].map((c) => c.codePointAt(0)!.toString(16)).filter((c) => c !== "fe0f").join("-");
  try {
    const svg = await fetch(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`, { signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return undefined;
  }
}

const loadAdditionalAsset: SatoriOptions["loadAdditionalAsset"] = async (code, segment) => {
  if (code === "emoji") return (await emoji(segment)) ?? segment;
  const family = FALLBACK[code] ?? FALLBACK.unknown;
  return (await googleFontSubset(family, segment, "400")) ?? [];
};

/** The element as a PNG, `width` × `height`, in `fonts`. */
export async function drawPng(
  element: ReactNode, size: { width: number; height: number }, fonts: DrawFont[],
): Promise<Buffer> {
  await ensureWasm();
  const svg = await satori(element, { width: size.width, height: size.height, fonts, loadAdditionalAsset });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size.width } }).render().asPng());
}

/**
 * The drop-in for next/og's ImageResponse that the routes used: the same element, size, fonts
 * and headers in, a PNG response out.
 */
export async function pngResponse(
  element: ReactNode,
  options: { width: number; height: number; fonts: DrawFont[]; headers?: Record<string, string> },
): Promise<Response> {
  const png = await drawPng(element, options, options.fonts);
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", ...options.headers },
  });
}
