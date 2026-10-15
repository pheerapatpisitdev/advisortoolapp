import {
  availablePensionAges, MODE_LABEL, PENSION_AGES, PENSION_LIMITS, quotePension,
  type PensionAge, type PensionBasis, type PensionMode, type PensionPay, type PensionYear,
} from "@/calc/pension/engine";
import { GUARANTEED_YEARS, pensionFigure, pensionMarks } from "@/lib/pension-pen-notes";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * บำนาญ สมาร์ท 95 in วิดีโอนำเสนอ (owner, 2026-10-13, mockup
 * https://claude.ai/artifact/MYHhrcJkg8h58gk2DZ8ij2): the same five scenes as the other plans,
 * told the way this contract is bought — a monthly pension from an age, paid for over six years
 * or until it starts. Every figure is the /bumnan95 engine's (src/calc/pension/engine.ts), so the
 * clip, the page and the chat's table picture cannot disagree.
 *
 * No จุดคุ้มทุน (owner, 2026-10-11) and no comparing the total pension with the total premium
 * (owner, 2026-10-13, choice 1ก): the clip says the total pension alone. No riders in this first
 * round (choice 2ก).
 */

export type PensionVideoInput = Extract<VideoInput, { product: "PENSION" }>;

const PAYS: readonly PensionPay[] = ["6", "untilAnnuity"];
/** the price box's instalments, largest first as the other plans list theirs */
const MODES: PensionMode[] = ["annual", "semi", "quarterly", "monthly"];

export const PENSION_NAME = "บำนาญ สมาร์ท 95";
export const PENSION_PAGE = "/bumnan95";
/** the monthly pension the form opens on, the page's own example */
export const PENSION_DEFAULT_MONTHLY = 10_000;

/** the arrangement as the engine is asked for it, from a sum or anything else */
function quote(v: { age: number; sex: "M" | "F"; annuityAge: number; pay: PensionPay }, basis: PensionBasis, amount: number, mode: PensionMode = "annual") {
  return quotePension({ age: v.age, sex: v.sex, annuityAge: v.annuityAge, pay: v.pay, mode, basis, amount });
}

/**
 * What the form sent, checked: a pension age this person may choose, a way of paying, and a sum
 * the engine prices — worked out from the monthly pension typed when that is what came. The
 * words for what is wrong otherwise, the engine's own where it has them.
 */
export function checkedPension(v: PensionVideoInput): PensionVideoInput | string {
  if (!PAYS.includes(v.pay)) return "เลือกวิธีชำระเบี้ย";
  if (!PENSION_AGES.includes(v.annuityAge as PensionAge)) return "เลือกอายุเริ่มรับบำนาญ";
  if (!Number.isInteger(v.age) || v.age < PENSION_LIMITS.ageMin || v.age > PENSION_LIMITS.ageMax) {
    return `รับประกันอายุ ${PENSION_LIMITS.ageMin}–${PENSION_LIMITS.ageMax} ปี`;
  }
  if (!availablePensionAges(v.age, v.pay).includes(v.annuityAge as PensionAge)) {
    return `อายุ ${v.age} ปี เลือกรับบำนาญอายุ ${v.annuityAge} แบบนี้ไม่ได้`;
  }
  const monthly = Number(v.monthly);
  const r = v.monthly !== undefined
    ? (Number.isInteger(monthly) && monthly > 0 ? quote(v, "monthlyPension", monthly) : { ok: false as const, error: "ใส่บำนาญต่อเดือน" })
    : quote(v, "sumAssured", v.sumAssured);
  if (!r.ok) return r.error;
  return { product: "PENSION", sex: v.sex, age: v.age, annuityAge: v.annuityAge, pay: v.pay, sumAssured: r.quote.sumAssured };
}

/** บำนาญ 95 in คลิปเล่าเรื่อง's ใกล้เกษียณ: what a monthly pension costs a year, the engine's own figures */
export interface PensionPremium { sumAssured: number; monthlyPension: number; annual: number; start: number; payYears: number }

/** A monthly pension from an age, priced: its sum, the pension and the year's premium; the engine's words otherwise. */
export function pensionPremium(v: { sex: "M" | "F"; age: number; annuityAge: number; pay: PensionPay; monthly: number }): PensionPremium | string {
  const c = checkedPension({ product: "PENSION", sex: v.sex, age: v.age, annuityAge: v.annuityAge, pay: v.pay, monthly: v.monthly } as PensionVideoInput);
  if (typeof c === "string") return c;
  const r = quote(c, "sumAssured", c.sumAssured);
  if (!r.ok) return r.error;
  const q = r.quote;
  return { sumAssured: q.sumAssured, monthlyPension: Math.floor(q.monthlyPension), annual: Math.floor(q.modePremium), start: q.plan.annuityStartAge, payYears: q.payYears };
}

/**
 * The sum a budget buys: the premium basis of the same engine, in the instalment the customer
 * named. The engine's own words when it is too little or too much.
 */
export function pensionFromBudget(v: PensionVideoInput, budget: { baht: number; per: "month" | "year" }): PensionVideoInput | string {
  const r = quote(v, "premium", budget.baht, budget.per === "month" ? "monthly" : "annual");
  if (!r.ok) return r.error;
  return { ...v, sumAssured: r.quote.sumAssured, budget };
}

/** "ชำระเบี้ยจนถึงอายุ 60 (20 ปี)" or "ชำระเบี้ย 6 ปี", as the chat's table picture says it */
export const pensionPayLine = (pay: PensionPay, start: number, years: number) =>
  pay === "6" ? "ชำระเบี้ย 6 ปี" : `ชำระเบี้ยจนถึงอายุ ${start} (${years} ปี)`;

/** "6 ล้าน", "1.2 ล้าน", "850,000" — a total said roughly, as the voice says it ("ประมาณ …") */
export function roughBaht(baht: number): string {
  if (baht >= 1_000_000) return `${(Math.round(baht / 100_000) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน`;
  return (Math.round(baht / 10_000) * 10_000).toLocaleString("en-US");
}

/** The facts the scenes are drawn and spoken from; undefined when the engine prices nothing. */
export function pensionVideoFacts(v: PensionVideoInput): QuoteVideoFacts | undefined {
  const r = quote(v, "sumAssured", v.sumAssured);
  if (!r.ok) return undefined;
  const q = r.quote;
  const start = q.plan.annuityStartAge;
  const prices = MODES.map((mode) => {
    const m = quote(v, "sumAssured", v.sumAssured, mode);
    return { label: MODE_LABEL[mode], amount: m.ok ? pensionFigure(m.quote.modePremium) : "", main: mode === "annual" };
  }).filter((p) => p.amount);
  const monthlyPrice = prices.find((p) => p.label === MODE_LABEL.monthly) ?? prices[0];
  const annual = prices[0];
  const lastPayAge = v.age + q.payYears - 1;
  const monthly = pensionFigure(q.monthlyPension);
  const marks = pensionMarks(q.illustration);
  const guaranteeTo = marks.guaranteeEnd >= 0 ? q.illustration[marks.guaranteeEnd].age : Math.min(95, start + GUARANTEED_YEARS - 1);
  const bands = q.bands.map((b) => ({ from: b.fromAge, to: b.toAge, percent: Math.round(b.percent * 100), annual: pensionFigure(b.annual) }));
  const sa = pensionFigure(q.sumAssured);
  return {
    product: "PENSION",
    planLine: PENSION_NAME,
    insuredWho: `${v.sex === "F" ? "หญิง" : "ชาย"} ${v.age} ปี`,
    insuredLine: `ทุน ${sa} บาท · ${pensionPayLine(v.pay, start, q.payYears)}`,
    sex: v.sex,
    age: v.age,
    lead: { label: "บำนาญเดือนละ", amount: monthly, baht: q.monthlyPension },
    leadMark: `ตั้งแต่อายุ ${start} ถึงอายุ 95`,
    priceMark: `เดือนละ ${monthlyPrice.amount} บาท`,
    priceBig: { label: "ออมปีละ", amount: annual.amount, unit: "บาท" },
    priceTitle: "เบี้ยประกันที่ต้องชำระ",
    prices,
    spokenPrice: { per: "เดือนละ", amount: monthlyPrice.amount },
    pills: [`จ่ายเบี้ยแค่ ${q.payYears} ปี`, "เบี้ยคงที่ตลอด", "ลดหย่อนภาษีได้"],
    penNote: `จ่ายครบอายุ ${lastPayAge} แล้วหยุดส่ง`,
    priceNotes: [],
    coverTitle: "บำนาญที่ได้รับ ต่อปี",
    cover: bands.map((b) => ({ label: `อายุ ${b.from}–${b.to} · ${b.percent}% ของทุน`, amount: b.annual, mark: true })),
    coverStyle: "steps",
    coverPen: "% ของทุนประกัน",
    coverToAge: 95,
    payYears: q.payYears,
    lastPayAge,
    pension: {
      start, pay: v.pay, sumAssured: q.sumAssured, monthly, bands, guaranteeTo,
      totalPension: q.totalPension, years: q.illustration,
    },
    footNote: "เบี้ยประกันบำนาญลดหย่อนภาษีได้ตามเงื่อนไขของกรมสรรพากร",
  };
}

/** บำนาญ 95's part of the facts: the schedule the cover and value scenes are drawn from */
export interface PensionVideoFacts {
  start: number;
  pay: PensionPay;
  sumAssured: number;
  /** the first band's monthly pension, as the page says it: "10,000" */
  monthly: string;
  bands: { from: number; to: number; percent: number; annual: string }[];
  /** the age the fifteenth guaranteed pension is paid at */
  guaranteeTo: number;
  totalPension: number;
  years: PensionYear[];
}

/**
 * The Motion value scene's year bars, in a w×h box: a premium each year it is paid, then the
 * pension each year it is paid, all to one scale; the fifteen guaranteed pensions marked.
 */
export function pensionBars(p: PensionVideoFacts, w: number, h: number) {
  const years = p.years;
  const top = Math.max(1, ...years.map((y) => Math.max(y.premium, y.pension)));
  const step = w / Math.max(1, years.length);
  const barW = Math.max(3, Math.round(step * 0.72));
  const bars = years.map((y, i) => {
    const value = y.premium || y.pension;
    const bh = Math.max(value ? 4 : 0, Math.round((value / top) * h));
    const kind = y.premium ? "premium" as const : y.age <= p.guaranteeTo ? "guaranteed" as const : "pension" as const;
    return { x: Math.round(i * step + (step - barW) / 2), y: h - bh, w: barW, h: bh, kind, age: y.age };
  });
  const xOf = (age: number) => {
    const i = years.findIndex((y) => y.age === age);
    return i < 0 ? 0 : Math.round(i * step + step / 2);
  };
  const g0 = years.findIndex((y) => y.age === p.start);
  const g1 = years.findIndex((y) => y.age === p.guaranteeTo);
  return {
    bars, xOf,
    guarantee: g0 >= 0 && g1 >= 0 ? { x0: Math.round(g0 * step), x1: Math.round((g1 + 1) * step) } : undefined,
  };
}
