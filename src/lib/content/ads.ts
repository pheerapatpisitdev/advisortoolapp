import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { CORE_RULES, POSTER_JSON, POSTER_RULES } from "./prompt";
import type { Variant } from "@/lib/ads/dimensions";
import type { PiecePlan } from "./plan";

/**
 * Facebook ads: the writer's rules, and the long-form ad (an opening, the benefit bullets, a
 * premium table, a contacts block, hashtags) whose figures are all placed by code.
 */

export interface AdAngle {
  key: string;
  label: string;
  /** what this angle promises the reader, in one Thai sentence */
  promise: string;
}

export const ANGLE_BANK: AdAngle[] = [
  { key: "family", label: "ครอบครัวไปต่อได้", promise: "เงินก้อนให้คนข้างหลังเดินต่อได้ ถ้าวันหนึ่งเราไม่อยู่" },
  { key: "small_price", label: "เริ่มต้นไม่แพง", promise: "เบี้ยที่จ่ายไหวเมื่อเทียบเป็นรายวัน โดยใช้ตัวเลขจากข้อมูลเท่านั้น" },
  { key: "early", label: "วางแผนก่อนสาย", promise: "ทำตอนยังอายุน้อยและสุขภาพดี เงื่อนไขดีกว่ารอ" },
  { key: "peace", label: "ความอุ่นใจ", promise: "หลับสบายเพราะรู้ว่ามีแผนรองรับ" },
  { key: "gift", label: "ของขวัญให้คนที่รัก", promise: "ความคุ้มครองเป็นสิ่งที่ส่งต่อให้ลูกหรือคู่ชีวิตได้" },
  { key: "clarity", label: "เข้าใจง่ายใน 1 นาที", promise: "สรุปแบบประกันให้เห็นภาพในไม่กี่บรรทัด" },
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

const AD_HEAD = [
  "คุณเป็นนักเขียนโฆษณา Facebook ภาษาไทยให้ตัวแทนประกันชีวิต",
  "แนวที่ได้ผลในไทย: หยุดสายตาในบรรทัดแรก แล้วชวนให้ทักแชท ไม่ขายด้วยความกลัว",
];

/** The headline's and the description's lengths, the same for every kind of ad. */
const AD_SHORT_FIELDS = [
  `- headline: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.headline} ตัวอักษรนับรวมสระและวรรณยุกต์ (แสดงใต้ภาพ ข้างปุ่ม) ต้องเป็นประโยคที่จบในตัว`,
  `- description: สั้นมาก 3–5 คำ ไม่เกิน ${AD_LIMITS.description} ตัวอักษรนับรวมสระและวรรณยุกต์ ต้องจบในตัว ถ้ามีตัวเลขต้องมีหน่วยครบ`,
];

/** What every ad's writer is told, whatever it is written to: the rules, the lengths, the reply's shape. */
function adSystem(): string {
  return [
    ...AD_HEAD,
    "",
    CORE_RULES,
    "",
    "ความยาว (นับตัวอักษร):",
    `- primaryText: ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว เพราะ Facebook พับส่วนที่เหลือ ทั้งหมดไม่เกิน 400 ตัวอักษร ปิดท้ายด้วยการชวนทักแชท`,
    ...AD_SHORT_FIELDS,
    "",
    "ตอบ JSON อย่างเดียว:",
    `{"primaryText":"…","headline":"…","description":"…",${POSTER_JSON}}`,
    POSTER_RULES,
  ].join("\n");
}

/**
 * One ad written to one combination of a campaign's four dimensions (Ads Studio, 2026-10-04).
 * The writer is told the same as for any ad; what changes is what it writes to: the hook as the
 * line to open with (its idea, not necessarily its words), the people it talks to, the reason it
 * gives, and the picture's style for the imagePrompt. The campaign's focus and brand voice, when
 * the owner gave them, go with every piece.
 */
export function variantAdMessages(brief: string, v: Variant, extras: { focus: string; voice: string }): ChatMessage[] {
  const focus = extras.focus.trim();
  const voice = extras.voice.trim();
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    `ฮุก (ใช้เป็นแนวของประโยคเปิด ในบรรทัดแรกของ primaryText): ${v.hook}`,
    `กลุ่มคนที่พูดด้วย: ${v.persona}`,
    `มุมขายที่ต้องใช้: ${v.angle}`,
    focus ? `สิ่งที่อยากเน้น: ${focus}` : "",
    voice ? `น้ำเสียงแบรนด์: ${voice}` : "",
    `สไตล์ภาพ: ${v.style} — imagePrompt ต้องบรรยายภาพในสไตล์นี้`,
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: adSystem() }, { role: "user", content: user }];
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

/** Claims no one can prove; the writer is told never to make them. */
export const BANNED_SUPERLATIVES = ["อันดับ 1", "ขายดีที่สุด", "คุ้มที่สุด", "ถูกที่สุด", "กล้าเทียบทุกบริษัท"] as const;

/** Facebook's primary text allows 2,200 characters. */
const PRIMARY_MAX = 2200;

