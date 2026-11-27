import { formatBaht } from "@/calc/money";
import { budgetFit } from "@/lib/budget-sum";
import type { PlanCardInput } from "@/lib/card-link";
import { ageWord } from "@/lib/lifeprotect-cta";
import { cashAt, leverage, lifeTreasureModes, payYears, termAt, totalPaid } from "@/lib/lifetreasure-quote";
import { lifeTreasureTable, type LifeTreasureTable } from "@/lib/lifetreasure-table";
import { quoteCard, valueTableCard } from "@/lib/quote-card";
import { LIFETREASURE_SUMS } from "@/lib/quote-pdf/pages";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * ไลฟ์เทรเชอร์ in วิดีโอนำเสนอ (owner, 2026-11-26, ก on mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p): the
 * tenth plan, the /lifetreasure page's — a sum set in advance for the family, covered to 99, paid in 6, 12 or 18
 * years — one of the page's sums, a term, an age, a sex. Every figure is the page's own engine's.
 *
 * Its third scene is the choice of term: the three side by side, the chosen one lit (owner kept it, ก). The
 * fourth sets the premiums beside what the family receives with the page's own multiple, told only from 1.1
 * up as อีซี่ โพรเทค 6's is; past the age where the premiums reach the sum it is left out. The 101% floor lifts
 * an older insured's cover above the sum, so there the family receives "อย่างน้อย" the sum. The value line
 * says "ครบเท่าที่ออม", never more than it, and names the cash at the end of cover.
 */

export type LifeTreasureVideoInput = Extract<VideoInput, { product: "LIFETREASURE" }>;
export const LIFETREASURE_PLAN = "LIFETREASURE";
/** the page's three terms, in its order */
export const LIFETREASURE_VARIANTS = ["H99F06A", "H99F12A", "H99F18A"] as const;
export type LifeTreasureVariant = (typeof LIFETREASURE_VARIANTS)[number];
export const isLifeTreasureVariant = (v: unknown): v is LifeTreasureVariant => (LIFETREASURE_VARIANTS as readonly unknown[]).includes(v);
/** the term the page opens on, and the clip when none is named */
export const LIFETREASURE_DEFAULT: LifeTreasureVariant = "H99F12A";

/** a term as the third scene draws it */
export interface LifeTreasureTermRow {
  variant: LifeTreasureVariant;
  years: number;
  /** the yearly premium as the page prints it, and every one of them added up */
  annual: string;
  total: string;
  /** "1.8": the sum over those premiums; absent below 1.1 */
  times?: string;
  /** the term the clip is made for */
  on: boolean;
}

export interface LifeTreasureVideoFacts {
  sum: number;
  variant: LifeTreasureVariant;
  payYears: number;
  lastPayAge: number;
  coverToAge: number;
  annual: string;
  /** every premium of the chosen term, in baht */
  paid: number;
  /** "1.8": the sum as a multiple of the premiums; absent where it is not clearly more than one */
  times?: string;
  /** the cover rises above the sum at some age (101% of the premiums, or the surrender value) */
  atLeast: boolean;
  floorPercent: number;
  /** the cash value when cover ends, and at 70 where that is still ahead */
  endCash: number;
  at70?: number;
  /** the three terms, for the term scene */
  terms: LifeTreasureTermRow[];
}

export const ltMoney = (n: number) => Math.round(n).toLocaleString("en-US");
const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));
/** "1.8" from 1.1 up: "1.0 เท่า" says nothing */
const timesOf = (sum: number, totalSatang: number) => {
  const x = leverage(sum, totalSatang)?.toFixed(1);
  return x && Number(x) >= 1.1 ? x : undefined;
};

const planCard = (v: Pick<LifeTreasureVideoInput, "age" | "sex" | "sumAssured" | "variant">): PlanCardInput => ({
  kind: "plan", planCode: LIFETREASURE_PLAN, variant: v.variant, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
});

const SUMS_WORD = `ทุนประกัน ${ltMoney(LIFETREASURE_SUMS[0])} – ${ltMoney(LIFETREASURE_SUMS[LIFETREASURE_SUMS.length - 1])} บาท ตามขั้นของหน้า Life Treasure (ทีละล้าน เกิน 30 ล้านทีละ 5 ล้าน)`;

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedLifeTreasure(v: LifeTreasureVideoInput, today: Date = new Date()): LifeTreasureVideoInput | string {
  const t = lifeTreasureTable(today);
  if (!isLifeTreasureVariant(v.variant)) return "เลือกระยะชำระเบี้ย 6 12 หรือ 18 ปี";
  if (v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!LIFETREASURE_SUMS.includes(v.sumAssured)) return SUMS_WORD;
  return { product: "LIFETREASURE", variant: v.variant, age: v.age, sex: v.sex, sumAssured: v.sumAssured };
}

const annualOf = (t: LifeTreasureTable, variant: string, who: { sex: "M" | "F"; age: number; sumAssured: number }) =>
  lifeTreasureModes(t, termAt(t, variant), who)?.find((m) => m.mode === "annual");

