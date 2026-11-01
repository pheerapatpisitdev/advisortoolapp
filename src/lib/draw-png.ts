import type { ReactNode } from "react";
import type { DrawFont } from "@/lib/draw/fonts";
import { drawPngThere, drawServiceSet, laidOutHeightThere } from "@/lib/draw/remote";

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
 *
 * Since 2026-11-02 the drawing itself happens on the draw service (src/lib/draw/remote.ts) when
 * it is set, the same satori and resvg on the same faces (src/lib/draw/core.ts); this server
 * draws only when the service is not set or did not answer.
 */

export type { DrawFont } from "@/lib/draw/fonts";

/** the draw service first; this server when it is not set or failed */
async function tryThere<T>(what: string, there: () => Promise<T>, here: () => Promise<T>): Promise<T> {
  if (drawServiceSet()) {
    try {
      return await there();
    } catch (e) {
      console.warn(`draw: ${what} drawn here, the service failed:`, e instanceof Error ? e.message : e);
    }
  }
  return here();
}

/**
 * The element as a PNG, `width` × `height`, in `fonts`; `scale` draws it that many times larger,
 * for a picture laid out at the page's own sizes that must stay sharp when zoomed on a phone.
 */
export async function drawPng(
  element: ReactNode, size: { width: number; height: number; scale?: number }, fonts: DrawFont[],
): Promise<Buffer> {
  return tryThere(
    "png",
    () => drawPngThere(element, size, fonts),
    async () => (await import("@/lib/draw/core")).drawPngHere(element as never, size, fonts),
  );
}

/**
 * How tall the element lays out at `width`, by satori itself: no height given, it sizes the
 * picture to the content. For a band whose wrapping cannot be known in advance — the canvases
 * are summed band by band, so the band has to be told its height before it is drawn.
 */
export async function laidOutHeight(element: ReactNode, width: number, fonts: DrawFont[]): Promise<number> {
  return tryThere(
    "height",
    () => laidOutHeightThere(element, width, fonts),
    async () => (await import("@/lib/draw/core")).laidOutHeightHere(element as never, width, fonts),
  );
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
