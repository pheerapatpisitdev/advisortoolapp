import type { PlanCardInput } from "@/lib/card-link";
import { LIFEPROTECT_PLAN } from "@/lib/lifeprotect-card";
import { quoteCard, valueTableCard, type ValueTableRow } from "@/lib/quote-card";

/**
 * วิดีโอนำเสนอ (owner, 2026-10-11): what the five scenes show and say, taken from the same quote
 * the card and the value table are drawn from — the voice never says a figure the card does not.
 *
 * The spoken lines are the owner's casual wording (approved in the mockup the same day): no
 * "เบี้ย", "เสียชีวิต" or "เวนคืน" in the voice — "ค่าใช้จ่าย", "ถ้าเป็นอะไรไป", "ขอเงินก้อนคืน".
 * The screen keeps the card's own words. Words in a line are separated by single spaces: the
 * subtitles light up one of those pieces at a time.
 */

export type SceneKey = "legacy" | "price" | "cover" | "value" | "contact";
export const SCENE_KEYS: readonly SceneKey[] = ["legacy", "price", "cover", "value", "contact"];

export interface PriceRow { label: string; amount: string; main: boolean }
export interface CoverRow { label: string; amount: string; mark: boolean }

/** Everything the clip shows, as the card and the value table state it. */
export interface QuoteVideoFacts {
  planLine: string;
  insuredWho: string;
  insuredLine: string;
  sex: PlanCardInput["sex"];
  age: number;
  sumAssured: number;
  /** "2,000,000" */
  legacy: string;
  legacyBaht: number;
  /** "ทุน 1,000,000 · 2 เท่าก่อนอายุ 60" */
  legacyNote?: string;
  /** "ตกวันละ 79 บาท" */
  perDay: string;
  /** "79" */
  perDayAmount: string;
  /** largest instalment first, as the card's box */
  prices: PriceRow[];
  /** the instalment the voice names beside the daily figure, e.g. รายเดือน 2,583 */
  spokenPrice: { per: string; amount: string };
  payYears: number;
  /** the age the last premium is paid at */
  lastPayAge: number;
  /** the card's "ครอบครัวได้รับเมื่อเสียชีวิต" rows */
  cover: CoverRow[];
  /** the age the cover runs to */
  coverToAge: number;
  rows: ValueTableRow[];
  /** every premium paid, "545,300" */
  totalPaid: string;
  breakEven?: { age: number; cash: string; index: number };
  /** what the last year returns, when there is no break-even to point at */
  lastCash: string;
  footNote?: string;
}

const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** The facts for a Life Protect quote; undefined for anything the clip cannot state (no price, another plan). */
export function quoteVideoFacts(input: PlanCardInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  if (input.planCode !== LIFEPROTECT_PLAN) return undefined;
  const card = quoteCard(input, today);
  const table = valueTableCard(input, today);
  if (!card || !table || !card.summary || !card.perDay || !card.legacy) return undefined;
  const coverSection = card.sections.find((s) => s.title.startsWith("ครอบครัวได้รับ"));
  if (!coverSection || coverSection.rows.length === 0) return undefined;
  const paying = table.rows.filter((r) => r.due !== "—");
  const last = table.rows[table.rows.length - 1];
  const lastPaid = [...table.rows].reverse().find((r) => r.paid !== null);
  if (!paying.length || !last || !lastPaid?.paid) return undefined;
  const beIndex = table.rows.findIndex((r) => r.breakEven);
  const be = beIndex >= 0 ? table.rows[beIndex] : undefined;
  const main = card.summary.rows.find((r) => r.main) ?? card.summary.rows[0];
  const monthly = card.summary.rows.find((r) => r.label === "รายเดือน");
  const spoken = monthly ?? main;
  return {
    planLine: card.planLine,
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: input.sex,
    age: input.age,
    sumAssured: input.sumAssured,
    legacy: card.legacy.amount,
    legacyBaht: digits(card.legacy.amount),
    ...(card.legacy.note ? { legacyNote: card.legacy.note } : {}),
    perDay: card.perDay,
    perDayAmount: card.perDay.replace(/[^\d,]/g, ""),
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.main })),
    spokenPrice: { per: spoken.label === "รายปี" ? "ปีละ" : spoken.label === "ราย 6 เดือน" ? "งวดละ" : "เดือนละ", amount: spoken.amount },
    payYears: paying.length,
    lastPayAge: paying[paying.length - 1].age,
    cover: coverSection.rows.map((r) => ({ label: r.label, amount: r.amount, mark: Boolean(r.mark) })),
    coverToAge: last.age + 1,
    rows: table.rows,
    totalPaid: lastPaid.paid,
    ...(be?.cash ? { breakEven: { age: be.age, cash: be.cash, index: beIndex } } : {}),
    lastCash: last.cash ?? "0",
    ...(card.footNotes?.[0] ? { footNote: card.footNotes[0] } : {}),
  };
}