/** The biggest of the page's sums whose instalment fits, on the chosen term; the words for why none does otherwise. */
export function lifeTreasureFromBudget(v: LifeTreasureVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): LifeTreasureVideoInput | string {
  const t = lifeTreasureTable(today);
  const none = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";
  if (t.expired || !isLifeTreasureVariant(v.variant) || v.age < t.ageMin || v.age > t.ageMax) return none;
  const term = termAt(t, v.variant);
  const price = (sum: number) => lifeTreasureModes(t, term, { sex: v.sex, age: v.age, sumAssured: sum });
  const fit = budgetFit(LIFETREASURE_SUMS, price, budget);
  if (fit) return { ...v, sumAssured: fit.sum, budget };
  const at = price(LIFETREASURE_SUMS[0])?.find((m) => m.mode === (budget.per === "month" ? "monthly" : "annual"));
  return at
    ? `งบนี้ยังไม่พอสำหรับทุนต่ำสุด ${ltMoney(LIFETREASURE_SUMS[0])} (เริ่มที่${budget.per === "month" ? "เดือนละ" : "ปีละ"} ${formatBaht(at.total)} บาท)`
    : none;
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function lifeTreasureVideoFacts(v: LifeTreasureVideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const ok = checkedLifeTreasure(v, today);
  if (typeof ok === "string") return undefined;
  const t = lifeTreasureTable(today);
  if (t.expired) return undefined;
  const term = termAt(t, ok.variant);
  const annual = annualOf(t, ok.variant, ok);
  const card = quoteCard(planCard(ok), today);
  const table = valueTableCard(planCard(ok), today);
  if (!annual || !card?.summary || !card.perDay || !card.legacy || !table?.rows.length) return undefined;
  const rows = table.rows;
  const py = payYears(term);
  const total = totalPaid(annual.total, term);
  const atLeast = rows.some((r) => digits(r.cover) > ok.sumAssured);
  const beIndex = rows.findIndex((r) => r.breakEven);
  const be = beIndex >= 0 ? rows[beIndex] : undefined;
  // the page's own milestones (lifetreasure-quote.ts cashAt): the cash at 70 and when cover ends
  const marks = cashAt(term, ok.sex, ok.age, ok.sumAssured, t.ageMin);
  const end = marks[marks.length - 1];
  const at70 = marks.find((m) => m.age === 70 && m !== end);
  const terms: LifeTreasureTermRow[] = LIFETREASURE_VARIANTS.flatMap((variant) => {
    const a = annualOf(t, variant, ok);
    if (!a) return [];
    const x = termAt(t, variant);
    const sum = totalPaid(a.total, x);
    const times = timesOf(ok.sumAssured, sum);
    return [{ variant, years: payYears(x), annual: formatBaht(a.total), total: formatBaht(sum), ...(times ? { times } : {}), on: variant === ok.variant }];
  });
  const times = timesOf(ok.sumAssured, total);
  const spoken = card.summary.rows.find((r) => r.label === "รายเดือน") ?? card.summary.rows.find((r) => r.main) ?? card.summary.rows[0];
  const yearly = card.summary.rows.find((r) => r.label === "รายปี");
  const g: LifeTreasureVideoFacts = {
    sum: ok.sumAssured, variant: ok.variant, payYears: py, lastPayAge: ok.age + py - 1, coverToAge: t.coverToAge,
    annual: formatBaht(annual.total), paid: total / 100, ...(times ? { times } : {}),
    atLeast, floorPercent: t.topUp.premiumPercent, endCash: end?.amount ?? digits(rows[rows.length - 1].cash ?? "0"),
    ...(at70 ? { at70: at70.amount } : {}), terms,
  };
  return {
    product: "LIFETREASURE",
    planLine: card.planLine.split(" · ")[0],
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: ok.sex,
    age: ok.age,
    lead: { label: atLeast ? "เงินก้อนส่งต่อให้ครอบครัว อย่างน้อย" : "เงินก้อนส่งต่อให้ครอบครัว", amount: card.legacy.amount, baht: ok.sumAssured, ...(card.legacy.note ? { note: card.legacy.note } : {}) },
    leadMark: `จ่าย ${py} ปี · คุ้มครองถึงอายุ ${g.coverToAge}`,
    leadPill: "ระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด",
    contactLine: "แบ่งให้ใครเท่าไร ระบุได้",
    priceMark: card.perDay,
    ...(yearly ? { priceBig: { label: "ออมปีละ", amount: yearly.amount, unit: "บาท" } } : {}),
    perDayAmount: card.perDay.replace(/[^\d,]/g, ""),
    priceTitle: card.summary.title,
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.main })),
    spokenPrice: { per: spoken.label === "รายปี" ? "ปีละ" : spoken.label === "ราย 6 เดือน" ? "งวดละ" : "เดือนละ", amount: spoken.amount },
    pills: [`จ่าย ${py} ปี แล้วจบ`, "ยอดออมเท่าเดิมทุกปี"],
    penNote: `จ่ายครบอายุ ${g.lastPayAge} แล้วหยุดส่ง`,
    priceNotes: [],
    coverTitle: "เลือกระยะจ่ายได้",
    cover: [{ label: `ทุกช่วงอายุ ถึงอายุ ${g.coverToAge}`, amount: ltMoney(ok.sumAssured), mark: true }],
    coverStyle: "rows",
    coverNote: `เบี้ยล็อกที่อายุ${ok.age === 0 ? "" : " "}${ageWord(ok.age)} เท่าเดิมทุกปี`,
    coverToAge: g.coverToAge,
    payYears: py,
    lastPayAge: g.lastPayAge,
    rows,
    totalPaid: ltMoney(g.paid),
    // a break-even past the chart's first two thirds is not told (as อีซี่ โพรเทค 6's): the clip says the cash at the end instead
    ...(be?.cash && (beIndex + 1) / rows.length <= 0.65 ? { breakEven: { age: be.age, cash: be.cash, index: beIndex } } : {}),
    footNote: card.footNotes?.[card.footNotes.length - 1],
    screenNote: be ? `เวนคืนก่อนปีที่ ${beIndex + 1} อาจได้น้อยกว่าเบี้ยที่จ่าย` : "เวนคืนอาจได้น้อยกว่าเบี้ยที่จ่าย",
    lifetreasure: g,
  };
}

