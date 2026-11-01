import { readFile } from "node:fs/promises";
import path from "node:path";
import satori, { type SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";
import { googleFontSubset } from "@/lib/google-font";
import { isFontFile, type DrawFont, type FontFile } from "@/lib/draw/fonts";

/**
 * satori and resvg themselves: the part of every picture that costs CPU.
 *
 * Run in two places with the same code — the Cloud Run service advisortool-draw (draw/server.ts,
 * Cloudflare move step 1, owner chose ก 2026-11-02), and the web app's own server when the
 * service is not set or does not answer (src/lib/draw-png.ts). Only ever loaded with `import()`
 * from the app, so the native resvg is not in a page that never draws locally.
 *
 * Why satori 0.33 and resvg rather than next/og, and resvg's native build, see draw-png.ts.
 */

type SatoriFont = SatoriOptions["fonts"][number];

/** where the card faces are: beside the quote card's route in the app, /app/fonts in the service */
const FONT_DIR = process.env.DRAW_FONT_DIR ?? path.join(process.cwd(), "src/app/api/card");

const faces = new Map<string, Promise<Buffer>>();
function faceBytes(f: FontFile): Promise<Buffer> {
  let bytes = faces.get(f.file);
  if (!bytes) {
    bytes = readFile(path.join(FONT_DIR, path.basename(f.file)));
    bytes.catch(() => faces.delete(f.file));
    faces.set(f.file, bytes);
  }
  return bytes;
}

/** the fonts as satori takes them, a face named by its file read off disk (once a process) */
export async function satoriFonts(fonts: DrawFont[]): Promise<SatoriFont[]> {
  return Promise.all(fonts.map(async (f) => (isFontFile(f.data) ? { ...f, data: await faceBytes(f.data) } : f) as SatoriFont));
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

/** satori takes a React element or a plain { type, props } tree alike */
type Drawable = Parameters<typeof satori>[0];

export interface DrawSize { width: number; height: number; scale?: number }

/** The element as a PNG, `width` × `height`; `scale` draws it that many times larger. */
export async function drawPngHere(element: Drawable, size: DrawSize, fonts: DrawFont[]): Promise<Buffer> {
  const svg = await satori(element, { width: size.width, height: size.height, fonts: await satoriFonts(fonts), loadAdditionalAsset });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size.width * (size.scale ?? 1) }, font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

/** How tall the element lays out at `width`, by satori itself. */
export async function laidOutHeightHere(element: Drawable, width: number, fonts: DrawFont[]): Promise<number> {
  const svg = await satori(element, { width, fonts: await satoriFonts(fonts), loadAdditionalAsset });
  return Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
}
