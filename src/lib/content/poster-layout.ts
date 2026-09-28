import type { BlockKind, PosterSpec } from "./poster";
import { atTop, logoBox, type LogoSpot } from "./logo";

/**
 * The poster's geometry, ported from Maryjane's poster-render.tsx with its lessons kept:
 *
 * - The drawing library reads a Thai sentence as one unbreakable word — there are no spaces to
 *   break at — and a long headline is silently cropped. withBreaks() puts a zero-width space
 *   between the words Intl.Segmenter finds, which draws as nothing and lets lines wrap.
 * - It also never says when text overflows the canvas; the last lines simply vanish. So the
 *   height is estimated first and the whole poster scaled down until it fits (fitScale).
 * - Every measure is tuned at 1080 wide and scaled by k for other canvases.
 */

export const BASE_WIDTH = 1080;
const PADDING = 90;
export const LINE_HEIGHT = 1.3;
/** a Thai glyph's width against its font size, measured roughly on IBM Plex Sans Thai */
const GLYPH = 0.55;

export const FONT_SIZE: Record<BlockKind, number> = { badge: 34, headline: 84, sub: 44, footer: 32 };

export interface Canvas {
  width: number;
  height: number;
}

export interface Metrics {
  k: number;
  padX: number;
  padTop: number;
  padBottom: number;
  gap: number;
  usableWidth: number;
  usableHeight: number;
}

/**
 * A story is 9:16 and Facebook lays its own name and buttons over the top and bottom of one,
 * so a tall canvas keeps its words out of those bands — Maryjane's SAFE_INSETS for stories.
 */
/**
 * `logo`: a logo's spot. The words keep clear of it — the margin at its edge grows by the logo's
 * box and a gap — and the logo itself sits at the edge the margin had before (logoAt).
 */
export function metrics(c: Canvas, logo?: LogoSpot | null): Metrics {
  const k = c.width / BASE_WIDTH;
  const tall = c.height / c.width > 1.5;
  const padX = Math.round(PADDING * k);
  const room = logo ? logoBox(c.width).h + Math.round(22 * k) : 0;
  const padTop = (tall ? Math.round(c.height * 0.14) : padX) + (logo && atTop(logo) ? room : 0);
  const padBottom = (tall ? Math.round(c.height * 0.2) : padX) + (logo && !atTop(logo) ? room : 0);
  return {
    k, padX, padTop, padBottom,
    gap: Math.round(22 * k),
    usableWidth: c.width - 2 * padX,
    usableHeight: c.height - padTop - padBottom,
  };
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("th", { granularity: "word" })
  : null;

export function withBreaks(text: string): string {
  if (!segmenter) return text;
  return Array.from(segmenter.segment(text), (s) => s.segment).join("​");
}

export function fontSize(kind: BlockKind, m: Metrics, scale: number): number {
  return Math.max(14, Math.round(FONT_SIZE[kind] * m.k * scale));
}

function estimateHeight(p: PosterSpec, m: Metrics, scale: number): number {
  return p.blocks.reduce((sum, b, i) => {
    const size = fontSize(b.kind, m, scale);
    const perLine = Math.max(1, Math.floor(m.usableWidth / (size * GLYPH)));
    const lines = Math.max(1, Math.ceil([...b.text].length / perLine));
    // a badge sits in a pill, which adds its own padding above and below
    const pill = b.kind === "badge" ? size * 0.6 : 0;
    return sum + size * LINE_HEIGHT * lines + pill + (i === 0 ? 0 : m.gap);
  }, 0);
}

/** 1 when the poster fits as designed; otherwise the factor, stepped down, that makes it fit. */
/** `withLogo`: false where the canvas given is a share of the poster that the logo's margin is already out of */
export function fitScale(p: PosterSpec, c: Canvas, withLogo = true): number {
  const m = metrics(c, withLogo ? p.logo?.spot : null);
  let scale = 1;
  // stepped rather than solved: shrinking changes how many lines each block wraps to
  for (let i = 0; i < 20 && estimateHeight(p, m, scale) > m.usableHeight; i++) scale *= 0.9;
  return scale;
}

/** Where a logo's box goes on the canvas: its edges the words' margins before the logo moved them. */
export function logoAt(c: Canvas, spot: LogoSpot): { left: number; top: number; w: number; h: number; align: "flex-start" | "center" | "flex-end" } {
  const m = metrics(c);
  const { w, h } = logoBox(c.width);
  const col = spot[1];
  const left = col === "l" ? m.padX : col === "c" ? Math.round((c.width - w) / 2) : c.width - m.padX - w;
  const top = atTop(spot) ? m.padTop : c.height - m.padBottom - h;
  return { left, top, w, h, align: col === "l" ? "flex-start" : col === "c" ? "center" : "flex-end" };
}
