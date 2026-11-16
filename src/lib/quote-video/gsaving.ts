import {
  GS_AGE_MAX, GS_AGE_MIN, GS_MAX_PREMIUM, GS_MIN_PREMIUM, GS_PREM_YEARS, GS_TAX_CAP, GS_TERM,
  premiumFromSa, quoteGlobalSaving, scenario,
} from "@/calc/global-saving/engine";
import {
  GS25_AGE_MAX, GS25_AGE_MIN, GS25_PREM_YEARS, GS25_TAX_CAP, GS25_TERM,
  premiumFromSa as premiumFromSa255, quoteGlobalSaving255, scenario as scenario255,
} from "@/calc/global-saving/engine-25-5";
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
 *
 * Global Savings Plus 25/5 is told by the same clip (owner, 2026-11-16: its page's สร้างวิดีโอ): the
 * input's `plan: "25/5"` picks its engine (src/calc/global-saving/engine-25-5.ts) and its own
 * figures — five paying years, 25 covered, 501% at maturity, the index bonus four times. Every
 * sentence that named 15/8's figures now reads them from the facts, so 15/8's clip says what it
 * said before, word for word.
 */

export type GsVideoInput = Extract<VideoInput, { product: "GSAVING" }>;

export const GS_NAME = "Global Savings 15/8";
export const GS_PAGE = "/global-saving";

/** which Global Savings plan a clip tells; absent on an input = 15/8, as every clip made before 25/5 */
export type GsPlan = "15/8" | "25/5";
export const GS_PLANS: readonly GsPlan[] = ["15/8", "25/5"];
export const gsPlanOf = (v: { plan?: string }): GsPlan => (v.plan === "25/5" ? "25/5" : "15/8");

/** one plan, as the clip needs to know it: its engine and the figures its words carry */
interface GsSpec {
  name: string;
  page: string;
  term: number;
  premYears: number;
  taxCap: number;
  ageMin: number;
  ageMax: number;
  /** the maturity payout, % of the sum */
  maturityPct: number;
  quote: (premium: number, age: number) => {
    sa: number; premium: number; guaranteed: number; warnings: string[];
    scenarios: { maturity: number; rows: { year: number; premium: number; payback: number; death: number }[] }[];
  };
  scenario: (sa: number, premium: number, rate: number, age: number) => { total: number; bonuses: { year: number; value: number }[] };
  premiumFromSa: (sa: number, age: number) => number;
}
const SPECS: Record<GsPlan, GsSpec> = {
  "15/8": {
    name: GS_NAME, page: GS_PAGE, term: GS_TERM, premYears: GS_PREM_YEARS, taxCap: GS_TAX_CAP, ageMin: GS_AGE_MIN, ageMax: GS_AGE_MAX,
    maturityPct: 801,
    quote: (premium, age) => quoteGlobalSaving({ basis: "premium", amount: premium, age }),
    scenario, premiumFromSa,
  },
  "25/5": {
    name: "Global Savings 25/5", page: "/global-saving-25-5", term: GS25_TERM, premYears: GS25_PREM_YEARS, taxCap: GS25_TAX_CAP,
    ageMin: GS25_AGE_MIN, ageMax: GS25_AGE_MAX, maturityPct: 501,
    quote: (premium, age) => quoteGlobalSaving255({ basis: "premium", amount: premium, age }),
    scenario: scenario255, premiumFromSa: premiumFromSa255,
  },
};
export const gsPlanName = (plan: GsPlan) => SPECS[plan].name;
export const gsPlanPage = (plan: GsPlan) => SPECS[plan].page;
/** "จ่าย 8 ปี ครบสัญญา 15 ปี": the form's line under the premium */
export const gsPlanTerms = (plan: GsPlan) => `จ่าย ${SPECS[plan].premYears} ปี ครบสัญญา ${SPECS[plan].term} ปี · รับอายุ ${SPECS[plan].ageMin}–${SPECS[plan].ageMax} ปี`;
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
  plan: GsPlan;
  /** the maturity payout, % of the sum: 801 or 501 */
  maturityPct: number;
  /** the policy years the index bonus is paid, maturity last */
  bonusYears: number[];
  /** every index bonus at the picked return, together */
  bonusAll: number;
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
  /** the index bonus at the end of year 10 and at maturity (15/8's year 15, 25/5's year 25), at the picked return */
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
  const plan = gsPlanOf(v), S = SPECS[plan];
  if (!Number.isInteger(v.age) || v.age < S.ageMin || v.age > S.ageMax) return `แบบนี้รับประกันอายุ ${S.ageMin}–${S.ageMax} ปี`;
  if (!Number.isFinite(v.premium) || v.premium < GS_MIN_PREMIUM) return `เบี้ยขั้นต่ำ ${money(GS_MIN_PREMIUM)} บาท/ปี`;
  if (v.premium > GS_MAX_PREMIUM) return `เบี้ยต่อปีสูงสุด ${money(GS_MAX_PREMIUM)} บาท`;
  if (!(GS_RATES as readonly number[]).includes(v.rate)) return "เลือกดัชนีต่อปี −1% ถึง +5%";
  const q = S.quote(Math.round(v.premium), v.age);
  if (q.warnings.length) return q.warnings[0];
  return { product: "GSAVING", age: v.age, sex: v.sex, premium: Math.round(v.premium), rate: v.rate, ...(plan === "25/5" ? { plan } : {}) };
}

