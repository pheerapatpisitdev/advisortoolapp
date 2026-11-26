import { formatBaht } from "@/calc/money";
import { budgetFit } from "@/lib/budget-sum";
import type { PlanCardInput } from "@/lib/card-link";
import { easyProtectModes, leverage, payYears, termAt, totalPaid } from "@/lib/easyprotect-quote";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { ageWord } from "@/lib/lifeprotect-cta";
import { quoteCard, valueTableCard } from "@/lib/quote-card";
import { EASYPROTECT_SUMS } from "@/lib/quote-pdf/pages";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * อีซี่ โพรเทค 6 in วิดีโอนำเสนอ (owner, 2026-11-26, ก ก on mockup https://claude.ai/artifact/YCrrpCe5o2uQ14xAoQmZHn):
 * the ninth plan, the /easyprotect page's — six years paid, the sum covered flat to 99 — one of the page's
 * sums, an age, a sex. Its page sells no riders, so neither does the clip. Every figure is the page's own.
 *
 * Its third scene is the bargain: six premiums, then nothing left to pay and the cover still standing. The
 * fourth sets the premiums beside what the family receives, with the page's own multiple; from the age
 * where the premiums reach the sum it is left out. The 101% floor lifts an older insured's cover above the
 * sum, so there the family receives "อย่างน้อย" the sum. The value line says "ครบเท่าที่ออม", never more than
 * it: at some ages the break-even year pays back exactly what was paid.
 */

export type EasyProtectVideoInput = Extract<VideoInput, { product: "EASYPROTECT" }>;
export const EASYPROTECT_PLAN = "EASYPROTECT";
const VARIANT = "W99F06A";

export interface EasyProtectVideoFacts {
  sum: number;
  payYears: number;
  lastPayAge: number;
  coverToAge: number;
  /** the yearly premium as the page prints it, and the six years of it in baht */
  annual: string;
  paid: number;
  /** "2.5": the sum as a multiple of the premiums; absent where it is not clearly more than one */
  times?: string;
  /** the cover rises above the sum at some age (101% of the premiums, or the surrender value) */
  atLeast: boolean;
  floorPercent: number;
  /** the surrender value in the contract's last year */
  endCash: number;
}

export const epMoney = (n: number) => Math.round(n).toLocaleString("en-US");
const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));

const planCard = (v: Pick<EasyProtectVideoInput, "age" | "sex" | "sumAssured">): PlanCardInput => ({
  kind: "plan", planCode: EASYPROTECT_PLAN, variant: VARIANT, age: v.age, sex: v.sex, sumAssured: v.sumAssured,
});

const SUMS_WORD = `ทุนประกัน ${epMoney(EASYPROTECT_SUMS[0])} – ${epMoney(EASYPROTECT_SUMS[EASYPROTECT_SUMS.length - 1])} บาท ตามขั้นของหน้า Easy Protect 6 (ทีละแสน เกิน 3 ล้านทีละห้าแสน)`;

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedEasyProtect(v: EasyProtectVideoInput, today: Date = new Date()): EasyProtectVideoInput | string {
  const t = easyProtectTable(today);
  if (v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!EASYPROTECT_SUMS.includes(v.sumAssured)) return SUMS_WORD;
  return { product: "EASYPROTECT", age: v.age, sex: v.sex, sumAssured: v.sumAssured };
}

