import { paidConstantly } from "@/app/api/card/table/pen-notes";
import type { QuoteVideoFacts } from "./script";
import { LEAD, wordTimes } from "./timeline";

/**
 * The pen notes of the value scene (owner, 2026-10-13, mockup
 * https://claude.ai/artifact/6BpAd6CcUNKvB4REZA8GkH): the marks the value-table card carries
 * (src/app/api/card/table/pen-notes.ts), written into the clip one at a time as the voice reaches
 * them — on the panning table in the classic style, on the line chart in the Motion one.
 *
 * This file is what both styles share: which notes a plan earns (the card's rules — a premium
 * that moves is not "คงที่", a plan paid to the end has nothing to stop), when each is written,
 * and the hand-drawn shapes, as polylines whose length is known so a stroke can be drawn out.
 */

export type PenBeat = "steady" | "stop" | "growth" | "breakEven" | "gain";

export const STEADY_WORD = "เบี้ยคงที่";
export const STOP_WORD = "หยุดส่งเบี้ย";
export const GROWTH_WORDS = ["เงินโตทุกปี", "เวนคืน", "เมื่อฉุกเฉิน"];
export const GAIN_WORDS = ["เบี้ยไม่ทิ้งเปล่า", "สามารถเก็บเป็นเงินสด", "หลังเกษียณได้"];
export const BREAK_EVEN_WORD = "จุดคุ้มทุน";
/** every letter the pen face writes, for cutting the font down to them */
export const PEN_TEXT = [STEADY_WORD, STOP_WORD, ...GROWTH_WORDS, ...GAIN_WORDS, BREAK_EVEN_WORD, "อายุ 0123456789"].join("");

/** a year anything is paid in: the premium, or the riders on a table quoted with them */
const pays = (r: NonNullable<QuoteVideoFacts["rows"]>[number]) => r.due !== "—" || (r.rider !== undefined && r.rider !== "—");

/** the last year anything is paid, or -1 */
export function lastPaying(f: QuoteVideoFacts): number {
  const rows = f.rows ?? [];
  if (!rows.length || !pays(rows[0])) return -1;
  let last = 0;
  while (last + 1 < rows.length && pays(rows[last + 1])) last += 1;
  return last;
}

/** The notes this plan's table earns, in the order the voice tells them. */
export function penBeats(f: QuoteVideoFacts): PenBeat[] {
  const rows = f.rows ?? [];
  if (rows.length < 2) return [];
  const be = f.breakEven?.index ?? -1;
  const last = lastPaying(f);
  const out: PenBeat[] = [];
  if (paidConstantly({ rows }) !== undefined) out.push("steady");
  if (last >= 0 && last < rows.length - 1) out.push("stop");
  if (be >= 4) out.push("growth");
  if (be > 0) out.push("breakEven");
  if (be >= 0 && rows.length - (be + 1) >= 4) out.push("gain");
  return out;
}

/**
 * The word each note waits for in the value line (script.ts): "ออมครบตอนอายุ 53", "เงินก็ยังโต",
 * "พออายุ 64", "มากกว่าที่ออมไป". Should a line ever be worded otherwise, a note falls back to its
 * share of the line.
 */
const CUE: Record<PenBeat, RegExp | undefined> = { steady: undefined, stop: /ครบ/, growth: /โต/, breakEven: /^พออายุ|ขอคืน/, gain: /^มากกว่า/ };
const SHARE: Record<PenBeat, number> = { steady: 0.03, stop: 0.25, growth: 0.4, breakEven: 0.55, gain: 0.85 };

/** When the voice reaches each note, in scene seconds, never earlier than the one before. */
export function beatCues(beats: PenBeat[], voice: string, voiceSec: number): { beat: PenBeat; at: number }[] {
  const words = wordTimes(voice, voiceSec);
  let from = 0;
  let prev = 0;
  return beats.map((beat) => {
    const re = CUE[beat];
    const k = re ? words.findIndex((w, i) => i >= from && re.test(w.word)) : -1;
    if (k >= 0) from = k + 1;
    const at = Math.max(prev, k >= 0 ? words[k].from : LEAD + SHARE[beat] * voiceSec);
    prev = at;
    return { beat, at };
  });
}