/** "1 ล้าน", "1.5 ล้าน", "800,000" — how a sum is said aloud */
export function spokenBaht(baht: number): string {
  if (baht >= 1_000_000 && baht % 100_000 === 0) return `${(baht / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return baht.toLocaleString("en-US");
}

/**
 * A customer's name as the clip says it: "คุณ" taken off (the voice adds its own), letters,
 * marks and spaces only, at most 30 characters. Empty when nothing usable is left.
 */
export function cleanCustomerName(raw: string | undefined | null): string {
  const s = (raw ?? "").normalize("NFC").replace(/^\s*คุณ\s*/, "").replace(/[^\p{L}\p{M}\s.]/gu, "").replace(/\s+/g, " ").trim();
  return s.slice(0, 30).trim();
}

export interface SceneScript { key: SceneKey; voice: string }

/** The five spoken lines, in the owner's casual wording (mockup, 2026-10-11). */
export function quoteVideoScript(f: QuoteVideoFacts, customer?: string): SceneScript[] {
  const name = cleanCustomerName(customer);
  const who = f.sex === "M" ? "คุณผู้ชาย" : "คุณผู้หญิง";
  const sum = spokenBaht(f.sumAssured);
  const legacy = spokenBaht(f.legacyBaht);
  // "2 ล้านบาทค่ะ" runs together as it is said; a figure in digits keeps its space
  const legacyBaht = legacy.endsWith("ล้าน") ? `${legacy}บาทค่ะ` : `${legacy} บาทค่ะ`;

  const opening = name
    ? `สวัสดีค่ะ คุณ${name} ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ อายุ ${f.age} ทำทุน ${sum} ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง ${legacyBaht}`
    : `สวัสดีค่ะ ขอเล่าแผนนี้ให้ฟังสั้นๆ นะคะ ${who}อายุ ${f.age} ทำทุน ${sum} ถ้าเป็นอะไรไป ครอบครัวได้เงินก้อนสูงสุดถึง ${legacyBaht}`;

  const price = `ค่าใช้จ่ายตกแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท จ่ายแค่ ${f.payYears} ปีก็จบ ราคาไม่ขึ้นเลยตลอดที่จ่ายค่ะ`;

  const [first, second] = f.cover;
  const beforeAge = first?.label.match(/(\d+)/)?.[1];
  const cover = second && beforeAge
    ? `ถ้าเป็นอะไรไปก่อนอายุ ${beforeAge} ครอบครัวได้ ${spokenBaht(digits(first.amount))} หลังจากนั้นได้ ${spokenBaht(digits(second.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`
    : `ถ้าเป็นอะไรไป ครอบครัวได้ ${spokenBaht(digits(first.amount))} และดูแลยาวไปถึงอายุ ${f.coverToAge} เลยค่ะ`;

  const value = f.breakEven
    ? `ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน จ่ายครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี พออายุ ${f.breakEven.age} ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ ${f.breakEven.cash} บาท มากกว่าที่จ่ายไปทั้งหมดแล้วค่ะ`
    : `ที่ชอบที่สุดคือ เงินที่จ่ายไปไม่หายไปไหน จ่ายครบตอนอายุ ${f.lastPayAge} แล้วเงินก็ยังโตทุกปี ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ตามตารางเลยค่ะ`;

  const closing = name
    ? `คุณ${name}สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ`
    : "สนใจ ทักมาคุยกันได้เลยนะคะ ยินดีช่วยดูแผนให้ค่ะ";

  return [
    { key: "legacy", voice: opening },
    { key: "price", voice: price },
    { key: "cover", voice: cover },
    { key: "value", voice: value },
    { key: "contact", voice: closing },
  ];
}
