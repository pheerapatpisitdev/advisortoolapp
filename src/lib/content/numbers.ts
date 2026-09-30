import { parseJsonReply } from "@/lib/ai/json-reply";
import type { ChatMessage } from "@/lib/ai/types";
import { THEME_MOOD, THEMES, type PosterSpec, type Theme } from "./poster";

/**
 * The ตัวเลขชัดๆ angle (owner, 2026-09-24): a post that sells on figures alone.
 *
 * Every figure on it is written here from an engine's answer, never by a model — a model
 * writes only the headline above them, and a headline with a digit in it is thrown away for a
 * fixed one. The claim lines come from a list per plan the owner approved, so a "เบี้ยไม่เพิ่ม"
 * never reaches a plan whose premium rises. Design: docs/superpowers/specs/2026-09-24-numbers-angle-design.md
 */

export interface NumberSheet {
  product: string;
  /** "ประกันชีวิตทุน 1,000,000 บาท", or what it covers when that is the bigger figure */
  sumLine: string;
  /** when the sum line is not the plain sum, how it is reached, shown in brackets under it */
  sumNote?: string;
  /** "เบี้ย 1,548 บาท ต่อเดือน", or เบี้ยปีแรก … for a rising premium; empty under the monthly floor, where the day figure leads */
  premiumLine: string;
  /** "ตกวันละ 48 บาท": the yearly premium ÷ 365, rounded up, as the sales pages say it */
  perDayLine: string;
  claims: string[];
  /** "ชาย 35 ปี จ่ายถึงอายุ 99", shown in brackets: the premium is this person's */
  who: string;
  poster: { big: string; small: string };
}

/**
 * One plan the angle can price, as numberSheets() uses it: cases by index, so each plan keeps
 * its own shape of case (a sum, a pension a month, a health plan code) to itself.
 */
export interface PricedPlan {
  product: string;
  claims: string[];
  caseCount: number;
  /** case i priced today with these claim lines, or null when the engine cannot price it */
  price: (i: number, claims: string[], today: Date) => NumberSheet | null;
}

/** A plan's cases and pricing, typed in its own file and erased to a PricedPlan here. */
export function definePlan<C>(p: {
  product: string;
  cases: C[];
  /** fixed wording the owner approved, used as written */
  claims: string[];
  price: (c: C, claims: string[], today: Date) => NumberSheet | null;
}): PricedPlan {
  return { product: p.product, claims: p.claims, caseCount: p.cases.length, price: (i, claims, today) => p.price(p.cases[i], claims, today) };
}

/** Thai words for a case's sex, as the bracket line says them */
export const sexWord = (s: "M" | "F") => (s === "F" ? "หญิง" : "ชาย");
/** whole baht grouped for reading: 1,000,000 */
export const money = (baht: number) => baht.toLocaleString("en-US");

export const NUMBERS_CLOSING = "ทักแชทเช็กเบี้ยตามอายุคุณ";

export function numbersBody(s: NumberSheet): string {
  return [s.sumLine, ...(s.sumNote ? [`(${s.sumNote})`] : []), s.premiumLine, s.perDayLine, ...s.claims, `(${s.who})`].filter(Boolean).join("\n");
}

/** Everything the code wrote, as the number check's yardstick: it wrote them, so they are allowed. */
export function numbersYardstick(sheets: NumberSheet[]): string {
  return sheets.flatMap((s) => [numbersBody(s), s.poster.big, s.poster.small]).join("\n");
}

export function numbersPoster(s: NumberSheet, theme: Theme = "navy"): PosterSpec {
  return {
    layout: "bottom",
    theme,
    blocks: [
      { kind: "badge", text: s.product },
      { kind: "headline", text: s.poster.big },
      // when the day figure is the big line, the small one does not say it twice
      { kind: "sub", text: /วันละ/.test(s.poster.big) ? s.poster.small.replace(/\s*·\s*(?:ปีแรก)?ตกวันละ [\d,]+ บาท$/, "") : s.poster.small },
      { kind: "footer", text: s.who },
    ],
  };
}

/** Arabic or Thai digits: a headline carrying any is not the model's to write. */
const DIGIT = /[0-9๐-๙]/;

export function safeHeadline(text: string, fallback: string): string {
  const t = text.trim();
  return t && !DIGIT.test(t) ? t : fallback;
}

/** used in turn when the model's headline has a digit or is missing */
export const FALLBACK_HEADLINES = [
  "ตัวเลขจริง ไม่ต้องเดา",
  "ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว",
  "เช็กให้ชัด ก่อนตัดสินใจ",
];
const FALLBACK_PICTURE = "A Thai adult at home reviewing household paperwork at a wooden table, natural window light, calm and hopeful mood, no text";

/** One call for the whole round: a headline and a picture line per sheet, from the cheap model. */
export function headlineMessages(sheets: NumberSheet[]): ChatMessage[] {
  const list = sheets.map((s, i) => `ชิ้นที่ ${i + 1}: ${s.product} · ${s.who} · ${s.claims.join(" · ")}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "คุณเขียนพาดหัวโพสต์เฟซบุ๊กภาษาไทยให้ตัวแทนประกันชีวิต",
        "ใต้พาดหัว ระบบจะวางตัวเลขเบี้ยและทุนให้เอง พาดหัวมีหน้าที่ทำให้คนหยุดอ่านตัวเลข",
        "กติกา: ห้ามมีตัวเลขใดๆ ทั้งเลขอารบิกและเลขไทย · ยาวไม่เกิน 60 ตัวอักษร · ห้ามสัญญาเกินข้อมูลที่ให้ · ห้ามใช้คำว่าถูกที่สุด ดีที่สุด การันตี · ห้ามอ้างว่าคุ้มครองครบ ครบจบ หรือทุกอย่าง — ทุกแบบมีข้อยกเว้น",
        "imagePrompt: คำบรรยายภาพประกอบเป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ห้ามมีตัวหนังสือในภาพ",
        "theme: โทนสีโปสเตอร์หนึ่งจากรายการนี้ ให้เข้ากับแบบประกันและคนในชิ้นนั้น:",
        ...THEMES.map((t) => `  ${t} — ${THEME_MOOD[t]}`),
        'ตอบเป็น JSON เท่านั้น: {"pieces":[{"headline":"…","imagePrompt":"…","theme":"navy"}]}',
      ].join("\n"),
    },
    { role: "user", content: `เขียน ${sheets.length} ชิ้น ชิ้นละหนึ่งพาดหัว ไม่ซ้ำกัน\n${list}` },
  ];
}

/** Always `count` lines: a headline the guard lets through, or a fallback in its place. */
export function parseHeadlines(reply: string, count: number): { headline: string; imagePrompt: string; theme?: Theme }[] {
  const raw = parseJsonReply<{ pieces?: unknown }>(reply);
  const list = Array.isArray(raw?.pieces) ? (raw.pieces as { headline?: unknown; imagePrompt?: unknown; theme?: unknown }[]) : [];
  return Array.from({ length: count }, (_, i) => {
    const p = list[i] ?? {};
    const fallback = FALLBACK_HEADLINES[i % FALLBACK_HEADLINES.length];
    const picture = typeof p.imagePrompt === "string" && p.imagePrompt.trim() ? p.imagePrompt.trim() : FALLBACK_PICTURE;
    // a theme the model made up is no theme; the caller falls back to its own
    const theme = (THEMES as readonly unknown[]).includes(p.theme) ? (p.theme as Theme) : undefined;
    return { headline: safeHeadline(typeof p.headline === "string" ? p.headline : "", fallback), imagePrompt: picture, ...(theme ? { theme } : {}) };
  });
}