/**
 * What the code knows about a long ad's round: the premium table, the headline figures, the
 * Page's contacts (never shown to the model), who it is for and what to stress.
 */
export interface LongAdContext {
  table: string;
  headline: string;
  contact: string;
  reader: string;
  focus: string;
  voice: string;
}

function longAdSystem(): string {
  return [
    ...AD_HEAD,
    "",
    CORE_RULES,
    "",
    "รูปแบบโฆษณายาว (ระบบประกอบเป็นข้อความเดียวให้เอง คุณเขียนแค่ส่วนของคุณ):",
    `- opening: 1–2 บรรทัด ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว เพราะ Facebook พับส่วนที่เหลือ`,
    "- bullets: 5–8 บรรทัด ขึ้นต้นทุกบรรทัดด้วย 🥇 เล่าประโยชน์จากข้อมูลผลิตภัณฑ์เท่านั้น",
    "- cta: บรรทัดเดียว ชวนทักแชทเช็คเบี้ยฟรี โดยแจ้งเพศและอายุ",
    "- hashtags: 6–12 แท็ก ขึ้นต้นด้วย #",
    "- ห้ามเขียนเบี้ยหรือตัวเลขเบี้ยใดๆ ระบบใส่ตารางเบี้ยให้เอง",
    `- ห้ามอ้างสิ่งที่พิสูจน์ไม่ได้: ${BANNED_SUPERLATIVES.join(" · ")}`,
    "",
    "ความยาว (นับตัวอักษร):",
    ...AD_SHORT_FIELDS,
    "",
    "ตอบ JSON อย่างเดียว:",
    `{"opening":"…","bullets":["🥇 …"],"cta":"…","hashtags":["#…"],"headline":"…","description":"…",${POSTER_JSON}}`,
    POSTER_RULES,
  ].join("\n");
}

/**
 * One long ad's writer messages. The table and the headline figures are shown as facts it may
 * refer to; the contacts are not, because the code places them.
 */
export function longAdMessages(brief: string, p: PiecePlan, ctx: Omit<LongAdContext, "contact">): ChatMessage[] {
  const focus = ctx.focus.trim();
  const voice = ctx.voice.trim();
  const reader = ctx.reader.trim();
  const user = [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    `ตารางเบี้ยที่ระบบจะใส่ให้ (อ้างถึงได้ แต่ห้ามเขียนซ้ำ):\n${ctx.table}`,
    `ตัวเลขเด่นที่ระบบจะใส่ให้:\n${ctx.headline}`,
    `มุมที่ต้องใช้: ${p.angle}`,
    `ฮุก (ใช้เป็นแนวของ opening ไม่ต้องตรงคำ): ${p.hook}`,
    reader ? `กลุ่มคนที่พูดด้วย: ${reader}` : "",
    focus ? `สิ่งที่อยากเน้น: ${focus}` : "",
    voice ? `น้ำเสียงแบรนด์: ${voice}` : "",
    "imagePrompt ต้องบรรยายภาพที่เข้ากับมุมนี้",
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: longAdSystem() }, { role: "user", content: user }];
}

export interface LongAd {
  opening: string;
  bullets: string[];
  cta: string;
  hashtags: string[];
  headline: string;
  description: string;
  imagePrompt: string;
  poster: unknown;
}

/** A long ad as the model wrote it, repaired where it can be; null without an opening or a headline. */
export function parseLongAd(reply: string): LongAd | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const opening = str(raw.opening);
  const headline = str(raw.headline).slice(0, 120);
  if (!opening || !headline) return null;
  return {
    opening,
    bullets: list(raw.bullets).slice(0, 8).map((b) => (b.startsWith("🥇") ? b : `🥇 ${b}`)),
    cta: str(raw.cta),
    hashtags: list(raw.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 12),
    headline,
    description: str(raw.description).slice(0, 120),
    imagePrompt: str(raw.imagePrompt),
    poster: raw.poster,
  };
}

/**
 * The ad's primary text: the model's opening, bullets, cta and hashtags around the code's
 * figures, in the order a reader meets them. Cut to Facebook's limit at a line boundary,
 * hashtags first; the table is never cut mid-figure.
 */
export function assembleLongAd(ad: LongAd, figures: { headline: string; table: string; contact: string }): string {
  const join = (blocks: string[]) => blocks.filter(Boolean).join("\n.\n");
  const head = [ad.opening, figures.headline, ad.bullets.join("\n"), figures.table, ad.cta, figures.contact];
  const tags = ad.hashtags.join(" ");
  const len = (s: string) => [...s].length;
  const full = join([...head, tags]);
  if (len(full) <= PRIMARY_MAX) return full;
  const bare = join(head);
  if (len(bare) <= PRIMARY_MAX) return bare;
  const lines = bare.split("\n");
  while (lines.length > 1 && len(lines.join("\n")) > PRIMARY_MAX) lines.pop();
  // one line alone past the limit is a model that ran on; the limit still holds
  return [...lines.join("\n")].slice(0, PRIMARY_MAX).join("");
}
