import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { budgetFit } from "@/lib/budget-sum";
import type { CardRiders, PlanCardInput } from "@/lib/card-link";
import { currentRiders, lifeProtectPriced } from "@/lib/lifeprotect-card";
import { lifeProtectModes, payYears as payYearsOf, termAt } from "@/lib/lifeprotect-quote";
import { quoteCard, valueTableCard } from "@/lib/quote-card";
import { TWELVEPL_SUMS, twelvePlLinkSum } from "@/lib/quote-pdf/pages";
import { excelRound, twelvePlTotals, twelvePlYears } from "@/lib/twelvepl-benefits";
import { TWELVEPL_PLAN, twelvePlTable } from "@/lib/twelvepl-table";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * 12 พีแอล in วิดีโอนำเสนอ (owner, 2026-11-26, ก ก ข on mockup https://claude.ai/artifact/7eC8eVjT4mFAsSaPie4kfm):
 * the eighth plan, the /12pl page's — twelve years paid, a cash back every year from the second, 115% of
 * the sum at 85 — a sum, an age, a sex, the riders its page sells, and the company's dividend example the
 * clip shows (none, 2 or 3; 2 to start, as the page opens). Every figure is the page's own (twelvepl-benefits.ts
 * and the quote card).
 *
 * Its words: "ออม". The cash backs and the maturity are said as certain, always with "ถือครบถึงอายุ 85"
 * where they are added up; the dividend never is: on screen and in the voice it is "ประมาณ" and "ไม่การันตี".
 * The fifth scene sets what the plan itself costs beside what comes back — never the riders' premium,
 * which nothing pays back.
 */

export type TwelvePlVideoInput = Extract<VideoInput, { product: "TWELVEPL" }>;
/** the company's dividend example a clip shows; 0 = none (example 1 pays nothing) */
export type TwelvePlDividend = 0 | 2 | 3;
export const TWELVEPL_DIVIDENDS: readonly TwelvePlDividend[] = [0, 2, 3];
export const TWELVEPL_DEFAULT_DIVIDEND: TwelvePlDividend = 2;
export const TWELVEPL_NAME = "12PL";
export const TWELVEPL_PAGE = "/12pl";

/**
 * Tax relief is said from this age: below it the insured has no income of their own to take it off, and at
 * some of those ages the yearly cash back (1% of the sum) passes 20% of the yearly premium, where the
 * Revenue Department gives none.
 */
export const TWELVEPL_TAX_AGE = 20;
const TAX_CAP = 100_000;

/** 12 พีแอล's part of the facts */
export interface TwelvePlVideoFacts {
  sum: number;
  payYears: number;
  /** the age of the last premium, and the age cover ends and the maturity is paid */
  lastPayAge: number;
  coverToAge: number;
  /** the plan's own yearly premium, whole baht as the page prints it, and the twelve years of it */
  annual: string;
  paid: number;
  /** the yearly cash back: the first (year 2), the full one and the year it is reached, the last year before the maturity */
  cashFirst: number;
  cashFull: number;
  cashFullYear: number;
  lastCashYear: number;
  /** each year's, from year 2 to lastCashYear, for the drawing */
  cash: number[];
  /** certain: the cash backs, the maturity with its last cash back, the two together */
  cashBacks: number;
  maturity: number;
  guaranteed: number;
  /** what staying to the end pays, % of the sum, before that year's cash back */
  maturityPct: number;
  /** the dividend example shown, never certain; and everything received with it */
  dividend?: { example: 2 | 3; total: number };
  total: number;
  /** what the plan's premium takes off taxable income a year; absent under TWELVEPL_TAX_AGE */
  tax?: number;
  /** with riders: what they cost this year, as the screen says it */
  ridersAnnual?: string;
}

export const tpMoney = (n: number) => excelRound(n).toLocaleString("en-US");
const digits = (s: string) => Number(s.replace(/[^\d.]/g, ""));
const dividendOf = (v: unknown): TwelvePlDividend => (v === 0 || v === 2 || v === 3 ? v : TWELVEPL_DEFAULT_DIVIDEND);

