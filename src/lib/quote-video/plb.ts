import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL, type PayMode } from "@/calc/types";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import { spoken } from "@/lib/lifeprotect-facts";
import { coverEndsAt, plbDiscount, plbModes, plbTakes, termAt, totalPaid } from "@/lib/plb-quote";
import { plbTable, type PlbTable } from "@/lib/plb-table";
import { PLB_SUMS } from "@/lib/quote-pdf/pages";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * Protection Life in วิดีโอนำเสนอ (owner, 2026-10-14, mockup
 * https://claude.ai/artifact/WHryu9gcuXHCxg2P2ibBR9): the sixth plan, the /plb page's term cover —
 * a sum from the page's own steps (PLB_SUMS, 3 แสน – 5 ล้าน), one of four terms (5, 10, 12 or
 * 15 years, paid and covered alike), an age and a sex. Every figure is the page's own table
 * (src/lib/plb-table.ts), read the way PlbCalculator.tsx reads it.
 *
 * Its words (the owner's choices on the mockup): "ค่าใช้จ่าย" for what is paid, as มรดก — never
 * "ออม" (it builds no value) and never "เบี้ย" or "เสียชีวิต" in the voice. The voice never names a
 * waiting period (unconfirmed, src/lib/assistant/plb/faq.ts PLB_WAITING) nor says the cover starts
 * at once. Tax relief is said only for the 10-, 12- and 15-year terms (the bot's own rule). That
 * the contract pays nothing at its end is on screen, small, and never voiced as a benefit. Its
 * fourth scene ("terms") sets the four terms side by side where the others have their value table.
 */

export type PlbVideoInput = Extract<VideoInput, { product: "PLB" }>;
export type PlbVariant = "PLB05" | "PLB10" | "PLB12" | "PLB15";

export const PLB_NAME = "Protection Life";
export const PLB_PAGE = "/plb";
export const PLB_VARIANTS: readonly PlbVariant[] = ["PLB05", "PLB10", "PLB12", "PLB15"];
/** the term the page opens on, and so the form */
export const PLB_DEFAULT_TERM: PlbVariant = "PLB12";
/** the terms the bot says may be used for tax relief: ten years and over (assistant/plb/faq.ts) */
const TAX_TERMS: ReadonlySet<string> = new Set(["PLB10", "PLB12", "PLB15"]);

/** one term as the terms scene lists it */
export interface PlbTermRow {
  years: number;
  /** the age its cover ends at */
  endAge: number;
  /** "5,250": its yearly price */
  annual: string;
  /** the term the clip is about */
  on: boolean;
}

/** Protection Life's part of the facts */
export interface PlbVideoFacts {
  variant: PlbVariant;
  years: number;
  sum: number;
  /** "1 ล้าน", "3 แสน", "1.5 ล้าน": the sum as it is said */
  sumShort: string;
  /** the age the cover (and the paying) ends at */
  endAge: number;
  /** "15": the yearly price as whole baht a day, as the page rounds it */
  perDay: string;
  /** "5,470" */
  annual: string;
  /** "2,844.40": the half-year instalment */
  semi?: string;
  /** only where the company takes it monthly */
  monthly?: string;
  /** "65,640": every instalment over the term */
  total: string;
  /** whether the term may be used for tax relief (10, 12, 15 years) */
  tax: boolean;
  /** the terms this age can buy, shortest first */
  terms: PlbTermRow[];
  /** the rate per thousand taken off at this sum, and the sum the top discount starts at */
  discount: { perThousand: number; fromSum: number };
  /** the monthly minimum, in baht */
  minMonthly: number;
}

/** "1 ล้าน", "1.5 ล้าน", "3 แสน", "350,000": a sum as it is said and as the big type shows it */
export function plbSumShort(sum: number): string {
  if (sum >= 1_000_000 && sum % 100_000 === 0) return `${(sum / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return spoken(sum);
}

/** an instalment as the mockup shows it: whole baht, or to the satang where it has satang (2,844.40) */
export function plbBaht(satang: number): string {
  return satang % 100 === 0
    ? formatBaht(satang)
    : (satang / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const isVariant = (v: unknown): v is PlbVariant => PLB_VARIANTS.includes(v as PlbVariant);

/** What the form sent, checked: a term, an age and a sum the page offers. The words for what is wrong otherwise. */
export function checkedPlb(v: PlbVideoInput, today: Date = new Date()): PlbVideoInput | string {
  const t = plbTable(today);
  if (!isVariant(v.variant)) return "เลือกระยะเวลาคุ้มครอง";
  if (!Number.isInteger(v.age) || !plbTakes(t, v.age)) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!PLB_SUMS.includes(v.sumAssured)) return "เลือกทุนประกัน 3 แสน – 5 ล้าน ตามขั้นของหน้า Protection Life";
  return { product: "PLB", variant: v.variant, sex: v.sex, age: v.age, sumAssured: v.sumAssured };
}

function modesOf(t: PlbTable, variant: string, v: { sex: "M" | "F"; age: number }, sum: number): ModePremium[] | undefined {
  return plbModes(t, termAt(t, variant), { sex: v.sex, age: v.age, sumAssured: sum });
}

/**
 * The largest sum a budget buys on the chosen term: the biggest of the page's steps whose
 * instalment, in the mode the customer named, is within it. A monthly budget only buys a sum the
 * company takes monthly (under the minimum the monthly instalment is not offered at all).
 */
export function plbFromBudget(v: PlbVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): PlbVideoInput | string {
  const t = plbTable(today);
  if (t.expired) return "ตารางเบี้ยของแบบนี้หมดอายุแล้ว ขอราคาปัจจุบันจากบริษัทก่อน";
  if (!isVariant(v.variant) || !plbTakes(t, v.age)) return "แบบนี้คิดราคาไม่ได้ในอายุนี้";
  const mode: PayMode = budget.per === "month" ? "monthly" : "annual";
  const cost = (sum: number) => {
    const m = modesOf(t, v.variant, v, sum)?.find((x) => x.mode === mode);
    return m && !m.belowMinimum ? m.total : undefined;
  };
  const limit = Math.round(budget.baht * 100);
  let best: number | undefined;
  for (const sum of PLB_SUMS) {
    const c = cost(sum);
    if (c !== undefined && c <= limit) best = sum;
  }
  if (best !== undefined) return { ...v, sumAssured: best, budget };
  const word = budget.per === "month" ? "เดือนละ" : "ปีละ";
  const first = PLB_SUMS.find((sum) => cost(sum) !== undefined);
  if (first === undefined) return "แบบนี้คิดราคาไม่ได้ในอายุนี้";
  const why = budget.per === "month" && first > PLB_SUMS[0] ? ` (รายเดือนขั้นต่ำ ${t.minMonthly.toLocaleString("en-US")} บาท)` : "";
  return `งบนี้ยังไม่พอสำหรับทุน ${plbSumShort(first)} (เริ่มที่${word} ${plbBaht(cost(first)!)} บาท)${why}`;
}

/** "5, 10, 12 หรือ 15": the terms as the voice lists them */
export function termsSaid(rows: PlbTermRow[]): string {
  const ys = rows.map((r) => String(r.years));
  return ys.length > 1 ? `${ys.slice(0, -1).join(", ")} หรือ ${ys[ys.length - 1]}` : ys[0] ?? "";
}

/** The facts the scenes are drawn and spoken from; undefined when the page would show no price. */
export function plbVideoFacts(v: PlbVideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const t = plbTable(today);
  if (t.expired || !isVariant(v.variant) || !plbTakes(t, v.age) || !PLB_SUMS.includes(v.sumAssured)) return undefined;
  const term = termAt(t, v.variant);
  const modes = modesOf(t, v.variant, v, v.sumAssured);
  const headline = displayPremium(modes, t.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  if (!modes || !headline || !annual) return undefined;
  const sum = v.sumAssured;
  const endAge = coverEndsAt(term, v.age);
  const perDay = perDayText(annual.total);
  const offered = modes.filter((m) => !m.belowMinimum);
  // largest first, as the other plans list theirs; the page's headline instalment is the main one
  const prices = offered.map((m) => ({ label: PAY_MODE_LABEL[m.mode], amount: plbBaht(m.total), main: m.mode === headline.mode }));
  const semi = offered.find((m) => m.mode === "semi");
  const monthly = offered.find((m) => m.mode === "monthly");
  const total = formatBaht(totalPaid(annual.total, term));
  const terms: PlbTermRow[] = t.terms.flatMap((x) => {
    const a = plbModes(t, x, { sex: v.sex, age: v.age, sumAssured: sum })?.find((m) => m.mode === "annual");
    return a ? [{ years: x.years, endAge: coverEndsAt(x, v.age), annual: formatBaht(a.total), on: x.variant === v.variant }] : [];
  });
  const tiers = t.discount.byVariant[v.variant] ?? [];
  const top = tiers.reduce((at, value, i) => (value > (tiers[at] ?? 0) ? i : at), 0);
  const who = `${v.sex === "F" ? "หญิง" : "ชาย"} ${v.age} ปี`;
  const money = sum.toLocaleString("en-US");
  return {
    product: "PLB",
    planLine: PLB_NAME,
    insuredWho: who,
    insuredLine: `ทุน ${money} บาท · คุ้มครอง ${term.years} ปี ถึงอายุ ${endAge}`,
    sex: v.sex,
    age: v.age,
    lead: { label: "ถ้าเป็นอะไรไป ครอบครัวได้", amount: money, baht: sum },
    leadMark: `ค่าใช้จ่ายวันละ ${perDay} บาท`,
    priceMark: `วันละ ${perDay} บาท`,
    perDayAmount: perDay,
    priceTitle: "ค่าใช้จ่าย",
    prices,
    spokenPrice: { per: "ปีละ", amount: formatBaht(annual.total) },
    pills: [`เท่าเดิมทุกปี ตลอด ${term.years} ปี`],
    priceNotes: [],
    coverTitle: "คุ้มครองเต็มทุน ตลอดสัญญา",
    cover: [{ label: `ถ้าเป็นอะไรไปภายใน ${term.years} ปี`, amount: money, mark: true }],
    coverStyle: "flat",
    coverToAge: endAge,
    totalPaid: total,
    footNote: "ความคุ้มครองล้วน ครบสัญญาไม่มีเงินคืน · ราคามาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
    plb: {
      variant: v.variant, years: term.years, sum, sumShort: plbSumShort(sum), endAge, perDay,
      annual: formatBaht(annual.total),
      ...(semi ? { semi: plbBaht(semi.total) } : {}),
      ...(monthly ? { monthly: plbBaht(monthly.total) } : {}),
      total, tax: TAX_TERMS.has(v.variant), terms,
      discount: { perThousand: plbDiscount(t, v.variant, t.discount.thresholds[top] ?? 0), fromSum: t.discount.thresholds[top] ?? 0 },
      minMonthly: t.minMonthly,
    },
  };
}

/** the opening's big line: "คุ้มครองชีวิต 1 ล้าน" (PLB), "ออม 8 ปี" (Global Savings) or "มรดก 3 ล้าน" (มรดก) */
export function leadBig(f: QuoteVideoFacts): string {
  if (f.gsaving) return `ออม ${f.gsaving.payYears} ปี`;
  return f.plb ? `คุ้มครองชีวิต ${f.plb.sumShort}` : `มรดก ${f.legacy?.tier ?? ""} ล้าน`;
}

/** the opening's pill: who it is for, and for PLB until when ("ชาย 35 ปี · ถึงอายุ 47"); Global Savings its bonus, never as certain */
export function leadPill(f: QuoteVideoFacts): string {
  if (f.gsaving) return `${f.insuredWho} · + โบนัสดัชนี (ไม่การันตี)`;
  return f.plb ? `${f.insuredWho} · ถึงอายุ ${f.plb.endAge}` : f.insuredWho;
}