/** "อย่างน้อย 10 ล้านบาท" / "10 ล้านบาท": what the family receives, as said */
export const ltFamily = (g: LifeTreasureVideoFacts, said: (baht: number) => string): string => `${g.atLeast ? "อย่างน้อย " : ""}${said(g.sum)}`;

/** "Life Treasure ส่งต่อเงิน 10 ล้านบาท คุ้มครองถึงอายุ 99 ค่ะ" */
export const ltLeadLine = (g: LifeTreasureVideoFacts, said: (baht: number) => string): string =>
  `Life Treasure ส่งต่อเงิน ${ltFamily(g, said)} คุ้มครองถึงอายุ ${g.coverToAge} ค่ะ`;

/** "สำหรับคุณผู้ชายอายุ 45 ปี ออมปีละ 475,000 บาท หรือเดือนละ 42,750 บาท จ่าย 12 ปีแล้วจบค่ะ" */
export function ltPriceLine(f: QuoteVideoFacts, g: LifeTreasureVideoFacts, who: string): string {
  const yearly = f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual;
  const other = f.spokenPrice.per === "ปีละ" ? "" : ` หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`;
  // a newborn is "แรกเกิด", not "อายุ 0 ปี"
  const forWho = f.age === 0 ? "เด็กแรกเกิด" : `${who} ปี`;
  return `สำหรับ${forWho} ออมปีละ ${yearly} บาท${other} จ่าย ${g.payYears} ปีแล้วจบค่ะ`;
}

/** "เลือกจ่าย 6 ปี 12 ปี หรือ 18 ปีก็ได้ ให้พอดีกับรายได้ช่วงนี้ค่ะ" */
export function ltTermsLine(g: LifeTreasureVideoFacts): string {
  const years = g.terms.map((x) => x.years);
  const said = years.length > 1 ? `${years.slice(0, -1).map((y) => `${y} ปี`).join(" ")} หรือ ${years[years.length - 1]} ปีก็ได้` : `${years[0]} ปี`;
  return `เลือกจ่าย ${said} ให้พอดีกับรายได้ช่วงนี้ค่ะ`;
}

/** "ออมรวม 5,700,000 บาท แต่ส่งต่อให้ครอบครัวได้ 10 ล้านบาท คิดเป็น 1.8 เท่าของที่ออมค่ะ" */
export const ltTotalLine = (g: LifeTreasureVideoFacts, said: (baht: number) => string): string =>
  `ออมรวม ${ltMoney(g.paid)} บาท แต่ส่งต่อให้ครอบครัวได้ ${ltFamily(g, said)} คิดเป็น ${g.times} เท่าของที่ออมค่ะ`;

/** the cash value along the way: the break-even where it is told ("ครบเท่าที่ออม"), then the cash when cover ends */
export function ltValueLine(f: QuoteVideoFacts, g: LifeTreasureVideoFacts, said: (baht: number) => string): string {
  const start = `ระหว่างทาง แผนนี้ก็มีมูลค่าเงินสด ออมครบตอนอายุ ${g.lastPayAge} แล้วเงินก็ยังโตทุกปี`;
  const end = g.endCash === g.sum ? `ได้ ${said(g.endCash)}เต็มค่ะ` : `มูลค่าเงินสด ${said(g.endCash)}ค่ะ`;
  return f.breakEven
    ? `${start} พออายุ ${f.breakEven.age} มูลค่าเงินสด ${f.breakEven.cash} บาท ครบเท่าที่ออมไปแล้ว และถึงอายุ ${g.coverToAge} ${end}`
    : `${start} ถึงอายุ ${g.coverToAge} ${end}`;
}