/** the premium a sum assured costs, for the form's "from the sum" (whole baht, up) */
export function gsPremiumFromSum(sum: number, age: number, plan: GsPlan = "15/8"): number {
  return Math.ceil(SPECS[plan].premiumFromSa(sum, age));
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
  const plan = gsPlanOf(ok), S = SPECS[plan];
  const PY = S.premYears, T = S.term;
  const q = S.quote(ok.premium, ok.age);
  const at = S.scenario(q.sa, q.premium, ok.rate / 100, ok.age);
  const b10 = at.bonuses[0], b15 = at.bonuses[at.bonuses.length - 1];
  const rows = q.scenarios[0].rows;
  const perDay = perDayText(Math.round(q.premium * 100));
  const who = `${ok.sex === "F" ? "หญิง" : "ชาย"} ${ok.age} ปี`;
  const compared = GS_TABLE_RATES.map((r) => S.scenario(q.sa, q.premium, r / 100, ok.age));
  const table: GsTableRow[] = rows.map((r) => {
    const paid = compared.map((c) => c.bonuses.find((b) => b.year === r.year));
    return {
      year: r.year, age: ok.age + r.year - 1, premium: r.premium, payback: r.payback, death: r.death,
      ...(paid[0] ? { bonus: paid.map((b) => b?.value ?? 0) } : {}),
    };
  });
  const g: GsVideoFacts = {
    plan, maturityPct: S.maturityPct, bonusYears: at.bonuses.map((b) => b.year), bonusAll: at.bonuses.reduce((s, b) => s + b.value, 0),
    premium: q.premium, sa: q.sa, perDay, rate: ok.rate, payYears: PY, term: T,
    paid: PY * q.premium, payback: rows[0].payback, maturity: q.scenarios[0].maturity,
    guaranteed: q.guaranteed, deathFirst: rows[0].death, deathMax: rows[PY - 1].death,
    bonus10: b10?.value ?? 0, bonus15: b15?.value ?? 0, total: at.total, taxYearly: Math.min(q.premium, S.taxCap),
    bars: GS_RATES.map((r) => ({ rate: r, total: S.scenario(q.sa, q.premium, r / 100, ok.age).total, on: r === ok.rate })),
    rows: table, totals: compared.map((c) => c.total),
  };
  return {
    product: "GSAVING",
    planLine: S.name,
    insuredWho: who,
    insuredLine: `ออมปีละ ${money(q.premium)} บาท · ${PY} ปี · ครบสัญญา ${T} ปี`,
    sex: ok.sex,
    age: ok.age,
    lead: { label: "รับเงินการันตีรวม", amount: money(q.guaranteed), baht: Math.round(q.guaranteed) },
    leadMark: `ออมวันละ ${perDay} บาท`,
    priceMark: `วันละ ${perDay} บาท`,
    perDayAmount: perDay,
    priceTitle: "ยอดออม",
    prices: [{ label: "รายปี", amount: money(q.premium), main: true }],
    spokenPrice: { per: "ปีละ", amount: money(q.premium) },
    pills: [`เท่าเดิมทุกปี จ่ายแค่ ${PY} ปี`, `ลดหย่อนภาษีได้ ${money(g.taxYearly)}/ปี`],
    priceNotes: [],
    coverTitle: "เงินคืนทุกปี + ก้อนใหญ่ตอนครบ",
    cover: [
      { label: `เงินคืน 1% ของทุน ทุกปี (ปีที่ 1–${T - 1})`, amount: `${money(g.payback)}/ปี`, mark: false },
      { label: `ครบสัญญา ปีที่ ${T} รับ ${S.maturityPct}% ของทุน`, amount: money(g.maturity), mark: true },
      { label: "รวมเงินการันตี", amount: money(g.guaranteed), mark: false },
    ],
    coverStyle: "payback",
    coverNote: `คุ้มครองชีวิตสูงสุด ${money(g.deathMax)} บาท`,
    coverToAge: ok.age + T,
    payYears: PY,
    lastPayAge: ok.age + PY - 1,
    totalPaid: money(g.paid),
    footNote: "เงินการันตีได้แน่นอน · โบนัสดัชนีไม่การันตี เป็นตัวอย่างเท่านั้น ผลในอดีตไม่ยืนยันอนาคต",
    gsaving: g,
  };
}

