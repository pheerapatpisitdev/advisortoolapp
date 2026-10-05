import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { AD_HEAD, AD_LIMITS, AD_MONEY_EN, AD_SHORT_FIELDS, BANNED_SUPERLATIVES, BANNED_SUPERLATIVES_EN, PRIMARY_MAX } from "./ads";
import { POSTER_LINES, POSTER_SHAPE, WRITE_RULES, claimPoster, factsBlock, type ClaimFacts } from "./claim";
import { DISCLAIMER, type Lang } from "./output";
import { clip, MAX_CHARS, parsePoster, THEMES, type PosterBlock, type PosterSpec } from "./poster";
import { thbAfter } from "./premium-table";
import { ENGLISH_RULES, steerLines } from "./prompt";

/**
 * The รีวิวเคลม ad's copy (spec 2026-10-06 claim review): a real claim told from the customer's
 * documents, as a story, then the plan's premium table when the ad carries one, the contacts and
 * the caution. The writer's rules are Organic's claim rules (claim.ts); this file is the ad's shape.
 */

export const CLAIM_HEADLINE = "รีวิวเคลมจริง";
export const CLAIM_HEADLINE_EN = "A real claim, paid";
export const CLAIM_DESCRIPTION = "ทักแชทถามเรื่องเคลม";
export const CLAIM_DESCRIPTION_EN = "Ask us about claims";
export const CLAIM_CAUTION_EN = "Claim results depend on policy terms.";

export interface ClaimAd {
  headline: string;
  story: string[];
  cta: string;
  description: string;
  imagePrompt: string;
  poster: unknown;
}

/** Organic's claim rules said in English; the rules are the same, only the words differ */
const WRITE_RULES_EN = [
  "Rules you must never break:",
  "1. Use only the facts in the claim information. Add no symptom, event, feeling or detail that is not in it.",
  "2. Copy every figure exactly from the claim information: no calculating, rounding, adding or subtracting. If the figure you want is not there, write without a figure.",
  "3. Never write a person's name, a hospital's name, a doctor's name, a date, or anything that shows which customer this is. “Our customer” is fine.",
  "4. Never name or recommend an insurance plan. This ad tells the claim only.",
  "5. No exaggeration: no guarantees, no “every claim is paid”, no “always paid in full”, no best, fastest or No. 1.",
  "6. Never mention or compare with another insurer.",
  "7. Never write a warning or disclaimer yourself; the system adds it.",
  "8. Neutral voice, never revealing the writer's gender. Refer to yourselves as “we”.",
].join("\n");

const POSTER_LINES_EN = [
  "- imagePrompt: the background behind the document photo, in English, 1–2 sentences: Thai people, natural light, relieved and warm (a family smiling at home, a bright calm recovery room). No text, no documents, no seriously ill people, no blood.",
  "- poster.headline: text on the picture, at most 50 characters, one idea; any figure copied exactly from the claim information. Leave out the paid amount: the system puts it on the yellow bar under the headline.",
  "- poster.footer: at most 40 characters, such as an invitation to chat.",
  "- poster.theme: one of the following colour moods:",
  ...THEMES.filter((t) => t !== "photo").map((t) => `    ${t}`),
];

const TABLE_LINE = "ระบบจะใส่ตารางเบี้ยของแผนต่อท้ายเรื่องให้เอง ห้ามเขียนเบี้ยหรือตัวเลขเบี้ย และห้ามเอ่ยชื่อแผน";
const TABLE_LINE_EN = "The system adds the plan's premium table after the story: never write a premium or a premium figure, and never name the plan.";

function claimAdSystem(withTable: boolean, lang: Lang): string {
  if (lang === "en") {
    return [
      "You write English Facebook ads for a life insurance agent in Thailand, read by expats living in Thailand.",
      "What works: stop the scroll in the first line, then invite a chat. Never sell with fear.",
      "",
      WRITE_RULES_EN,
      "",
      "Task: a Facebook ad built on a real claim review. The claim facts are in Thai; write them in English.",
      "Answer in JSON only, in this shape:",
      `{"headline":"…","story":["…"],"cta":"…","description":"…",${POSTER_SHAPE}}`,
      `- story: 4–8 short lines telling the claim from the facts, one line each. The first ${AD_LIMITS.fold} characters must make sense on their own, because Facebook folds the rest.`,
      "- cta: one line inviting a chat about claims (the system adds the contacts after it).",
      `- headline: very short, 3–5 words, at most ${AD_LIMITS.headline} characters; a complete phrase.`,
      `- description: very short, 3–5 words, at most ${AD_LIMITS.description} characters; any figure keeps its unit.`,
      ...(withTable ? [TABLE_LINE_EN] : []),
      `- Never make a claim no one can prove: ${BANNED_SUPERLATIVES_EN.join(" · ")}`,
      ...POSTER_LINES_EN,
      "",
      ENGLISH_RULES,
      AD_MONEY_EN,
    ].join("\n");
  }
  return [
    ...AD_HEAD,
    "",
    WRITE_RULES,
    "",
    "งาน: โฆษณา Facebook จากรีวิวการเคลมจริง (ระบบประกอบเป็นข้อความเดียวให้เอง คุณเขียนแค่ส่วนของคุณ)",
    "ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ตามรูปแบบนี้:",
    `{"headline":"…","story":["…"],"cta":"…","description":"…",${POSTER_SHAPE}}`,
    `- story: 4–8 บรรทัดสั้นๆ เล่าเรื่องการเคลมจากข้อมูล บรรทัดละหนึ่งประโยค ${AD_LIMITS.fold} ตัวอักษรแรกต้องอ่านรู้เรื่องจบในตัว เพราะ Facebook พับส่วนที่เหลือ`,
    "- cta: บรรทัดเดียว ชวนทักแชทถามเรื่องเคลม (ระบบใส่ช่องทางติดต่อต่อท้ายให้เอง)",
    ...AD_SHORT_FIELDS,
    ...(withTable ? [TABLE_LINE] : []),
    `- ห้ามอ้างสิ่งที่พิสูจน์ไม่ได้: ${BANNED_SUPERLATIVES.join(" · ")}`,
    ...POSTER_LINES,
  ].join("\n");
}

