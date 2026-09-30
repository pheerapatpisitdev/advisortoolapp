import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { CORE_RULES, POSTER_JSON, POSTER_RULES } from "./prompt";

/**
 * Facebook ads in variants: selling angles down the side, tones across the top, one ad per cell.
 *
 * The owner's Maryjane project's AD Studio (src/lib/ad-matrix.ts, ad-prompt.ts), cut to fit a
 * workbench. A cheap call designs the matrix once per round; one large-model call writes each
 * cell, all in parallel, so four ads take about as long as one. The point of the grid is the
 * comparison: two angles each in two tones is an A/B test the owner can run in Ads Manager, where
 * four versions of one idea is not.
 *
 * The banks are Maryjane's shape with an insurance agent's angles. They are what the round falls
 * back on when the matrix call fails — a round of four near-identical ads is worse than none.
 */

export interface AdAngle {
  key: string;
  label: string;
  /** what this angle promises the reader, in one Thai sentence */
  promise: string;
}

export interface AdTone {
  key: string;
  label: string;
  instruction: string;
}

export interface AdMatrix {
  angles: AdAngle[];
  tones: AdTone[];
}

export const ANGLE_BANK: AdAngle[] = [
  { key: "family", label: "ครอบครัวไปต่อได้", promise: "เงินก้อนให้คนข้างหลังเดินต่อได้ ถ้าวันหนึ่งเราไม่อยู่" },
  { key: "small_price", label: "เริ่มต้นไม่แพง", promise: "เบี้ยที่จ่ายไหวเมื่อเทียบเป็นรายวัน โดยใช้ตัวเลขจากข้อมูลเท่านั้น" },
  { key: "early", label: "วางแผนก่อนสาย", promise: "ทำตอนยังอายุน้อยและสุขภาพดี เงื่อนไขดีกว่ารอ" },
  { key: "peace", label: "ความอุ่นใจ", promise: "หลับสบายเพราะรู้ว่ามีแผนรองรับ" },
  { key: "gift", label: "ของขวัญให้คนที่รัก", promise: "ความคุ้มครองเป็นสิ่งที่ส่งต่อให้ลูกหรือคู่ชีวิตได้" },
  { key: "clarity", label: "เข้าใจง่ายใน 1 นาที", promise: "สรุปแบบประกันให้เห็นภาพในไม่กี่บรรทัด" },
];

export const TONE_BANK: AdTone[] = [
  { key: "friendly", label: "เป็นกันเอง", instruction: "เขียนเหมือนคุยกับเพื่อน ใช้คำง่าย" },
  { key: "direct", label: "ตรงไปตรงมา", instruction: "สั้น กระชับ บอกประโยชน์ในบรรทัดแรกทันที" },
  { key: "warm", label: "อบอุ่น", instruction: "เน้นความรู้สึกและความห่วงใยคนในครอบครัว" },
  { key: "expert", label: "มืออาชีพ", instruction: "น่าเชื่อถือ มีข้อเท็จจริงประกอบ ไม่ขายตรงเกินไป" },
];

export const MAX_ANGLES = 3;
export const MAX_TONES = 2;

/**
 * Facebook's lengths for a feed ad, in code points — Maryjane's META_TEXT_LIMITS. The primary
 * text may run on; only its first 125 characters show before "ดูเพิ่มเติม", so those must stand
 * alone. The headline and description are cut short by Facebook past these.
 *
 * They are asked for, counted and shown in red when over — never cut here. Cutting was tried
 * and turned "ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน" into "…คุ้มครองสูงสุด 2": a figure clipped mid-claim
 * is a false claim, and on an insurance advertisement that is worse than a long headline.
 */
export const AD_LIMITS = { fold: 125, headline: 27, description: 27 } as const;

/** The bank's first `n`, so a failed matrix still yields distinct ads. */
export function fallbackMatrix(angles: number, tones: number): AdMatrix {
  return { angles: ANGLE_BANK.slice(0, angles), tones: TONE_BANK.slice(0, tones) };
}