const planCard = (v: Pick<TwelvePlVideoInput, "age" | "sex" | "sumAssured" | "riders" | "hide">): PlanCardInput => ({
  kind: "plan", planCode: TWELVEPL_PLAN, variant: TWELVEPL_PLAN, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
  ...(v.riders ? { riders: v.riders } : {}),
  ...(v.hide?.length ? { hide: v.hide } : {}),
});

export const TWELVEPL_RIDERS_NOT_SOLD = "สัญญาเพิ่มเติมที่เลือกซื้อไม่ได้ในอายุหรือทุนนี้ เอาสัญญานั้นออก หรือเปลี่ยนอายุ / ทุน";

/** What the form sent, checked; `riders` is already read through a link's own shape (check-input.ts). The words for what is wrong otherwise. */
export function checkedTwelvePl(v: TwelvePlVideoInput, riders: CardRiders | undefined, today: Date = new Date()): TwelvePlVideoInput | string {
  const t = twelvePlTable(today);
  if (v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!twelvePlLinkSum(v.sumAssured)) return "ทุนประกัน 100,000 – 50,000,000 บาท";
  const kept = currentRiders(riders, today, TWELVEPL_PLAN);
  const plan = { age: v.age, sex: v.sex, sumAssured: v.sumAssured };
  if (kept && !lifeProtectPriced(planCard({ ...plan, riders: kept }), today) && lifeProtectPriced(planCard(plan), today)) return TWELVEPL_RIDERS_NOT_SOLD;
  return { product: "TWELVEPL", ...plan, dividend: dividendOf(v.dividend), ...(kept ? { riders: kept } : {}) };
}

/**
 * The biggest of the page's sums whose instalment fits, plan and riders together; the words for why none
 * does otherwise. A sum the riders cannot be bought on has no price and is passed over (budget.ts).
 */
export function twelvePlFromBudget(v: TwelvePlVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): TwelvePlVideoInput | string {
  const t = twelvePlTable(today);
  const none = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";
  if (t.expired || v.age < t.ageMin || v.age > t.ageMax) return none;
  const term = termAt(t, TWELVEPL_PLAN);
  const price = (sum: number): ModePremium[] | undefined => (v.riders
    ? lifeProtectPriced(planCard({ ...v, sumAssured: sum, hide: undefined }), today)?.paid
    : lifeProtectModes(t, term, { sex: v.sex, age: v.age, sumAssured: sum }));
  const fit = budgetFit(TWELVEPL_SUMS, price, budget);
  if (fit) return { ...v, sumAssured: fit.sum, budget };
  const first = TWELVEPL_SUMS.find((s) => price(s));
  const mode = budget.per === "month" ? "monthly" : "annual";
  const at = first === undefined ? undefined : price(first)?.find((m) => m.mode === mode);
  if (first === undefined || !at) return v.riders ? TWELVEPL_RIDERS_NOT_SOLD : none;
  return `งบนี้ยังไม่พอสำหรับทุนต่ำสุด ${first.toLocaleString("en-US")}${v.riders ? " รวมสัญญาเพิ่มเติม" : ""} (เริ่มที่${budget.per === "month" ? "เดือนละ" : "ปีละ"} ${formatBaht(at.total)} บาท)`;
}