/** One claim ad's writer messages: the facts, the angle and who it is for; the table line only when the ad carries one. */
export function claimAdMessages(facts: ClaimFacts, angle: { say: string }, reader: string, withTable: boolean, lang: Lang): ChatMessage[] {
  const en = lang === "en";
  const steer = steerLines({ reader: reader.trim() });
  return [
    { role: "system", content: claimAdSystem(withTable, lang) },
    {
      role: "user",
      content: [
        en ? `Claim information (a true story, shared with the customer's consent; in Thai):\n${factsBlock(facts)}` : `ข้อมูลการเคลม (เรื่องจริง ลูกค้ายินยอมให้เล่าแล้ว):\n${factsBlock(facts)}`,
        en ? `Angle of this ad: ${angle.say}` : `มุมของแอดนี้: ${angle.say}`,
        steer,
      ].filter(Boolean).join("\n\n"),
    },
  ];
}

/**
 * A claim ad from a reply, or null without a headline or a story. A headline or description over
 * Ads Manager's 27 becomes the fixed one; an English ad's money is said number-first.
 */
export function parseClaimAd(reply: string, lang: Lang): ClaimAd | null {
  const raw = parseJsonReply<Record<string, unknown>>(reply);
  if (!raw) return null;
  const en = lang === "en";
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const say = (s: string) => (en ? thbAfter(s) : s);
  const short = (v: unknown, max: number, fallback: string) => {
    const t = say(str(v));
    return t && [...t].length <= max ? t : fallback;
  };
  const story = (Array.isArray(raw.story) ? raw.story.map(str).filter(Boolean) : []).slice(0, 10).map(say);
  if (!str(raw.headline) || story.length === 0) return null;
  return {
    headline: short(raw.headline, AD_LIMITS.headline, en ? CLAIM_HEADLINE_EN : CLAIM_HEADLINE),
    story,
    cta: say(str(raw.cta)),
    description: short(raw.description, AD_LIMITS.description, en ? CLAIM_DESCRIPTION_EN : CLAIM_DESCRIPTION),
    imagePrompt: str(raw.imagePrompt),
    poster: raw.poster,
  };
}

/**
 * A claim ad's primary text: the story, the cta, the table when there is one, the contacts the
 * code places, then the caution. Over Facebook's 2,200 the story is trimmed from its last line;
 * the cta, table, contacts and caution are never trimmed.
 */
export function assembleClaimAd(ad: ClaimAd, parts: { table: string | null; contact: string }, lang: Lang): string {
  const caution = lang === "en" ? CLAIM_CAUTION_EN : DISCLAIMER;
  const build = (story: string[]) => [story.join("\n"), ad.cta, parts.table ?? "", parts.contact, caution].filter((b) => b.trim()).join("\n.\n");
  let out = build(ad.story);
  for (let n = ad.story.length - 1; [...out].length > PRIMARY_MAX && n >= 0; n--) out = build(ad.story.slice(0, n));
  return out;
}

/** The claim poster: Organic's for Thai; the English one has its own badge and paid line, the same layout and themes. */
export function claimAdPoster(ad: ClaimAd, facts: ClaimFacts, lang: Lang): PosterSpec {
  if (lang !== "en") return claimPoster(ad.poster, facts, ad.headline);
  const r = (ad.poster && typeof ad.poster === "object" ? ad.poster : {}) as Record<string, unknown>;
  const headline = clip(typeof r.headline === "string" && r.headline.trim() ? thbAfter(r.headline) : ad.headline, MAX_CHARS.headline);
  const footer = typeof r.footer === "string" ? clip(thbAfter(r.footer), MAX_CHARS.footer) : "";
  const blocks: PosterBlock[] = [
    { kind: "badge", text: "Real claim review" },
    { kind: "headline", text: headline },
    ...(facts.paid ? [{ kind: "sub" as const, text: `Insurer paid ${facts.paid} THB` }] : []),
    { kind: "footer", text: footer || "Message us about claims" },
  ];
  const theme = THEMES.includes(r.theme as never) && r.theme !== "photo" ? r.theme : "navy";
  return parsePoster({ layout: "top", theme, blocks, lang: "en" })!;
}