/** "+ โบนัสตามดัชนีโลก": the opening's pill */
export const GS_BONUS_PILL = "+ โบนัสตามดัชนีโลก (ไม่การันตี)";

/** what the fourth scene says, by the picked return: the bonus as an example, or the guarantee in full */
export function gsIndexLine(g: GsVideoFacts): string {
  if (g.rate > 0 && g.bonusYears.length > 2) {
    // 25/5: the bonuses on the way are said together, the one at maturity on its own
    const mid = g.bonusYears.slice(0, -1);
    return `ที่ชอบที่สุดคือ มีโบนัสตามดัชนีโลก ถ้าดัชนีโตเฉลี่ยปีละ ${g.rate}% รับโบนัสสิ้นปีที่ ${mid.slice(0, -1).join(" ")} และ ${mid[mid.length - 1]} รวมประมาณ ${money(g.bonusAll - g.bonus15)} บาท และตอนครบสัญญาอีกประมาณ ${money(g.bonus15)} บาท รวมรับทั้งหมดประมาณ ${money(g.total)} บาท ส่วนโบนัสนี้ไม่การันตีนะคะ`;
  }
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

/** "สิ้นปีที่ 10 และตอนครบสัญญา" / "สิ้นปีที่ 10, 15, 20 และตอนครบสัญญา": when the index bonus is paid */
export function gsBonusWhen(g: Pick<GsVideoFacts, "bonusYears">): string {
  return `สิ้นปีที่ ${g.bonusYears.slice(0, -1).join(", ")} และตอนครบสัญญา`;
}

/**
 * A sentence written for 15/8, told for the plan the clip is of: its paying years, its term and
 * when its bonus is paid. 15/8's own comes back untouched. Only for Global Savings' own lines —
 * "15 ปี" means something else in a pension's.
 */
export function gsWords(text: string, g: Pick<GsVideoFacts, "plan" | "payYears" | "term" | "bonusYears">): string {
  if (g.plan === "15/8") return text;
  return text
    .replace(/สิ้นปีที่ 10 และตอนครบสัญญา/g, gsBonusWhen(g))
    .replace(/8 ปี/g, `${g.payYears} ปี`)
    .replace(/15 ปี/g, `${g.term} ปี`);
}
