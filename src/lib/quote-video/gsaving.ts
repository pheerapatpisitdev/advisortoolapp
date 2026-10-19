import {
  GS_AGE_MAX, GS_AGE_MIN, GS_MAX_PREMIUM, GS_MIN_PREMIUM, GS_PREM_YEARS, GS_TAX_CAP, GS_TERM,
  premiumFromSa, quoteGlobalSaving, scenario,
} from "@/calc/global-saving/engine";
import { perDayText } from "@/lib/legacy-cta";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * Global Savings Plus 15/8 in วิดีโอนำเสนอ (owner, 2026-10-20, storyboard
 * https://claude.ai/artifact/BKLRMPpKEaG81BdXBKCsv9): the seventh plan, the /global-saving page's
 * index-linked savings plan — a yearly premium, an age and a sex (the sex only for how the voice
 * addresses the customer), and the index's yearly return the clip's example is worked at, −1% to
 * +5% a whole percent at a time (the owner's own addition: the agent picks it when making the clip).
 * Every figure is the page's own engine (src/calc/global-saving/engine.ts).
 *
 * Its words: "ออม" (it is a savings plan). The guarantee — 1% of the sum back each year, 801% at
 * maturity — is said as certain; the index bonus never is: on screen and in the voice it is
 * always "ประมาณ" and "ไม่การันตี". At 0% or below the clip says the guarantee is paid in full.
 * Its fourth scene ("index") sets the seven returns side by side where the others have their value
 * table, the picked one gold.
 */

export type GsVideoInput = Extract<VideoInput, { product: "GSAVING" }>;

export const GS_NAME = "Global Savings 15/8";
export const GS_PAGE = "/global-saving";
/** the returns the agent may pick, and the one the form opens on */
export const GS_RATES = [-1, 0, 1, 2, 3, 4, 5] as const;
export const GS_DEFAULT_RATE = 3;
/** the premium the page opens on, and so the form */
export const GS_DEFAULT_PREMIUM = 50_000;

/** one index return as the fourth scene's bars show it */
export interface GsBar { rate: number; total: number; on: boolean }

/** the returns the classic clip's table sets side by side (owner, 2026-10-20, ก ก): one weak, the middle, one strong */
export const GS_TABLE_RATES = [-1, 3, 5] as const;

/** one policy year of the classic clip's table; `bonus` only in the years the index bonus is paid, one per GS_TABLE_RATES */
export interface GsTableRow { year: number; age: number; premium: number; payback: number; death: number; bonus?: number[] }

/** Global Savings' part of the facts */
export interface GsVideoFacts {
  /** the yearly premium, whole baht */
  premium: number;
  sa: number;
  /** "137": the premium a day, as the other plans round it (up) */
  perDay: string;
  /** the picked index return, % a year */
  rate: number;
  payYears: number;
  term: number;
  /** what the customer pays in all */
  paid: number;
  /** 1% of the sum, back each year to the one before maturity */
  payback: number;
  maturity: number;
  /** the yearly paybacks and the maturity together: certain */
  guaranteed: number;
  /** the life cover in the first year, and at its highest */
  deathFirst: number;
  deathMax: number;
  /** the index bonus at the end of year 10 and at maturity, at the picked return */
  bonus10: number;
  bonus15: number;
  /** everything received at the picked return */
  total: number;
  /** what the premium takes off taxable income a year */
  taxYearly: number;
  bars: GsBar[];
  /** the classic clip's yearly table, and everything received at each of GS_TABLE_RATES */
  rows: GsTableRow[];
  totals: number[];
}

const money = (n: number) => Math.round(n).toLocaleString("en-US");
/** "+3%", "0%", "−1%" */
export const rateLabel = (r: number) => `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}%`;

/** What the form sent, checked: an age, a premium and a return the page allows. The words for what is wrong otherwise. */
export function checkedGsaving(v: GsVideoInput): GsVideoInput | string {
  if (!Number.isInteger(v.age) || v.age < GS_AGE_MIN || v.age > GS_AGE_MAX) return `แบบนี้รับประกันอายุ ${GS_AGE_MIN}–${GS_AGE_MAX} ปี`;
  if (!Number.isFinite(v.premium) || v.premium < GS_MIN_PREMIUM) return `เบี้ยขั้นต่ำ ${money(GS_MIN_PREMIUM)} บาท/ปี`;
  if (v.premium > GS_MAX_PREMIUM) return `เบี้ยต่อปีสูงสุด ${money(GS_MAX_PREMIUM)} บาท`;
  if (!(GS_RATES as readonly number[]).includes(v.rate)) return "เลือกดัชนีต่อปี −1% ถึง +5%";
  const q = quoteGlobalSaving({ basis: "premium", amount: Math.round(v.premium), age: v.age });
  if (q.warnings.length) return q.warnings[0];
  return { product: "GSAVING", age: v.age, sex: v.sex, premium: Math.round(v.premium), rate: v.rate };
}

/** the premium a sum assured costs, for the form's "from the sum" (whole baht, up) */
export function gsPremiumFromSum(sum: number, age: number): number {
  return Math.ceil(premiumFromSa(sum, age));
}

/**
 * A budget is the premium itself: the plan is paid once a year, so a monthly budget is twelve of
 * them. Under the minimum, or for a sum too small from 71, the words for why.
 */
export function gsFromBudget(v: GsVideoInput, budget: { baht: number; per: "month" | "year" }): GsVideoInput | string {
  const premium = budget.per === "month" ? budget.baht * 12 : budget.baht;
  if (premium < GS_MIN_PREMIUM) {
    return `งบนี้ยังไม่พอ แบบนี้ออมขั้นต่ำปีละ ${money(GS_MIN_PREMIUM)} บาท${budget.per === "month" ? ` (เดือนละประมาณ ${money(Math.ceil(GS_MIN_PREMIUM / 12))} บาท)` : ""}`;
  }
  const checked = checkedGsaving({ ...v, premium });
  return typeof checked === "string" ? checked : { ...checked, budget };
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function gsavingVideoFacts(v: GsVideoInput): QuoteVideoFacts | undefined {
  const ok = checkedGsaving(v);
  if (typeof ok === "string") return undefined;
  const q = quoteGlobalSaving({ basis: "premium", amount: ok.premium, age: ok.age });
  const at = scenario(q.sa, q.premium, ok.rate / 100, ok.age);
  const [b10, b15] = at.bonuses;
  const rows = q.scenarios[0].rows;
  const perDay = perDayText(Math.round(q.premium * 100));
  const who = `${ok.sex === "F" ? "หญิง" : "ชาย"} ${ok.age} ปี`;
  const compared = GS_TABLE_RATES.map((r) => scenario(q.sa, q.premium, r / 100, ok.age));
  const table: GsTableRow[] = rows.map((r) => {
    const paid = compared.map((c) => c.bonuses.find((b) => b.year === r.year));
    return {
      year: r.year, age: ok.age + r.year - 1, premium: r.premium, payback: r.payback, death: r.death,
      ...(paid[0] ? { bonus: paid.map((b) => b?.value ?? 0) } : {}),
    };
  });
  const g: GsVideoFacts = {
    premium: q.premium, sa: q.sa, perDay, rate: ok.rate, payYears: GS_PREM_YEARS, term: GS_TERM,
    paid: GS_PREM_YEARS * q.premium, payback: rows[0].payback, maturity: q.scenarios[0].maturity,
    guaranteed: q.guaranteed, deathFirst: rows[0].death, deathMax: rows[GS_PREM_YEARS - 1].death,
    bonus10: b10?.value ?? 0, bonus15: b15?.value ?? 0, total: at.total, taxYearly: Math.min(q.premium, GS_TAX_CAP),
    bars: GS_RATES.map((r) => ({ rate: r, total: scenario(q.sa, q.premium, r / 100, ok.age).total, on: r === ok.rate })),
    rows: table, totals: compared.map((c) => c.total),
  };
  return {
    product: "GSAVING",
    planLine: GS_NAME,
    insuredWho: who,
    insuredLine: `ออมปีละ ${money(q.premium)} บาท · ${GS_PREM_YEARS} ปี · ครบสัญญา ${GS_TERM} ปี`,
    sex: ok.sex,
    age: ok.age,
    lead: { label: "รับเงินการันตีรวม", amount: money(q.guaranteed), baht: Math.round(q.guaranteed) },
    leadMark: `ออมวันละ ${perDay} บาท`,
    priceMark: `วันละ ${perDay} บาท`,
    perDayAmount: perDay,
    priceTitle: "ยอดออม",
    prices: [{ label: "รายปี", amount: money(q.premium), main: true }],
    spokenPrice: { per: "ปีละ", amount: money(q.premium) },
    pills: [`เท่าเดิมทุกปี จ่ายแค่ ${GS_PREM_YEARS} ปี`, `ลดหย่อนภาษีได้ ${money(g.taxYearly)}/ปี`],
    priceNotes: [],
    coverTitle: "เงินคืนทุกปี + ก้อนใหญ่ตอนครบ",
    cover: [
      { label: `เงินคืน 1% ของทุน ทุกปี (ปีที่ 1–${GS_TERM - 1})`, amount: `${money(g.payback)}/ปี`, mark: false },
      { label: `ครบสัญญา ปีที่ ${GS_TERM} รับ 801% ของทุน`, amount: money(g.maturity), mark: true },
      { label: "รวมเงินการันตี", amount: money(g.guaranteed), mark: false },
    ],
    coverStyle: "payback",
    coverNote: `คุ้มครองชีวิตสูงสุด ${money(g.deathMax)} บาท`,
    coverToAge: ok.age + GS_TERM,
    payYears: GS_PREM_YEARS,
    lastPayAge: ok.age + GS_PREM_YEARS - 1,
    totalPaid: money(g.paid),
    footNote: "เงินการันตีได้แน่นอน · โบนัสดัชนีไม่การันตี เป็นตัวอย่างเท่านั้น ผลในอดีตไม่ยืนยันอนาคต",
    gsaving: g,
  };
}

/** "+ โบนัสตามดัชนีโลก": the opening's pill */
export const GS_BONUS_PILL = "+ โบนัสตามดัชนีโลก (ไม่การันตี)";

/** what the fourth scene says, by the picked return: the bonus as an example, or the guarantee in full */
export function gsIndexLine(g: GsVideoFacts): string {
  if (g.rate > 0) {
    return `ที่ชอบที่สุดคือ มีโบนัสตามดัชนีโลก ถ้าดัชนีโตเฉลี่ยปีละ ${g.rate}% รับโบนัสสิ้นปีที่ 10 ประมาณ ${money(g.bonus10)} บาท และตอนครบสัญญาอีกประมาณ ${money(g.bonus15)} บาท รวมรับทั้งหมดประมาณ ${money(g.total)} บาท ส่วนโบนัสนี้ไม่การันตีนะคะ`;
  }
  return `ที่ชอบที่สุดคือ ถึงดัชนีจะ${g.rate < 0 ? "ติดลบ" : "ไม่โตเลย"} ก็ยังได้เงินการันตี ${money(g.guaranteed)} บาทเต็มจำนวนค่ะ ถ้าดัชนีโตขึ้นจะมีโบนัสเพิ่ม ซึ่งส่วนนี้ไม่การันตีนะคะ`;
}

/** the lead sentence after the greeting: "ออมเพียง 8 ปี รับเงินการันตีรวม 407,916 บาท แถมมีโบนัสตามดัชนีโลกด้วยค่ะ" */
export function gsLeadLine(g: GsVideoFacts): string {
  return `ออมเพียง ${g.payYears} ปี รับเงินการันตีรวม ${money(g.guaranteed)} บาท แถมมีโบนัสตามดัชนีโลกด้วยค่ะ`;
}

export const gsMoney = money;
