/**
 * The colours a picture is made of, counted from its pixels.
 *
 * Done in the browser, where the picture is drawn to a canvas for shrinking, and sent with it:
 * a model asked for the hex codes of a picture gives rough guesses, and these are measured. The
 * model is then asked only what each colour is used for. Pure — the browser counts, the route
 * checks what it was sent (parseSwatches), the prompt writer reads them.
 */

export interface Swatch {
  /** "#RRGGBB", in capitals */
  hex: string;
  /** whole percent of the picture's opaque pixels, 1–100 */
  share: number;
}

export const MAX_SWATCHES = 6;

/** colours closer than this (straight-line distance in RGB, of 441 at most) are one colour */
const MERGE_DISTANCE = 40;

interface Sum { n: number; r: number; g: number; b: number }
const centre = (s: Sum): [number, number, number] => [s.r / s.n, s.g / s.n, s.b / s.n];

const hexOf = ([r, g, b]: [number, number, number]) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/**
 * The picture's main colours, largest first, from RGBA pixels: pixels are counted in 4096 bins,
 * the fullest bins become colours, and a bin close to one already taken joins it (and so does
 * any bin left over once `max` are taken, so the shares still add up to the whole). A colour
 * under 1 percent is left out. Transparent pixels are not counted.
 */
export function dominantColors(rgba: ArrayLike<number>, max = MAX_SWATCHES): Swatch[] {
  const bins = new Map<number, Sum>();
  let total = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
    total++;
  }
  if (!total) return [];
  const taken: Sum[] = [];
  for (const bin of [...bins.values()].sort((a, b) => b.n - a.n)) {
    const [r, g, b] = centre(bin);
    let nearest = -1;
    let best = Infinity;
    taken.forEach((t, i) => {
      const [tr, tg, tb] = centre(t);
      const d = Math.hypot(tr - r, tg - g, tb - b);
      if (d < best) { best = d; nearest = i; }
    });
    if (nearest >= 0 && (best < MERGE_DISTANCE || taken.length >= max)) {
      const t = taken[nearest];
      t.n += bin.n; t.r += bin.r; t.g += bin.g; t.b += bin.b;
    } else {
      taken.push({ ...bin });
    }
  }
  return taken
    .map((t) => ({ hex: hexOf(centre(t)), share: Math.round((t.n / total) * 100) }))
    .filter((s) => s.share >= 1)
    .sort((a, b) => b.share - a.share);
}

/** the swatches a request carries, with whatever is not one left out: at most six, "#RRGGBB" and a share of 0–100 */
export function parseSwatches(value: unknown): Swatch[] {
  if (!Array.isArray(value)) return [];
  const out: Swatch[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const { hex, share } = v as { hex?: unknown; share?: unknown };
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
    if (typeof share !== "number" || !Number.isFinite(share) || share < 0 || share > 100) continue;
    out.push({ hex: hex.toUpperCase(), share: Math.round(share) });
  }
  return out.slice(0, MAX_SWATCHES);
}