type RidersOf = (
  riders: CardRiders | undefined, rows: NonNullable<ReturnType<typeof valueTableCard>>["rows"],
  split: { title: string; rows: { label: string; amount: string }[] }, spokenLabel: string,
  at: { age: number; payYears: number; today: Date },
) => QuoteVideoFacts["riders"];

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. `ridersOf`: script.ts riderFacts. */
export function twelvePlVideoFacts(v: TwelvePlVideoInput, today: Date, ridersOf: RidersOf): QuoteVideoFacts | undefined {
  const ok = checkedTwelvePl(v, v.riders, today);
  if (typeof ok === "string") return undefined;
  const t = twelvePlTable(today);
  if (t.expired) return undefined;
  const term = termAt(t, TWELVEPL_PLAN);
  const annual = lifeProtectModes(t, term, ok)?.find((m) => m.mode === "annual");
  const card = quoteCard(planCard(ok), today);
  // every price the clip says is the year's, so each rider's share is read off the yearly split
  const yearly = quoteCard(planCard({ ...ok, hide: ["monthly", "semi"] }), today);
  const table = valueTableCard(planCard(ok), today);
  if (!annual || !card?.summary || !card.perDay || !yearly?.summary || !table) return undefined;
  const years = twelvePlYears(t.benefits, ok.age, t.ageMin, ok.sumAssured);
  const totals = twelvePlTotals(years, t.benefits.maturityPer1000, ok.sumAssured);
  const py = payYearsOf(term, ok.age);
  const coverToAge = t.benefits.coverToAge;
  const cash = years.slice(1, -1).map((r) => r.cashBack);
  const cashFull = Math.max(...cash);
  const example = ok.dividend === 0 ? undefined : ok.dividend;
  const dividendTotal = example ? totals.dividends[example - 1] ?? 0 : 0;
  const dividend = example && dividendTotal > 0 ? { example, total: dividendTotal } : undefined;
  const split = yearly.summary.split;
  const riders = ok.riders && split
    ? ridersOf(ok.riders, table.rows, split, "รายปี", { age: ok.age, payYears: py, today }) : undefined;
  const annualBaht = annual.total / 100;
  const tax = ok.age >= TWELVEPL_TAX_AGE ? Math.min(TAX_CAP, Math.round(annualBaht)) : undefined;
  const ridersAnnual = riders && split ? split.rows.slice(1).reduce((s, r) => s + digits(r.amount), 0) : undefined;
  const g: TwelvePlVideoFacts = {
    sum: ok.sumAssured, payYears: py, lastPayAge: ok.age + py - 1, coverToAge, annual: formatBaht(annual.total), paid: annualBaht * py,
    cashFirst: cash[0], cashFull, cashFullYear: cash.indexOf(cashFull) + 2, lastCashYear: years.length - 1, cash,
    cashBacks: totals.cashBacks, maturity: totals.maturity, guaranteed: totals.guaranteed, maturityPct: t.benefits.maturityPer1000 / 10,
    ...(dividend ? { dividend } : {}), total: totals.guaranteed + (dividend?.total ?? 0),
    ...(tax !== undefined ? { tax } : {}),
    ...(ridersAnnual !== undefined ? { ridersAnnual: ridersAnnual.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(ridersAnnual) ? 0 : 2, maximumFractionDigits: 2 }) } : {}),
  };
  const year = yearly.summary.rows.find((r) => r.label === "รายปี");
  if (!year) return undefined;
  const perDay = card.perDay.replace(/[^\d,]/g, "");
  const n = riders?.scenes.length ?? 0;
  const own = riders ? "สัญญาหลัก" : "";
  return {
    product: "TWELVEPL",
    planLine: card.planLine.split(" · ")[0],
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: ok.sex,
    age: ok.age,
    lead: { label: `ถือครบถึงอายุ ${coverToAge} รับการันตีรวม`, amount: tpMoney(g.guaranteed), baht: excelRound(g.guaranteed) },
    leadMark: `ออมวันละ ${perDay} บาท`,
    priceMark: `วันละ ${perDay} บาท`,
    perDayAmount: perDay,
    priceTitle: "ยอดออม",
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.label === "รายปี" })),
    spokenPrice: { per: "ปีละ", amount: year.amount },
    pills: [
      riders ? `สัญญาหลักจ่ายแค่ ${py} ปี เท่าเดิมทุกปี` : `เท่าเดิมทุกปี จ่ายแค่ ${py} ปี`,
      ...(tax !== undefined ? [`${own}ลดหย่อนภาษีได้ ${tpMoney(tax)}/ปี`] : []),
    ],
    priceNotes: riders
      ? [`สัญญาหลัก ${g.annual} + ${n > 1 ? `สัญญาเพิ่มเติม ${n} ตัว` : "สัญญาเพิ่มเติม"} ${g.ridersAnnual}\u00a0บาทต่อปี`, ...(riders.rises ? ["สัญญาเพิ่มเติมเป็นเบี้ยปีนี้ ปรับตามอายุ"] : [])]
      : [],
    ...(riders ? { riders } : {}),
    coverTitle: "เงินคืนทุกปี + ก้อนใหญ่ตอนครบ",
    cover: [
      { label: `เงินคืนทุกปี (ปีที่ 2–${g.lastCashYear}) รวม`, amount: tpMoney(g.cashBacks), mark: false },
      { label: `ครบอายุ ${coverToAge} รับ ${g.maturityPct}% + คืนปีสุดท้าย 1%`, amount: tpMoney(g.maturity), mark: true },
      { label: "รวมเงินการันตี", amount: tpMoney(g.guaranteed), mark: false },
    ],
    coverStyle: "cashback",
    coverToAge,
    payYears: py,
    lastPayAge: g.lastPayAge,
    totalPaid: tpMoney(g.paid),
    footNote: `เงินการันตีได้แน่นอนเมื่อถือครบถึงอายุ ${coverToAge}${dividend ? " · เงินปันผลไม่การันตี เป็นตัวอย่างเท่านั้น" : ""}`,
    screenNote: `เวนคืนก่อนครบสัญญาอาจได้น้อยกว่าเบี้ยที่จ่าย${dividend ? " · เงินปันผลไม่การันตี เป็นตัวอย่างเท่านั้น" : ""}`,
    twelvepl: g,
  };
}

