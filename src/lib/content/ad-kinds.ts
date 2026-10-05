import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import type { AdKind, KnowledgeSub } from "@/lib/ads/ad-kind";
import { AD_HEAD, AD_LIMITS, AD_MONEY_EN, AD_SHORT_FIELDS, BANNED_SUPERLATIVES, BANNED_SUPERLATIVES_EN, PRIMARY_MAX, adOwnerLines, type LongAdContext } from "./ads";
import { NUMBERS_CLOSING } from "./numbers";
import type { Lang } from "./output";
import type { PiecePlan } from "./plan";
import { thbAfter } from "./premium-table";
import { CORE_RULES, ENGLISH_RULES, POSTER_JSON, POSTER_RULES } from "./prompt";

/**
 * The writers of Ads Studio's shorter kinds (spec 2026-10-06), beside the long ad's (ads.ts):
 * - ตัวเลขชัดๆ: the model writes one opening line, figure-free; the code places the headline's
 *   sheet (numbersBody), a CTA line and the contacts under it;
 * - ความรู้ (a myth put right, an FAQ, a checklist) and เล่าเป็นเรื่อง: the long-ad writer's
 *   rules without the premium table — an opening, 3–6 short points, a CTA — and the code places
 *   the contacts after the CTA. No premium, no table, no bullets of figures.
 * The planner, the owner line, the hold, the checks and the save are the long ad's.
 */

/** the CTA of a ตัวเลขชัดๆ ad, its line and its description (Facebook's 27 characters) */
export const NUMBERS_AD_CTA = NUMBERS_CLOSING;
export const NUMBERS_AD_CTA_EN = "Message us for your quote";
/** a knowledge or story ad's CTA when the model wrote none */
const SHORT_CTA = "ทักแชทมาคุยกันได้เลย";
const SHORT_CTA_EN = "Message us to talk it through";

/** the planner's steer for a kind (the long ad's planner is told nothing more, as it always was) */
export function kindSteer(kind: AdKind, sub: KnowledgeSub | undefined, lang: Lang = "th"): string {
  const en = lang === "en";
  if (kind === "numbers") return en ? "Ad type: clear numbers — the hook stops the reader to look at the figures below it; no figures in the hook." : "แบบแอด: ตัวเลขชัดๆ — ฮุกทำให้คนหยุดดูตัวเลขข้างล่าง ห้ามมีตัวเลขในฮุก";
  if (kind === "story") return en ? "Ad type: a short imagined story the reader recognises, turning to this plan." : "แบบแอด: เล่าเป็นเรื่อง — สถานการณ์สมมติสั้นๆ ที่คนอ่านคุ้น แล้วหักมาที่แบบประกันนี้";
  if (kind === "knowledge") {
    const what = { myth: en ? "a common misunderstanding put right" : "ความเข้าใจผิดที่พบบ่อย แล้วแก้ด้วยข้อเท็จจริง", faq: en ? "frequently asked questions" : "คำถามที่ถามบ่อย", checklist: en ? "a checklist before buying" : "เช็กลิสต์ก่อนซื้อ" }[sub ?? "myth"];
    return en ? `Ad type: knowledge — ${what}, about this kind of insurance, tied to this plan.` : `แบบแอด: ความรู้ — ${what} เกี่ยวกับประกันประเภทนี้ และผูกกับแบบนี้`;
  }
  return "";
}

// ---------------------------------------------------------------- ความรู้ and เล่าเป็นเรื่อง

const SUB_RULE: Record<KnowledgeSub, { th: string; en: string }> = {
  myth: {
    th: "แบบ: ความเข้าใจผิด — opening ยกความเชื่อผิดที่คนมักเข้าใจเกี่ยวกับประกันประเภทนี้ แล้ว points แก้ทีละข้อด้วยข้อเท็จจริงจากข้อมูลผลิตภัณฑ์",
    en: "Kind: a myth put right — the opening names a common misunderstanding about this kind of insurance, and the points put it right one by one with facts from the product information.",
  },
  faq: {
    th: "แบบ: คำถามที่ถามบ่อย — points แต่ละข้อขึ้นต้นด้วย ❓ เป็นคำถามสั้นๆ แล้วตอบสั้นๆ ในบรรทัดเดียวกัน",
    en: "Kind: frequently asked questions — each point starts with ❓, a short question then its short answer on the same line.",
  },
  checklist: {
    th: "แบบ: เช็กลิสต์ก่อนซื้อ — points แต่ละข้อขึ้นต้นด้วย ✅ เป็นสิ่งที่ควรเช็กก่อนซื้อประกันประเภทนี้ และข้อท้ายๆ บอกว่าแบบนี้ตอบข้อไหนได้",
    en: "Kind: a checklist before buying — each point starts with ✅, something to check before buying this kind of insurance; the last ones say which this plan answers.",
  },
};

