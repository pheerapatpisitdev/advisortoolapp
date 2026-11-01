/**
 * What the Cloudflare build has in place of the three things only a Node server can do here —
 * draw a picture (src/lib/draw/core.ts), crop one (content/crop-here.ts) and print a PDF in
 * Chrome (quote-pdf/print.ts): native modules and a browser that a Worker cannot load. There the
 * draw service (draw/server.ts) always does them; if it does not answer, the caller fails as it
 * would on any other error. next.config.ts puts this file in their place when CF_BUILD is set.
 */
const off = (what: string) => async (): Promise<never> => {
  throw new Error(`${what} is done by the draw service on Cloudflare, and it did not answer`);
};

export const drawPngHere = off("drawing a picture");
export const laidOutHeightHere = off("measuring a picture");
export const satoriFonts = off("loading fonts");
export const cropHere = off("cropping a picture");
export const printPdfHere = off("printing a PDF");
