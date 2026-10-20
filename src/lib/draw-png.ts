import type { ReactNode } from "react";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
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
 * The SVG becomes a PNG in resvg's native build, not its wasm one (owner chose ก, 2026-10-19,
 * mockup https://claude.ai/artifact/7HwmKFHWKpBXwWncZQU9Nj): the same resvg 2.6.2, its part of a
 * 1080×1920 table 33 ms against 55 (the whole picture 50 against 72), and Vercel's CPU was over its plan.
 * - satori's hb.wasm is still read off disk at run time: next.config.ts lists satori as external
 *   and traces hb.wasm, or the deployed function fails with ENOENT while working on a laptop;
 * - the machine's own fonts are never loaded: satori has turned every letter into a path, and
 *   scanning them made each picture four times slower (218 ms) than the wasm build.
 */

export type DrawFont = SatoriOptions["fonts"][number];

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

/**
 * The element as a PNG, `width` × `height`, in `fonts`; `scale` draws it that many times larger,
 * for a picture laid out at the page's own sizes that must stay sharp when zoomed on a phone.
 */
export async function drawPng(
  element: ReactNode, size: { width: number; height: number; scale?: number }, fonts: DrawFont[],
): Promise<Buffer> {
  const svg = await satori(element, { width: size.width, height: size.height, fonts, loadAdditionalAsset });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size.width * (size.scale ?? 1) }, font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

/**
 * How tall the element lays out at `width`, by satori itself: no height given, it sizes the
 * picture to the content. For a band whose wrapping cannot be known in advance — the canvases
 * are summed band by band, so the band has to be told its height before it is drawn.
 */
export async function laidOutHeight(element: ReactNode, width: number, fonts: DrawFont[]): Promise<number> {
  const svg = await satori(element, { width, fonts, loadAdditionalAsset });
  return Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
}

/**
 * The drop-in for next/og's ImageResponse that the routes used: the same element, size, fonts
 * and headers in, a PNG response out.
 */
export async function pngResponse(
  element: ReactNode,
  options: { width: number; height: number; scale?: number; fonts: DrawFont[]; headers?: Record<string, string> },
): Promise<Response> {
  const png = await drawPng(element, options, options.fonts);
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", ...options.headers },
  });
}