const STORY_RULE = {
  th: "แบบ: เล่าเป็นเรื่อง — opening เปิดฉากสั้นๆ ที่คนอ่านคุ้น points เล่าต่อเป็นบรรทัดสั้นๆ แล้วหักมาที่แบบประกันนี้ในบรรทัดท้ายๆ เป็นสถานการณ์สมมติ (เขียนให้ชัด เช่น “สมมติว่า…”) ห้ามใส่ชื่อคนจริง",
  en: "Kind: a short story — the opening sets a scene the reader recognises, the points tell it on in short lines and turn to this plan near the end. It is imagined (say so, e.g. “Imagine…”); no real person's name.",
};

function shortAdSystem(kind: "knowledge" | "story", sub: KnowledgeSub | undefined): string {
  return [
    ...AD_HEAD,
    "",
    CORE_RULES,
    "",
    `รูปแบบแอด${kind === "story" ? "เล่าเป็นเรื่อง" : "ความรู้"} (ระบบประกอบเป็นข้อความเดียวให้เอง คุณเขียนแค่ส่วนของคุณ):`,
    kind === "story" ? STORY_RULE.th : SUB_RULE[sub ?? "myth"].th,
    `- opening: 1–2 บรรทัด ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว เพราะ Facebook พับส่วนที่เหลือ`,
    "- points: 3–6 ข้อ ข้อละบรรทัดสั้นๆ ใช้ข้อเท็จจริงจากข้อมูลผลิตภัณฑ์เท่านั้น",
    "- ไม่มีตารางเบี้ยในแอดแบบนี้: ห้ามเขียนเบี้ยหรือตัวเลขเบี้ยใดๆ และห้ามทำ points เป็นรายการตัวเลข",
    "- cta: บรรทัดเดียว ชวนทักแชท (ระบบใส่ช่องทางติดต่อต่อท้ายให้เอง)",
    "- hashtags: 3–8 แท็ก ขึ้นต้นด้วย #",
    `- ห้ามอ้างสิ่งที่พิสูจน์ไม่ได้: ${BANNED_SUPERLATIVES.join(" · ")}`,
    "",
    "ความยาว (นับตัวอักษร):",
    ...AD_SHORT_FIELDS,
    "",
    "ตอบ JSON อย่างเดียว:",
    `{"opening":"…","points":["…"],"cta":"…","hashtags":["#…"],"headline":"…","description":"…",${POSTER_JSON}}`,
    POSTER_RULES,
  ].join("\n");
}

function shortAdSystemEn(kind: "knowledge" | "story", sub: KnowledgeSub | undefined): string {
  return [
    "You write English Facebook ads for a life insurance agent in Thailand, read by expats living in Thailand.",
    "What works: stop the scroll in the first line, then invite a chat. Never sell with fear.",
    "",
    CORE_RULES,
    "",
    `${kind === "story" ? "Story" : "Knowledge"} ad format (the system puts it together into one text; you write only your parts):`,
    kind === "story" ? STORY_RULE.en : SUB_RULE[sub ?? "myth"].en,
    `- opening: 1–2 lines. The first ${AD_LIMITS.fold} characters must make sense on their own, because Facebook folds the rest.`,
    "- points: 3–6 short lines, each one line, from the product information only.",
    "- There is no premium table in this kind of ad: never write a premium or any premium figure, and never make the points a list of figures.",
    "- cta: one line inviting a chat (the system adds the contacts after it).",
    "- hashtags: 3–8 tags, each starting with #.",
    `- Never make a claim no one can prove: ${BANNED_SUPERLATIVES_EN.join(" · ")}`,
    "",
    "Lengths (in characters):",
    `- headline: very short, 3–5 words, at most ${AD_LIMITS.headline} characters (shown under the picture, beside the button); a complete phrase.`,
    `- description: very short, 3–5 words, at most ${AD_LIMITS.description} characters; complete, and any figure keeps its unit.`,
    "",
    "Answer in JSON only:",
    `{"opening":"…","points":["…"],"cta":"…","hashtags":["#…"],"headline":"…","description":"…",${POSTER_JSON}}`,
    POSTER_RULES,
    "",
    ENGLISH_RULES,
    AD_MONEY_EN,
  ].join("\n");
}

/** what the shorter kinds' writers are told of the round: no table and no headline figures */
export type ShortAdContext = Omit<LongAdContext, "contact" | "table" | "headline">;

