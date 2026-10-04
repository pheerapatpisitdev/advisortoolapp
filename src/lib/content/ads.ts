import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { CORE_RULES, POSTER_JSON, POSTER_RULES } from "./prompt";
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
 * figures, in the order a reader meets them. Over Facebook's limit, only the model's words are
 * trimmed, in this order until it fits: the hashtags, the bullets from the last one, the cta,
 * then the opening (whole lines from the top while they fit; if even its first line does not,
 * that line is cut by characters). The headline figures, the table and the contacts are never
 * trimmed, and empty blocks are left out so no "." spacer is left dangling.
 */
export function assembleLongAd(ad: LongAd, figures: { headline: string; table: string; contact: string }): string {
  const len = (s: string) => [...s].length;
  const build = (opening: string, bullets: string[], cta: string, tags: string) =>
    [opening, figures.headline, bullets.join("\n"), figures.table, cta, figures.contact, tags]
      .filter((b) => b.trim()).join("\n.\n");
  const fits = (s: string) => len(s) <= PRIMARY_MAX;

  const tags = ad.hashtags.join(" ");
  let out = build(ad.opening, ad.bullets, ad.cta, tags);
  if (fits(out)) return out;
  for (let n = ad.bullets.length; n >= 0; n--) {
    out = build(ad.opening, ad.bullets.slice(0, n), ad.cta, "");
    if (fits(out)) return out;
  }
  out = build(ad.opening, [], "", "");
  if (fits(out)) return out;
  // the opening alone is over: keep whole lines from the top while they fit
  const rest = build("", [], "", "");
  const room = PRIMARY_MAX - len(rest) - 3; // the "\n.\n" joining the opening to the rest
  const lines = ad.opening.split("\n");
  let kept = "";
  for (const line of lines) {
    const next = kept ? `${kept}\n${line}` : line;
    if (len(next) > room) break;
    kept = next;
  }
  if (!kept) kept = [...lines[0]].slice(0, Math.max(0, room)).join("").trimEnd();
  return build(kept, [], "", "");
}