export function matrixMessages(brief: string, angles: number, tones: number, hint: string): ChatMessage[] {
  const system = [
    "คุณเป็นนักวางกลยุทธ์โฆษณา Facebook ของตัวแทนประกันชีวิตในไทย",
    "หน้าที่คือออกแบบ “มิติ” ของโฆษณาชุดนี้ ไม่ใช่เขียนข้อความ",
    "- มุมขาย (angle) = เหตุผลที่คนควรสนใจแบบประกันนี้ แต่ละมุมต้องต่างกันชัดเจน และต้องอิงข้อมูลผลิตภัณฑ์ที่ให้มาเท่านั้น",
    "- โทน (tone) = น้ำเสียงที่ใช้เล่า",
    "- เรียงมุมขายจากที่น่าจะได้ผลที่สุดไปหาน้อยที่สุด",
    "ตอบ JSON อย่างเดียว:",
    '{"angles":[{"key":"english_key","label":"ชื่อไทยสั้นๆ","promise":"สิ่งที่มุมนี้สัญญากับคนอ่าน 1 ประโยค"}],"tones":[{"key":"english_key","label":"ชื่อไทยสั้นๆ","instruction":"คำสั่งน้ำเสียง"}]}',
  ].join("\n");
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    hint ? `มุมที่เจ้าของเพจอยากเน้น: ${hint}` : "",
    `ออกแบบมุมขาย ${angles} มุม และโทน ${tones} โทน`,
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
}

/** The model's matrix, repaired where it can be and topped up from the banks where it falls short. */
export function parseMatrix(reply: string, angles: number, tones: number): AdMatrix {
  const raw = parseJsonReply<{ angles?: unknown; tones?: unknown }>(reply);
  const read = <T extends { key: string; label: string }>(v: unknown, make: (r: Record<string, string>, key: string) => T): T[] => {
    const out: T[] = [];
    for (const item of Array.isArray(v) ? v : []) {
      if (!item || typeof item !== "object") continue;
      const r = Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([k, x]) => [k, typeof x === "string" ? x.trim() : ""]));
      const key = slug(r.key || r.label || "") || `k${out.length}`;
      if (!r.label || out.some((o) => o.key === key)) continue;
      out.push(make(r, key));
    }
    return out;
  };
  const a = read(raw?.angles, (r, key) => ({ key, label: r.label.slice(0, 40), promise: (r.promise || "").slice(0, 200) }));
  const t = read(raw?.tones, (r, key) => ({ key, label: r.label.slice(0, 30), instruction: (r.instruction || "").slice(0, 200) }));
  // short of what was asked, the banks fill in, skipping any already chosen
  for (const b of ANGLE_BANK) if (a.length < angles && !a.some((x) => x.key === b.key)) a.push(b);
  for (const b of TONE_BANK) if (t.length < tones && !t.some((x) => x.key === b.key)) t.push(b);
  return { angles: a.slice(0, angles), tones: t.slice(0, tones) };
}

export interface AdCell {
  angle: AdAngle;
  tone: AdTone;
}

/** Every angle in every tone, angle by angle, so a row of the grid is one angle. */
export function matrixCells(m: AdMatrix): AdCell[] {
  return m.angles.flatMap((angle) => m.tones.map((tone) => ({ angle, tone })));
}

export function adCopyMessages(brief: string, cell: AdCell): ChatMessage[] {
  const system = [
    "คุณเป็นนักเขียนโฆษณา Facebook ภาษาไทยให้ตัวแทนประกันชีวิต",
    "แนวที่ได้ผลในไทย: หยุดสายตาในบรรทัดแรก แล้วชวนให้ทักแชท ไม่ขายด้วยความกลัว",
    "",
    CORE_RULES,
    "",
    "ความยาว (นับตัวอักษร):",
    `- primaryText: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว เพราะ Facebook พับส่วนที่เหลือ ทั้งหมดไม่เกิน 400 ตัวอักษร ปิดท้ายด้วยการชวนทักแชท`,
    `- headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษรนับรวมสระและวรรณยุกต์ (แสดงใต้ภาพ ข้างปุ่ม) ต้องเป็นประโยคที่จบในตัว`,
    `- description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษรนับรวมสระและวรรณยุกต์ ต้องจบในตัว ถ้ามีตัวเลขต้องมีหน่วยครบ`,
    "",
    "ตอบ JSON อย่างเดียว:",
    `{"primaryText":"…","headline":"…","description":"…",${POSTER_JSON}}`,
    POSTER_RULES,
  ].join("\n");
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    `มุมขายที่ต้องใช้: ${cell.angle.label} — ${cell.angle.promise}`,
    `โทนที่ต้องใช้: ${cell.tone.label} — ${cell.tone.instruction}`,
  ].join("\n\n");
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export interface AdCopy {
  primaryText: string;
  headline: string;
  description: string;
  imagePrompt: string;
  poster: unknown;
}

/** The three fields Ads Manager asks for, as written; null when there is no ad. */
export function parseAdCopy(reply: string): AdCopy | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const primaryText = str(raw.primaryText).slice(0, 1200);
  const headline = str(raw.headline).slice(0, 120);
  if (!primaryText || !headline) return null;
  return {
    primaryText,
    headline,
    description: str(raw.description).slice(0, 120),
    imagePrompt: str(raw.imagePrompt),
    poster: raw.poster,
  };
}
