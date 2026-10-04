/**
 * The four dimensions of an ad campaign — hook, persona, angle, style — and the queue that walks
 * their combinations. Pure: no database, no network. A combination is told apart by its four
 * texts (`combo`), never by position, so a queue survives the owner editing or reordering the
 * dimensions after some pieces were already made.
 */

import { ANGLE_BANK } from "@/lib/content/ads";
import type { Dimension, Dimensions } from "@/lib/ads/campaign-store";
import { DIMENSION_MAX, DIMENSION_NOTE_MAX, dimensionText } from "@/lib/ads/dimension-edit";

export type Variant = { hook: string; persona: string; angle: string; style: string; combo: string };

// the same limits the page edits to (dimension-edit.ts), so what it counts is what is kept
const NOTE_MAX = DIMENSION_NOTE_MAX;
const HOOKS_MAX = DIMENSION_MAX.hooks;
const OTHERS_MAX = DIMENSION_MAX.personas;

export function totalCombos(d: Dimensions): number {
  return d.hooks.length * d.personas.length * d.angles.length * d.styles.length;
}

function comboOf(hook: string, persona: string, angle: string, style: string): string {
  return `${hook}|${persona}|${angle}|${style}`;
}

/**
 * Every combination exactly once, in an order that keeps neighbours unlike each other.
 *
 * Greedy walk from the first combination: each step takes the unused combination that differs
 * from the previous one in the most dimensions; among those, the one whose values have been
 * used least so far (so every hook, persona, angle and style comes round before any repeats);
 * among those, the lowest index. Ties are broken by index only, so the same input always gives
 * the same order.
 */
export function orderedVariants(d: Dimensions): Variant[] {
  const sizes = [d.hooks.length, d.personas.length, d.angles.length, d.styles.length];
  const total = sizes[0] * sizes[1] * sizes[2] * sizes[3];
  if (total === 0) return [];

  // Combination i as four digits, hook the slowest-moving.
  const digitsOf = (i: number): number[] => {
    const out = [0, 0, 0, 0];
    for (let k = 3; k >= 0; k--) {
      out[k] = i % sizes[k];
      i = Math.floor(i / sizes[k]);
    }
    return out;
  };
  const all = Array.from({ length: total }, (_, i) => digitsOf(i));
  const used = new Array<boolean>(total).fill(false);
  const counts = sizes.map((n) => new Array<number>(n).fill(0));

  const order: number[] = [];
  let prev = -1;
  for (let step = 0; step < total; step++) {
    let best = -1;
    let bestDist = -1;
    let bestSeen = Infinity;
    for (let i = 0; i < total; i++) {
      if (used[i]) continue;
      const g = all[i];
      let dist = 0;
      if (prev >= 0) for (let k = 0; k < 4; k++) if (g[k] !== all[prev][k]) dist++;
      const seen = counts[0][g[0]] + counts[1][g[1]] + counts[2][g[2]] + counts[3][g[3]];
      if (dist > bestDist || (dist === bestDist && seen < bestSeen)) {
        best = i;
        bestDist = dist;
        bestSeen = seen;
      }
    }
    used[best] = true;
    order.push(best);
    for (let k = 0; k < 4; k++) counts[k][all[best][k]]++;
    prev = best;
  }

  return order.map((i) => {
    const [h, p, a, s] = all[i];
    const hook = d.hooks[h].text;
    const persona = d.personas[p].text;
    const angle = d.angles[a].text;
    const style = d.styles[s].text;
    return { hook, persona, angle, style, combo: comboOf(hook, persona, angle, style) };
  });
}

/** The first n of the order that are not in `made` — fewer near the end, none when all are made. */
export function nextVariants(d: Dimensions, made: Set<string>, n: 1 | 2 | 4): Variant[] {
  const out: Variant[] = [];
  for (const v of orderedVariants(d)) {
    if (made.has(v.combo)) continue;
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("");

function cleanList(raw: unknown, max: number): Dimension[] {
  if (!Array.isArray(raw)) return [];
  const out: Dimension[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as { text?: unknown; note?: unknown };
    if (typeof r.text !== "string") continue;
    // no "|" survives: the combination key joins the four texts with it
    const text = dimensionText(r.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push({ text, note: typeof r.note === "string" ? cut(r.note.trim(), NOTE_MAX).trim() : "" });
    if (out.length === max) break;
  }
  return out;
}

/** Whatever the model (or the owner) sent, as clean dimensions — or null if any dimension is empty. */
export function cleanDimensions(raw: unknown): Dimensions | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const hooks = cleanList(r.hooks, HOOKS_MAX);
  const personas = cleanList(r.personas, OTHERS_MAX);
  const angles = cleanList(r.angles, OTHERS_MAX);
  const styles = cleanList(r.styles, OTHERS_MAX);
  if (!hooks.length || !personas.length || !angles.length || !styles.length) return null;
  return { hooks, personas, angles, styles };
}

/** A starting set when the model cannot propose one: eight hooks, three people, four angles, three looks. */
export function FALLBACK_DIMENSIONS(productName: string): Dimensions {
  const name = cut(productName.trim(), 40).trim() || "แบบประกันนี้";
  return {
    hooks: [
      { text: `${name} คุ้มครองอะไรบ้าง`, note: "เปิดด้วยคำถามที่คนสงสัยที่สุด" },
      { text: "ถ้าวันนี้เกิดอะไรขึ้น ครอบครัวจะเป็นอย่างไร", note: "ชวนคิดถึงคนข้างหลัง" },
      { text: "วันละไม่กี่บาท เพื่อความอุ่นใจทั้งปี", note: "เล่าเบี้ยเป็นรายวัน ใช้ตัวเลขจากข้อมูลเท่านั้น" },
      { text: "ยิ่งเริ่มเร็ว เงื่อนไขยิ่งดี", note: "เน้นการวางแผนตอนสุขภาพดี" },
      { text: "ประกันที่อธิบายจบใน 1 นาที", note: "เน้นความเข้าใจง่าย" },
      { text: "ของขวัญที่ส่งต่อความคุ้มครองให้คนที่รัก", note: "เล่าแบบของขวัญ" },
      { text: "หลับสบายขึ้น เมื่อรู้ว่ามีแผนรองรับ", note: "เน้นความรู้สึกอุ่นใจ" },
      { text: "ก่อนจะสายเกินไป ลองดูตัวเลขจริง", note: "ชวนดูตารางเบี้ยของจริง" },
    ],
    personas: [
      { text: "พ่อแม่มือใหม่", note: "เพิ่งมีลูก ห่วงอนาคตของลูก" },
      { text: "คนทำงานอายุ 30", note: "เริ่มมีรายได้มั่นคง คิดเรื่องวางแผนชีวิต" },
      { text: "คนใกล้เกษียณ", note: "อยากให้ชีวิตหลังเกษียณมั่นคง และไม่เป็นภาระลูก" },
    ],
    angles: ANGLE_BANK.slice(0, 4).map((a) => ({ text: a.label, note: a.promise })),
    styles: [
      { text: "ภาพถ่ายครอบครัว", note: "ภาพถ่ายครอบครัวไทยอบอุ่น แสงธรรมชาติ ดูจริงใจ" },
      { text: "ตัวเลขเด่นบนพื้นสี", note: "ตัวเลขใหญ่อ่านง่ายบนพื้นสีเรียบ เหลือที่ว่างให้ตัวหนังสือ" },
      { text: "Before & After", note: "ภาพเปรียบเทียบสองฝั่ง ก่อนวางแผนกับหลังวางแผน" },
    ],
  };
}