// ── the shapes, as polylines a stroke can be drawn along

export type Pt = [number, number];
export interface Stroke { d: string; len: number }

const f1 = (n: number) => n.toFixed(1);
export function poly(pts: Pt[]): Stroke {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { d: "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(" L"), len: Math.ceil(len) + 2 };
}

/** a quadratic curve from p0 through control c to p1, as points (p0 left out) */
function quad(p0: Pt, c: Pt, p1: Pt, n = 16): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]] as Pt;
  });
}

/** the card's round curly brace, `h` tall at x, its point to the left (pen-notes.ts brace) */
export function braceLeft(x: number, y: number, h: number, w = 22): Stroke {
  const mid = y + h / 2;
  const r = Math.min(14, h / 8);
  const pts: Pt[] = [[x + w, y]];
  pts.push(...quad(pts[pts.length - 1], [x + w * 0.25, y], [x + w * 0.35, y + h / 4]));
  pts.push(...quad(pts[pts.length - 1], [x + w * 0.45, mid - r], [x, mid]));
  pts.push(...quad(pts[pts.length - 1], [x + w * 0.45, mid + r], [x + w * 0.35, y + (h * 3) / 4]));
  pts.push(...quad(pts[pts.length - 1], [x + w * 0.25, y + h], [x + w, y + h]));
  return poly(pts);
}

/** the same brace lying under something `w` wide at y, its point down */
export function braceDown(x: number, y: number, w: number, h = 22): Stroke {
  const mid = x + w / 2;
  const r = Math.min(14, w / 8);
  const pts: Pt[] = [[x, y]];
  pts.push(...quad(pts[pts.length - 1], [x, y + h * 0.75], [x + w / 4, y + h * 0.65]));
  pts.push(...quad(pts[pts.length - 1], [mid - r, y + h * 0.55], [mid, y + h]));
  pts.push(...quad(pts[pts.length - 1], [mid + r, y + h * 0.55], [x + (w * 3) / 4, y + h * 0.65]));
  pts.push(...quad(pts[pts.length - 1], [x + w, y + h * 0.75], [x + w, y]));
  return poly(pts);
}

/** a loop round something, as a hand draws one: begun upper left, run a little past the start */
export function ring(cx: number, cy: number, rx: number, ry: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = -2.0 + (i / 64) * (Math.PI * 2 + 0.55);
    const k = 1 + 0.05 * Math.sin(i / 5) + (i > 56 ? 0.06 : 0);
    pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
  }
  return poly(pts);
}

/** an arrowhead at (x, y), pointing along the line from (fx, fy) */
export function arrowHead(x: number, y: number, fx: number, fy: number, len = 22): Stroke {
  const a = Math.atan2(y - fy, x - fx);
  const wing = (d: number): Pt => [x - len * Math.cos(a + d), y - len * Math.sin(a + d)];
  return poly([wing(0.45), [x, y], wing(-0.45)]);
}

/** a gentle curve from one point to another through a control point, with its head */
export function arrow(from: Pt, c: Pt, to: Pt, head = 22): Stroke[] {
  return [poly([from, ...quad(from, c, to, 20)]), arrowHead(to[0], to[1], c[0], c[1], head)];
}

/** a line drawn along points, with a head at its end */
export function along(pts: Pt[], head = 24): Stroke[] {
  const a = pts[pts.length - 1];
  const b = pts[Math.max(0, pts.length - 3)];
  return [poly(pts), arrowHead(a[0], a[1], b[0], b[1], head)];
}

/**
 * How far along a note is at progress p (0 → 1): its strokes drawn one after another over the
 * first 70%, its words faded in from 50%.
 */
export function noteProgress(strokes: Stroke[], p: number): { strokes: number[]; words: number } {
  const total = strokes.reduce((n, s) => n + s.len, 0) || 1;
  const drawn = Math.min(1, p / 0.7) * total;
  let acc = 0;
  const each = strokes.map((s) => {
    const q = Math.max(0, Math.min(1, (drawn - acc) / s.len));
    acc += s.len;
    return q;
  });
  return { strokes: each, words: Math.max(0, Math.min(1, (p - 0.5) / 0.5)) };
}