/** The biggest of the page's sums whose instalment fits; the words for why none does otherwise. */
export function easyProtectFromBudget(v: EasyProtectVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): EasyProtectVideoInput | string {
  const t = easyProtectTable(today);
  const none = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";
  if (t.expired || v.age < t.ageMin || v.age > t.ageMax) return none;
  const term = termAt(t, VARIANT);
  const price = (sum: number) => easyProtectModes(t, term, { sex: v.sex, age: v.age, sumAssured: sum });
  const fit = budgetFit(EASYPROTECT_SUMS, price, budget);
  if (fit) return { ...v, sumAssured: fit.sum, budget };
  const at = price(EASYPROTECT_SUMS[0])?.find((m) => m.mode === (budget.per === "month" ? "monthly" : "annual"));
  return at
    ? `งบนี้ยังไม่พอสำหรับทุนต่ำสุด ${epMoney(EASYPROTECT_SUMS[0])} (เริ่มที่${budget.per === "month" ? "เดือนละ" : "ปีละ"} ${formatBaht(at.total)} บาท)`
    : none;
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function easyProtectVideoFacts(v: EasyProtectVideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const ok = checkedEasyProtect(v, today);
  if (typeof ok === "string") return undefined;
  const t = easyProtectTable(today);
  if (t.expired) return undefined;
  const term = termAt(t, VARIANT);
  const annual = easyProtectModes(t, term, ok)?.find((m) => m.mode === "annual");
  const card = quoteCard(planCard(ok), today);
  const table = valueTableCard(planCard(ok), today);
  if (!annual || !card?.summary || !card.perDay || !card.legacy || !table?.rows.length) return undefined;
  const rows = table.rows;
  const last = rows[rows.length - 1];
  const py = payYears(term);
  const total = totalPaid(annual.total, term);
  const times = leverage(ok.sumAssured, total)?.toFixed(1);
  const atLeast = rows.some((r) => digits(r.cover) > ok.sumAssured);
  const beIndex = rows.findIndex((r) => r.breakEven);
  const be = beIndex >= 0 ? rows[beIndex] : undefined;
  const spoken = card.summary.rows.find((r) => r.label === "รายเดือน") ?? card.summary.rows.find((r) => r.main) ?? card.summary.rows[0];
  const g: EasyProtectVideoFacts = {
    sum: ok.sumAssured, payYears: py, lastPayAge: ok.age + py - 1, coverToAge: t.coverToAge,
    annual: formatBaht(annual.total), paid: total / 100,
    // "1.0 เท่า" says nothing: the comparison is told from 1.1 up
    ...(times && Number(times) > 1 ? { times } : {}),
    atLeast, floorPercent: t.topUp.premiumPercent, endCash: digits(last.cash ?? "0"),
  };
  return {
    product: "EASYPROTECT",
    planLine: card.planLine.split(" · ")[0],
    insuredWho: card.insuredWho,
    insuredLine: card.insuredLine,
    sex: ok.sex,
    age: ok.age,
    lead: { label: atLeast ? "มรดกอย่างน้อย" : "มรดก", amount: card.legacy.amount, baht: ok.sumAssured, ...(card.legacy.note ? { note: card.legacy.note } : {}) },
    leadMark: `จ่าย ${py} ปี คุ้มครองถึงอายุ ${g.coverToAge}`,
    priceMark: card.perDay,
    // the day's price under the opening's mark (motion.tsx Lead)
    leadPill: card.perDay,
    perDayAmount: card.perDay.replace(/[^\d,]/g, ""),
    priceTitle: card.summary.title,
    prices: card.summary.rows.map((r) => ({ label: r.label, amount: r.amount, main: r.main })),
    spokenPrice: { per: spoken.label === "รายปี" ? "ปีละ" : spoken.label === "ราย 6 เดือน" ? "งวดละ" : "เดือนละ", amount: spoken.amount },
    pills: [`จ่ายเบี้ยแค่ ${py} ปี`, "เบี้ยคงที่ตลอด"],
    penNote: `จ่ายครบอายุ ${g.lastPayAge} แล้วหยุดส่ง`,
    priceNotes: [],
    coverTitle: `จ่าย ${py} ปี แล้วจบ`,
    cover: [{ label: `ทุกช่วงอายุ ถึงอายุ ${g.coverToAge}`, amount: epMoney(ok.sumAssured), mark: true }],
    coverStyle: "paidup",
    coverNote: `เบี้ยล็อกที่อายุ${ok.age === 0 ? "" : " "}${ageWord(ok.age)} เท่าเดิมทุกปี`,
    coverToAge: g.coverToAge,
    payYears: py,
    lastPayAge: g.lastPayAge,
    rows,
    totalPaid: epMoney(g.paid),
    // a break-even past the chart's first two thirds (an insured in their late sixties and after) is not told: the clip says the table's cash instead
    ...(be?.cash && (beIndex + 1) / rows.length <= 0.65 ? { breakEven: { age: be.age, cash: be.cash, index: beIndex } } : {}),
    footNote: card.footNotes?.[card.footNotes.length - 1],
    screenNote: be ? `เวนคืนก่อนปีที่ ${beIndex + 1} อาจได้น้อยกว่าเบี้ยที่จ่าย` : "เวนคืนอาจได้น้อยกว่าเบี้ยที่จ่าย",
    easyprotect: g,
  };
}

/** "1 ล้านบาท" / "อย่างน้อย 500,000 บาท": what the family receives, as said */
export const epFamily = (g: EasyProtectVideoFacts, said: (baht: number) => string): string => `${g.atLeast ? "อย่างน้อย " : ""}${said(g.sum)}`;

export const epSixLine = (f: QuoteVideoFacts, g: EasyProtectVideoFacts, said: (baht: number) => string): string =>
  `ออมแค่ ${g.payYears} ปี ตั้งแต่อายุ ${f.age} ถึง ${g.lastPayAge} ปีที่ ${g.payYears + 1} เป็นต้นไป ไม่ต้องจ่ายอีกเลย แต่ดูแลครอบครัว${g.atLeast ? "" : " "}${epFamily(g, said)} ยาวไปถึงอายุ ${g.coverToAge} ค่ะ`;

export const epTotalLine = (g: EasyProtectVideoFacts, said: (baht: number) => string): string =>
  `ออมรวมทั้งหมด ${epMoney(g.paid)} บาท ครอบครัวได้${g.atLeast ? "" : " "}${epFamily(g, said)} คิดเป็น ${g.times} เท่าของที่ออมค่ะ`;

export const epValueLine = (f: QuoteVideoFacts, g: EasyProtectVideoFacts): string => (f.breakEven
  ? `ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ ${g.lastPayAge} แล้วเงินก็ยังโตทุกปี พออายุ ${f.breakEven.age} ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ ${f.breakEven.cash} บาท ครบเท่าที่ออมไปทั้งหมดแล้วค่ะ`
  : `ที่ชอบที่สุดคือ เงินที่ออมไปไม่หายไปไหน ออมครบตอนอายุ ${g.lastPayAge} แล้วเงินก็ยังโตทุกปี ถ้าอยากได้เงินก้อนคืน ก็ขอคืนได้ตามตารางเลยค่ะ`);

/**
 * The paid-up whole-life plans' shared figures (อีซี่ โพรเทค 6, ไลฟ์เทรเชอร์): a level premium for some years, the sum
 * to 99 with its 101% floor, the multiple and the cash at the end. The scenes they share read these.
 */
export type PaidUpFacts = Pick<EasyProtectVideoFacts, "sum" | "payYears" | "lastPayAge" | "coverToAge" | "paid" | "times" | "atLeast" | "endCash">;
export const paidUpOf = (f: Pick<QuoteVideoFacts, "easyprotect" | "lifetreasure">): PaidUpFacts | undefined => f.easyprotect ?? f.lifetreasure;