/** the user message the shorter kinds share: the brief, whose ad it is, the plan and the campaign's steer */
function briefing(brief: string, p: PiecePlan, ctx: ShortAdContext, lang: Lang, extra: string[] = []): string {
  const reader = ctx.reader.trim();
  const focus = ctx.focus.trim();
  const voice = ctx.voice.trim();
  if (lang === "en") {
    return [
      `Product information:\n${brief}`,
      ...extra,
      adOwnerLines(ctx.owner, "en"),
      `Angle to use: ${p.angle}`,
      `Hook (the direction of the opening, not word for word): ${p.hook}`,
      reader ? `Who you are talking to: ${reader}` : "",
      focus ? `What to stress: ${focus}` : "",
      voice ? `Brand voice: ${voice}` : "",
    ].filter(Boolean).join("\n\n");
  }
  return [
    `ข้อมูลผลิตภัณฑ์:\n${brief}`,
    ...extra,
    adOwnerLines(ctx.owner),
    `มุมที่ต้องใช้: ${p.angle}`,
    `ฮุก (ใช้เป็นแนวของ opening ไม่ต้องตรงคำ): ${p.hook}`,
    reader ? `กลุ่มคนที่พูดด้วย: ${reader}` : "",
    focus ? `สิ่งที่อยากเน้น: ${focus}` : "",
    voice ? `น้ำเสียงแบรนด์: ${voice}` : "",
  ].filter(Boolean).join("\n\n");
}

/** One knowledge or story ad's writer messages: no table, no headline figures, the kind's rules. */
export function shortAdMessages(brief: string, p: PiecePlan, ctx: ShortAdContext, kind: "knowledge" | "story", sub: KnowledgeSub | undefined, lang: Lang = "th"): ChatMessage[] {
  const en = lang === "en";
  const user = [briefing(brief, p, ctx, lang), en ? "imagePrompt must describe a picture that fits this angle." : "imagePrompt ต้องบรรยายภาพที่เข้ากับมุมนี้"].join("\n\n");
  return [{ role: "system", content: en ? shortAdSystemEn(kind, sub) : shortAdSystem(kind, sub) }, { role: "user", content: user }];
}

export interface ShortAd {
  opening: string;
  points: string[];
  cta: string;
  hashtags: string[];
  headline: string;
  description: string;
  imagePrompt: string;
  poster: unknown;
}

/** A knowledge or story ad as the model wrote it; null without an opening, a headline or any point. */
export function parseShortAd(reply: string): ShortAd | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const opening = str(raw.opening);
  const headline = str(raw.headline).slice(0, 120);
  const points = list(raw.points).slice(0, 6);
  if (!opening || !headline || points.length === 0) return null;
  return {
    opening,
    points,
    cta: str(raw.cta),
    hashtags: list(raw.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 8),
    headline,
    description: str(raw.description).slice(0, 120),
    imagePrompt: str(raw.imagePrompt),
    poster: raw.poster,
  };
}

/** an English short ad's own words with every "THB 25,000,000" said "25,000,000 THB" */
export function englishShortMoney(ad: ShortAd): ShortAd {
  return { ...ad, opening: thbAfter(ad.opening), points: ad.points.map(thbAfter), cta: thbAfter(ad.cta), headline: thbAfter(ad.headline), description: thbAfter(ad.description) };
}

/** the CTA the ad ends on: the model's, or a plain one when it wrote none */
export const shortCta = (ad: ShortAd, lang: Lang) => ad.cta || (lang === "en" ? SHORT_CTA_EN : SHORT_CTA);

/**
 * A knowledge or story ad's primary text: the opening, the points, the CTA, then the contacts the
 * code places, then the hashtags — no table. Over Facebook's 2,200 the model's words are trimmed
 * (the hashtags, then points from the last one); the CTA and the contacts are never trimmed.
 */
export function assembleShortAd(ad: ShortAd, contact: string, lang: Lang = "th"): string {
  const len = (s: string) => [...s].length;
  const cta = shortCta(ad, lang);
  const build = (points: string[], tags: string) => [ad.opening, points.join("\n"), cta, contact, tags].filter((b) => b.trim()).join("\n.\n");
  let out = build(ad.points, ad.hashtags.join(" "));
  if (len(out) <= PRIMARY_MAX) return out;
  for (let n = ad.points.length; n >= 0; n--) {
    out = build(ad.points.slice(0, n), "");
    if (len(out) <= PRIMARY_MAX) return out;
  }
  return out;
}

// ---------------------------------------------------------------- ตัวเลขชัดๆ

