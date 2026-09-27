import { POSTER_THEMES } from "@/lib/card-theme";
import type { Box } from "@/lib/content/claim";

/**
 * What covers a name on a claim paper (owner, 2026-09-25: "สติ๊กเกอร์น่ารัก" in place of black
 * bars). Each is an opaque pastel pill carrying a row of emoji — an animal and its little
 * friend, taking turns across it — with a different pair and colour down the paper. It carried
 * a word too ("ความลับนะ", "ส่วนตัวจ้า") until the owner asked for emoji only (2026-09-27): the
 * words read as captions on someone's papers, the emoji read as stickers.
 *
 * Still a cover first: the pill is laid a little wider and taller than the box, by enough that
 * its rounded corners reach past the box's own corners, so nothing under it shows at the edge.
 * The page shows the same pill the canvas burns in, from the same numbers.
 */

/** the pastel poster tones; their colours live in card-theme.ts with every other drawn colour */
const TONES = ["blush", "sunny", "sky", "mint", "lavender"] as const;

/** an animal and its little friend; a row alternates the two */
const PAIRS: readonly (readonly [string, string])[] = [
  ["🐰", "🌸"],
  ["🐻", "💛"],
  ["🐱", "💕"],
  ["🐥", "⭐"],
  ["🙈", "💖"],
  ["🐼", "🎀"],
  ["🦄", "🌈"],
  ["🐶", "🐾"],
];

export interface Sticker {
  fill: string;
  edge: string;
  pair: readonly [string, string];
}

/** the i-th sticker on a paper: tones and pairs step at different paces, so neighbours differ in both */
export function stickerAt(i: number): Sticker {
  const t = POSTER_THEMES[TONES[i % TONES.length]];
  return { fill: t.from, edge: t.to, pair: PAIRS[(i * 3) % PAIRS.length] };
}

/**
 * The emoji laid across a pill w×h: as large as the pill's height allows, as many as fit the
 * width at that size — one on a small square, a row of them along a name — the pair taking
 * turns, and a single emoji never smaller than it can be seen.
 */
export function emojiRow(s: Sticker, w: number, h: number): { text: string; size: number } {
  const size = Math.max(4, Math.min(h * 0.62, w * 0.7));
  // an emoji is about as wide as it is tall; a little air between them
  const count = Math.max(1, Math.min(12, Math.floor((w * 0.9) / (size * 1.2))));
  const text = Array.from({ length: count }, (_, k) => s.pair[k % 2]).join("");
  return { text, size };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

/**
 * A box as the pill drawn over it, in pixels of a W×H paper. The corner radius is a third of
 * the box's short side; a quarter-circle corner falls short of the square corner by 0.29 of
 * its radius, so each side reaches out by 0.3 of that radius, and a pixel more.
 */
export function stickerRect(b: Box, W: number, H: number): Rect {
  const x0 = Math.floor(b.x * W);
  const y0 = Math.floor(b.y * H);
  const x1 = Math.ceil((b.x + b.w) * W);
  const y1 = Math.ceil((b.y + b.h) * H);
  const radius = Math.max(2, Math.min(x1 - x0, y1 - y0) / 3);
  // the corner falls short by (1 − 1/√2)·radius ≈ 0.293·radius of the radius it is drawn with
  const pad = Math.ceil(radius * 0.3) + 1;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad, radius };
}

/** the colour emoji faces of each system, ahead of the page's own family */
const EMOJI_FONTS = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`;

/** The pill burnt into a canvas. `font` is the page's own family, behind the emoji faces. */
export function drawSticker(g: CanvasRenderingContext2D, b: Box, i: number, W: number, H: number, font: string) {
  const s = stickerAt(i);
  const r = stickerRect(b, W, H);
  g.save();
  g.beginPath();
  g.roundRect(r.x, r.y, r.w, r.h, r.radius);
  g.fillStyle = s.fill;
  g.fill();
  g.lineWidth = Math.max(1.5, r.h * 0.06);
  g.strokeStyle = s.edge;
  g.stroke();

  const row = emojiRow(s, r.w, r.h);
  let size = row.size;
  g.font = `${size}px ${EMOJI_FONTS}, ${font}`;
  // the estimate is the device's to correct: a face drawn wider than guessed is shrunk to fit
  const width = g.measureText(row.text).width;
  if (width > r.w * 0.92) {
    size *= (r.w * 0.92) / width;
    g.font = `${size}px ${EMOJI_FONTS}, ${font}`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(row.text, r.x + r.w / 2, r.y + r.h / 2 + size * 0.05);
  g.restore();
}