/** "ออมเพียง 12 ปี ถือครบถึงอายุ 85 รับเงินการันตีรวม 1,580,000 บาทค่ะ" */
export const tpLeadLine = (g: TwelvePlVideoFacts): string =>
  `ออมเพียง ${g.payYears} ปี ถือครบถึงอายุ ${g.coverToAge} รับเงินการันตีรวม ${tpMoney(g.guaranteed)} บาทค่ะ`;

/** the price: what the year costs, and with riders what that includes and which part moves with age */
export function tpPriceLine(f: QuoteVideoFacts, g: TwelvePlVideoFacts): string {
  const lead = `ออมแค่วันละ ${f.perDayAmount} บาท หรือ${f.spokenPrice.per} ${f.spokenPrice.amount} บาท`;
  const sc = f.riders?.scenes ?? [];
  if (!f.riders) return `${lead} เท่าเดิมทุกปี ออม ${g.payYears} ปีก็ครบ${g.tax !== undefined ? " แล้วยังนำไปลดหย่อนภาษีได้ด้วย" : ""}ค่ะ`;
  const what = sc.length > 1 ? `สัญญาเพิ่มเติมอีก ${sc.length} ตัว` : f.riders.said;
  return `${lead} รวมสัญญาหลักกับ${what}${/[A-Za-z0-9]$/.test(what) ? " " : ""}ไว้แล้ว สัญญาหลักออมเพียง ${g.payYears} ปีก็ครบ${g.tax !== undefined ? " ลดหย่อนภาษีได้ด้วย" : ""}${f.riders.rises ? " ส่วนสัญญาเพิ่มเติมปรับตามอายุ" : ""}ค่ะ`;
}

export const tpCashLine = (g: TwelvePlVideoFacts): string =>
  `ตั้งแต่ปีที่ 2 มีเงินคืนทุกปี เริ่มที่ ${tpMoney(g.cashFirst)} บาท เพิ่มขึ้นจนได้ปีละ ${tpMoney(g.cashFull)} บาท ตั้งแต่ปีที่ ${g.cashFullYear} พอครบอายุ ${g.coverToAge} รับก้อนใหญ่อีก ${tpMoney(g.maturity)} บาท ส่วนนี้ได้แน่นอนค่ะ`;

export const tpFamilyLine = (g: TwelvePlVideoFacts): string =>
  `ระหว่างทางถ้าเป็นอะไรไป ครอบครัวได้ ${tpMoney(g.sum)} บาท ออมปีสุดท้ายตอนอายุ ${g.lastPayAge} แต่คุ้มครองต่อไปถึงอายุ ${g.coverToAge} เลยค่ะ`;

export const tpTotalLine = (g: TwelvePlVideoFacts, riders: boolean): string =>
  `${riders ? "เฉพาะสัญญาหลัก" : "สรุปแล้ว"} ออมรวม ${tpMoney(g.paid)} บาท ถือครบถึงอายุ ${g.coverToAge} รับการันตีรวม ${tpMoney(g.guaranteed)} บาท`
  + (g.dividend ? ` ถ้ามีปันผลตามตัวอย่างที่ ${g.dividend.example} รวมรับประมาณ ${tpMoney(g.total)} บาท ส่วนปันผลไม่การันตีนะคะ` : "ค่ะ");