/** Arabic or Thai digits: an opening carrying any is not the model's to write */
const DIGIT = /[0-9๐-๙]/;
const THAI = /[฀-๿]/;
const FALLBACK_OPENING = "ตัวเลขจริงจากตารางเบี้ย ดูให้ชัดก่อนตัดสินใจ";
const FALLBACK_OPENING_EN = "Real numbers from the rate table — see them before you decide.";

function numbersSystem(lang: Lang): string {
  if (lang === "en") {
    return [
      "You write English Facebook ads for a life insurance agent in Thailand, read by expats living in Thailand.",
      "This is a clear-numbers ad: under your line the system places the cover, the premium and the plan's terms from the rate table, then a line inviting a chat and the contacts.",
      `- opening: one line, at most ${AD_LIMITS.fold} characters, that makes the reader stop and look at the figures below it.`,
      "- No figure of any kind: no digits, no premium, no cover amount, no age.",
      `- Never make a claim no one can prove: ${BANNED_SUPERLATIVES_EN.join(" · ")}`,
      "- Never claim it covers everything; every plan has exclusions.",
      "",
      ENGLISH_RULES,
      "",
      'Answer in JSON only: {"opening":"…"}',
    ].join("\n");
  }
  return [
    ...AD_HEAD,
    "แอดตัวเลขชัดๆ: ใต้บรรทัดของคุณ ระบบจะวางทุน เบี้ย และเงื่อนไขจากตารางเบี้ยให้เอง แล้วตามด้วยบรรทัดชวนทักแชทและช่องทางติดต่อ",
    `- opening: บรรทัดเดียว ไม่เกิน ${AD_LIMITS.fold} ตัวอักษร ทำให้คนหยุดอ่านตัวเลขข้างล่าง`,
    "- ห้ามมีตัวเลขใดๆ ทั้งเลขอารบิกและเลขไทย ห้ามบอกเบี้ย ทุน หรืออายุเป็นตัวเลข",
    `- ห้ามอ้างสิ่งที่พิสูจน์ไม่ได้: ${BANNED_SUPERLATIVES.join(" · ")}`,
    "- ห้ามอ้างว่าคุ้มครองครบ ครบจบ หรือทุกอย่าง — ทุกแบบมีข้อยกเว้น",
    "- น้ำเสียงเป็นกลาง ห้ามใช้ “ครับ” “ค่ะ” ถ้าต้องพูดถึงตัวเองให้ใช้ “เรา”",
    "",
    'ตอบ JSON อย่างเดียว: {"opening":"…"}',
  ].join("\n");
}

/** One ตัวเลขชัดๆ ad's writer messages: an opening line over the sheet's figures, which it is shown. */
export function numbersOpeningMessages(brief: string, p: PiecePlan, ctx: ShortAdContext, body: string, lang: Lang = "th"): ChatMessage[] {
  const shown = lang === "en" ? `The figures the system will place under your line (never repeat them):\n${body}` : `ตัวเลขที่ระบบจะวางใต้บรรทัดของคุณ (ห้ามเขียนซ้ำ):\n${body}`;
  return [{ role: "system", content: numbersSystem(lang) }, { role: "user", content: briefing(brief, p, ctx, lang, [shown]) }];
}

/**
 * The opening the model wrote, as one line; a reply that cannot be read, or an opening with a
 * digit (or Thai in an English one), gives the plan's hook when it has none, else a fixed line.
 * Never cut: an opening over Facebook's fold is counted and shown red, as every ad field is.
 */
export function parseOpening(reply: string, hook: string, lang: Lang = "th"): string {
  const raw = parseJsonReply<{ opening?: unknown }>(reply);
  const said = typeof raw?.opening === "string" ? raw.opening.replace(/\s*\n\s*/g, " ").trim() : "";
  const bad = (s: string) => !s || DIGIT.test(s) || (lang === "en" && THAI.test(s));
  if (!bad(said)) return said;
  const h = hook.trim();
  if (!bad(h)) return h;
  return lang === "en" ? FALLBACK_OPENING_EN : FALLBACK_OPENING;
}

/** the CTA line and description of a ตัวเลขชัดๆ ad */
export const numbersCta = (lang: Lang) => (lang === "en" ? NUMBERS_AD_CTA_EN : NUMBERS_AD_CTA);

/** A ตัวเลขชัดๆ ad's primary text: the opening, the sheet's figures, the CTA line, the contacts. */
export function assembleNumbersAd(opening: string, body: string, contact: string, lang: Lang = "th"): string {
  return [opening, body, numbersCta(lang), contact].filter((b) => b.trim()).join("\n.\n");
}
