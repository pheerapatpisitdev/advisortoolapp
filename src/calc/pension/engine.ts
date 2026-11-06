import plansJson from "../../../data/pension/plans.json";
import mainRatesJson from "../../../data/pension/main-rates.json";
import cashValuesJson from "../../../data/pension/cash-values.json";
import pvAnnualJson from "../../../data/pension/pv-annual.json";
import ridersJson from "../../../data/pension/riders.json";
import { premiumBasedAmounts } from "../riders/premium-based";
import { applyModeFactorToFixed, premiumPerThousand, toHundredths } from "../money";

/**
 * บำนาญ สมาร์ท 95 (A2026-1) — the main contract, premium to pension.
 *
 * A port of the agency's own calculator (Advisortool/pension-smart95/src/engine.js), which was
 * checked value by value against the company workbook recomputed in LibreOffice. The oracle it
 * was checked against travelled with it, into tests/golden/pension, and the tests here run it.
 *
 * It does not fit the registry the other plans share. Those take a sum and price it; this one
 * is as often asked the other way round — "I want 10,000 a month at sixty" — and what it
 * returns is a pension schedule rather than a death benefit. Three riders so far: WP, PB, DCI.
 *
 * The arithmetic is the workbook's, rounding included: ROUNDDOWN and ROUNDUP are not
 * Math.round, and the satang have to agree with the sheet.
 */

const rdown = (x: number, d: number) => { const f = 10 ** d; return Math.floor(x * f + 1e-9) / f; };
const rup = (x: number, d: number) => { const f = 10 ** d; return Math.ceil(x * f - 1e-9) / f; };

export type PensionAge = 55 | 60 | 65 | 70;
/** ชำระเบี้ย 6 ปี, or every year until the pension starts */
export type PensionPay = "6" | "untilAnnuity";
export type PensionMode = "annual" | "semi" | "monthly";
/** what the amount the person gave is: a sum assured, a premium per instalment, or a monthly pension */
export type PensionBasis = "sumAssured" | "premium" | "monthlyPension";

export const PENSION_AGES: PensionAge[] = [55, 60, 65, 70];

export const MODE_FACTOR: Record<PensionMode, number> = { annual: 1, semi: 0.52, monthly: 0.09 };
/** how many instalments a year each way of paying takes */
export const MODE_INSTALMENTS: Record<PensionMode, number> = { annual: 1, semi: 2, monthly: 12 };
export const MODE_LABEL: Record<PensionMode, string> = {
  annual: "รายปี", semi: "ราย 6 เดือน", monthly: "รายเดือน",
};

/** The calculator's own limits (app.js): issue age 20–65, sum assured 75,000–20,000,000. */
export const PENSION_LIMITS = { ageMin: 20, ageMax: 65, saMin: 75_000, saMax: 20_000_000 } as const;

/** Monthly pension per baht of sum assured in the first band (Data Fill Parameter!F51). */
export const MONTHLY_FACTOR_FIRST = 0.0127;

export interface PensionPlan {
  planCode: string;
  productName: string;
  annuityStartAge: number;
  issueAgeMin: number;
  issueAgeMax: number;
  paymentOption: string;
}

const PLANS = plansJson as PensionPlan[];
const MAIN_RATES = mainRatesJson as Record<string, Record<string, number>>;
const CASH_VALUES = cashValuesJson as Record<string, number[]>;
const PV_ANNUAL = pvAnnualJson as Record<string, number>;
const RIDER_RATES = ridersJson as {
  /** plancode + sex + insured age → paying term → rate per 100 baht of basic premium */
  WP: Record<string, Record<string, number>>;
  /** plancode + sex + payer age → paying term → rate per 100 baht of basic premium */
  PB: Record<string, Record<string, number>>;
  /** attained age → sex → rate per 1,000 baht of cover */
  DCI: Record<string, Record<"M" | "F", number>>;
};

const PAY_OPTION: Record<PensionPay, string> = { "6": "ชำระเบี้ย 6 ปี", untilAnnuity: "ชำระเบี้ย จนรับเงินบำนาญ" };

/** Annuity as a share of the sum assured, by attained age: ≤75 15%, 76–80 20%, 81–85 25%, 86–95 30%. */
export function annuityPercent(attainedAge: number): number {
  if (attainedAge <= 75) return 0.15;
  if (attainedAge <= 80) return 0.2;
  if (attainedAge <= 85) return 0.25;
  return 0.3;
}

export function pensionPlan(annuityAge: number, pay: PensionPay): PensionPlan | undefined {
  return PLANS.find((p) => p.annuityStartAge === annuityAge && p.paymentOption === PAY_OPTION[pay]);
}

/** Which pension ages a person of this age may choose, for this way of paying. */
export function availablePensionAges(age: number, pay: PensionPay): PensionAge[] {
  return PLANS
    .filter((p) => p.paymentOption === PAY_OPTION[pay] && age >= p.issueAgeMin && age <= p.issueAgeMax)
    .map((p) => p.annuityStartAge as PensionAge);
}

export type WaiverOption = "FIT" | "BEYOND";

export interface PensionRiders {
  /** waives the premiums if the insured is disabled (FIT) or also critically ill (BEYOND) */
  wp?: { option: WaiverOption };
  /** waives the premiums if the person paying them — a spouse, the insured being 20 or more — is */
  pb?: { option: WaiverOption; payerAge: number; payerSex: "M" | "F" };
  dci?: { sumAssured: number };
}

export const WAIVER_LABEL: Record<WaiverOption, string> = { FIT: "Fit", BEYOND: "Beyond" };

/**
 * DCI's own limits, read off the same rider's rules in every other plan here (data/rules/*.json):
 * ages 20–65, 200,000–10,000,000, cover to 75. The rate table is the same table to the satang.
 */
export const DCI_LIMITS = { ageMin: 20, ageMax: 65, saMin: 200_000, saMax: 10_000_000, coverToAge: 75 } as const;

export interface RiderLine {
  code: "WP" | "PB" | "DCI";
  label: string;
  rate: number;
  /** baht; zero when refused */
  annual: number;
  modePremium: number;
  /** why it cannot be bought on this arrangement */
  error?: string;
}

export interface PensionInput {
  age: number;
  sex: "M" | "F";
  annuityAge: number;
  pay: PensionPay;
  mode: PensionMode;
  basis: PensionBasis;
  /** baht: a sum assured, a premium for one instalment of `mode`, or a monthly pension */
  amount: number;
  riders?: PensionRiders;
}

export interface PensionYear {
  age: number;
  policyYear: number;
  premium: number;
  cumPremium: number;
  cashValue: number;
  pension: number;
  cumPension: number;
  deathBenefit: number;
}

export interface PensionBand { fromAge: number; toAge: number; percent: number; annual: number }

export interface PensionQuote {
  plan: PensionPlan;
  rate: number;
  sumAssured: number;
  annualPremium: number;
  modePremium: number;
  mode: PensionMode;
  payYears: number;
  /**
   * what the main contract costs a year in this way of paying: an instalment times the year's
   * instalments, and the year's premium in the illustration, totalPremium and irr. AdvisorZone
   * does the same (tests/golden/pension/advisorzone-monthly.json).
   */
  yearlyPaid: number;
  /** the same with every rider that could be bought */
  totalYearlyPaid: number;
  /** first-band pension paid monthly */
  monthlyPension: number;
  bands: PensionBand[];
  totalPremium: number;
  totalPension: number;
  illustration: PensionYear[];
  /** internal rate of return for someone who lives to 95, or null where it has no root */
  irr: number | null;
  riders: RiderLine[];
  /** main contract plus every rider that could be bought */
  totalModePremium: number;
  totalAnnualPremium: number;
}

export type PensionResult = { ok: true; quote: PensionQuote } | { ok: false; error: string };

export function mainRate(plan: PensionPlan, sex: "M" | "F", age: number): number {
  return MAIN_RATES[plan.planCode + sex]?.[String(age)] ?? 0;
}

function payYearsOf(plan: PensionPlan, age: number): number {
  return plan.paymentOption === PAY_OPTION["6"] ? 6 : plan.annuityStartAge - age;
}

/** Cal!C17 / C20: the sum assured the amount stands for. */
function sumAssuredFor(input: PensionInput, rate: number): number {
  if (input.basis === "sumAssured") return input.amount;
  if (input.basis === "premium") return rate > 0 ? rup((input.amount / rate) * 1000 / MODE_FACTOR[input.mode], 0) : 0;
  return rup(input.amount / MONTHLY_FACTOR_FIRST, 0);
}

/** The year-by-year table; `yearlyPremium` is what comes in a year, in whichever instalments it is paid. */
export function illustrate(plan: PensionPlan, sex: "M" | "F", age: number, sumAssured: number, yearlyPremium: number): PensionYear[] {
  const cv = CASH_VALUES[plan.planCode + sex + age] ?? [];
  const years = payYearsOf(plan, age);
  const start = plan.annuityStartAge;
  const rows: PensionYear[] = [];
  let cumPremium = 0;
  let cumPension = 0;
  for (let a = age; a <= 95; a++) {
    const policyYear = a - age + 1;
    const premium = policyYear <= years && a < start ? yearlyPremium : 0;
    cumPremium += premium;
    const cashValue = a < start ? Math.round(((cv[policyYear] ?? 0) * sumAssured) / 1000) : 0;
    const pension = a >= start ? Math.round(sumAssured * annuityPercent(a)) : 0;
    cumPension += pension;
    let deathBenefit: number;
    if (a < start) {
      // 100% of premiums paid in the first two policy years, 110% after, or the cash value
      deathBenefit = Math.max((policyYear <= 2 ? 1 : 1.1) * cumPremium, cashValue);
    } else {
      // fifteen payments are guaranteed: the present value of those still owed, or what was
      // paid in less what has come out, whichever is more; after that only the latter
      const left = Math.max(cumPremium - cumPension, 0);
      const pv = Math.round(((PV_ANNUAL[plan.planCode + a] ?? 0) * sumAssured) / 1000);
      deathBenefit = a < start + 14 ? Math.max(pv, left) : left;
    }
    rows.push({ age: a, policyYear, premium, cumPremium, cashValue, pension, cumPension, deathBenefit });
  }
  return rows;
}

function irrOf(rows: PensionYear[]): number | null {
  const cf = rows.map((r) => r.pension - r.premium);
  const npv = (rate: number) => cf.reduce((s, c, t) => s + c / (1 + rate) ** t, 0);
  let lo = -0.9;
  let hi = 1;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-4) return mid;
    if (npv(lo) * v < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function bandsOf(start: number, sumAssured: number): PensionBand[] {
  return [[75, 0.15], [80, 0.2], [85, 0.25], [95, 0.3]]
    .map(([to, percent], i, all) => ({ fromAge: i === 0 ? start : all[i - 1][0] + 1, toAge: to, percent }))
    .filter((b) => b.toAge >= start)
    .map((b) => ({ ...b, fromAge: Math.max(b.fromAge, start), annual: Math.round(sumAssured * b.percent) }));
}

const refused = (code: RiderLine["code"], label: string, error: string): RiderLine =>
  ({ code, label, rate: 0, annual: 0, modePremium: 0, error });

/**
 * WP and PB: Cal!G14/G15 — TRUNC(rate × TRUNC(basic premium / 100, 3), 2), the instalment
 * truncated off that. The same arithmetic the other plans use, so it is their function; and
 * the same rate tables to the satang (tests/golden/pension.test.ts compares them).
 *
 * The workbook's own PB and WP cells return 0, because the lookup that should give them the
 * paying term answers #N/A. The term here is the plan's: six years, or until the pension.
 */
function waiver(
  code: "WP" | "PB", table: Record<string, Record<string, number>>, key: string,
  label: string, payYears: number, annualPremium: number, mode: PensionMode,
): RiderLine {
  const rate = table[key]?.[String(payYears)];
  if (rate === undefined) return refused(code, label, "ไม่อยู่ในเกณฑ์ของตารางอัตราเบี้ย");
  // the basic premium on at most 30 million of cover; this plan stops at 20, so it is all of it
  const { annual, modal } = premiumBasedAmounts(rate, Math.round(annualPremium * 100), toHundredths(MODE_FACTOR[mode]));
  return { code, label, rate, annual: annual / 100, modePremium: modal / 100 };
}

function ridersFor(
  r: PensionRiders, age: number, sex: "M" | "F", payYears: number, annualPremium: number, mode: PensionMode,
): RiderLine[] {
  const lines: RiderLine[] = [];
  const both = r.wp && r.pb ? "เลือก WP หรือ PB อย่างใดอย่างหนึ่ง" : undefined;

  if (r.wp) {
    const label = `WP ${WAIVER_LABEL[r.wp.option]} (ยกเว้นเบี้ย)`;
    const plancode = r.wp.option === "BEYOND" ? "WPTPDCI" : "WPTPD";
    lines.push(both ? refused("WP", label, both)
      : age < 16 || age > 70 ? refused("WP", label, "ผู้เอาประกันอายุ 16–70 ปี")
        : waiver("WP", RIDER_RATES.WP, plancode + sex + age, label, payYears, annualPremium, mode));
  }
  if (r.pb) {
    const { option, payerAge, payerSex } = r.pb;
    const label = `PB ${WAIVER_LABEL[option]} (ผู้ชำระเบี้ย)`;
    const plancode = option === "BEYOND" ? "PBSDDCI" : "PBSDD";
    lines.push(both ? refused("PB", label, both)
      : !Number.isInteger(payerAge) || payerAge < 20 || payerAge > 70 ? refused("PB", label, "ผู้ชำระเบี้ยอายุ 20–70 ปี")
        : waiver("PB", RIDER_RATES.PB, plancode + payerSex + payerAge, label, payYears, annualPremium, mode));
  }
  if (r.dci) {
    const label = "DCI (โรคร้ายแรง)";
    const sa = r.dci.sumAssured;
    const rate = RIDER_RATES.DCI[String(age)]?.[sex];
    if (age < DCI_LIMITS.ageMin || age > DCI_LIMITS.ageMax || rate === undefined) {
      lines.push(refused("DCI", label, `ผู้เอาประกันอายุ ${DCI_LIMITS.ageMin}–${DCI_LIMITS.ageMax} ปี`));
    } else if (!(sa >= DCI_LIMITS.saMin && sa <= DCI_LIMITS.saMax)) {
      lines.push(refused("DCI", label, "ทุน DCI 200,000–10,000,000 บาท"));
    } else {
      // Cal!G20: ROUNDDOWN(rate × SA / 1000, 2); the instalment rounded down off that
      const annual = premiumPerThousand(toHundredths(rate), sa);
      const modal = applyModeFactorToFixed(annual, toHundredths(MODE_FACTOR[mode]));
      lines.push({ code: "DCI", label, rate, annual: annual / 100, modePremium: modal / 100 });
    }
  }
  return lines;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** The main contract and its riders; the refusals are the calculator's own sentences. */
/**
 * The whole-baht instalments, smallest and largest, that come to a sum inside the limits —
 * found by the same arithmetic that turns a premium into a sum. Undefined off the premium basis.
 */
export function premiumRange(input: PensionInput): { min: number; max: number } | undefined {
  const plan = pensionPlan(input.annuityAge, input.pay);
  const rate = plan ? mainRate(plan, input.sex, input.age) : 0;
  if (input.basis !== "premium" || !(rate > 0)) return undefined;
  const sa = (p: number) => sumAssuredFor({ ...input, amount: p }, rate);
  const per = MODE_FACTOR[input.mode] * rate / 1000;
  let min = Math.max(1, Math.ceil(PENSION_LIMITS.saMin * per));
  while (sa(min) < PENSION_LIMITS.saMin) min++;
  while (min > 1 && sa(min - 1) >= PENSION_LIMITS.saMin) min--;
  let max = Math.floor(PENSION_LIMITS.saMax * per);
  while (sa(max) > PENSION_LIMITS.saMax) max--;
  while (sa(max + 1) <= PENSION_LIMITS.saMax) max++;
  return { min, max };
}

/** Someone working from a premium is told the premium, not the sum, that the limits come to. */
function premiumBound(input: PensionInput, edge: "min" | "max"): string {
  const range = premiumRange(input);
  if (!range) return "";
  return ` — เบี้ย${edge === "min" ? "ขั้นต่ำ" : "สูงสุด"} ${range[edge].toLocaleString("en-US")} บาท (${MODE_LABEL[input.mode]})`;
}

export function quotePension(input: PensionInput): PensionResult {
  const { age, sex } = input;
  if (!Number.isInteger(age) || age < PENSION_LIMITS.ageMin || age > PENSION_LIMITS.ageMax) {
    return { ok: false, error: `รับประกันอายุ ${PENSION_LIMITS.ageMin}–${PENSION_LIMITS.ageMax} ปี` };
  }
  const plan = pensionPlan(input.annuityAge, input.pay);
  if (!plan) return { ok: false, error: `ไม่มีแบบรับบำนาญอายุ ${input.annuityAge} ปี` };
  if (age < plan.issueAgeMin || age > plan.issueAgeMax) {
    return { ok: false, error: `อายุ ${age} ปี เลือกรับบำนาญอายุ ${input.annuityAge} ไม่ได้ (แบบนี้รับอายุ ${plan.issueAgeMin}–${plan.issueAgeMax} ปี)` };
  }
  if (!(input.amount > 0)) return { ok: false, error: "กรุณากรอกจำนวนเงิน" };

  const rate = mainRate(plan, sex, age);
  const sumAssured = sumAssuredFor(input, rate);
  if (sumAssured < PENSION_LIMITS.saMin) {
    return { ok: false, error: `ทุนประกันที่ได้ (${sumAssured.toLocaleString("en-US")}) ต่ำกว่าขั้นต่ำ 75,000 บาท${premiumBound(input, "min")}` };
  }
  if (sumAssured > PENSION_LIMITS.saMax) {
    return { ok: false, error: `ทุนประกันที่ได้ (${sumAssured.toLocaleString("en-US")}) สูงกว่าสูงสุด 20,000,000 บาท${premiumBound(input, "max")}` };
  }

  const annualPremium = rdown(rate * rdown(sumAssured / 1000, 3), 2);
  const modePremium = rdown(annualPremium * MODE_FACTOR[input.mode], 2);
  const yearlyPaid = cents(modePremium * MODE_INSTALMENTS[input.mode]);
  const illustration = illustrate(plan, sex, age, sumAssured, yearlyPaid);
  const last = illustration[illustration.length - 1];
  const payYears = payYearsOf(plan, age);
  const riders = input.riders ? ridersFor(input.riders, age, sex, payYears, annualPremium, input.mode) : [];
  const totalModePremium = cents(riders.reduce((s, r) => s + r.modePremium, modePremium));
  return {
    ok: true,
    quote: {
      plan, rate, sumAssured, annualPremium, modePremium, mode: input.mode,
      payYears,
      yearlyPaid,
      totalYearlyPaid: cents(totalModePremium * MODE_INSTALMENTS[input.mode]),
      monthlyPension: Math.round(sumAssured * MONTHLY_FACTOR_FIRST),
      bands: bandsOf(plan.annuityStartAge, sumAssured),
      totalPremium: last.cumPremium,
      totalPension: last.cumPension,
      illustration,
      irr: irrOf(illustration),
      riders,
      totalModePremium,
      totalAnnualPremium: cents(riders.reduce((s, r) => s + r.annual, annualPremium)),
    },
  };
}

export interface TaxInput {
  /** assessable income for the year */
  income: number;
  /** PVD, GPF, teachers' fund, RMF and the like already bought this year */
  retirementFunds: number;
  /** ordinary life premiums already claimed */
  lifePremiums: number;
  /** annuity premiums already bought */
  annuityPremiums: number;
  /** marginal tax rate, 0–0.35 */
  marginalRate: number;
}

/** คำนวณภาษี sheet: the most annuity premium that still reduces tax this year, and what it saves. */
export function pensionTax(t: TaxInput): { maxPremium: number; taxSaved: number } {
  const F14 = t.income;
  const F20 = t.retirementFunds;
  const F21 = t.lifePremiums;
  const F22 = t.annuityPremiums;
  const G21 = Math.min(F21, 100_000);
  const annCap = Math.min(0.15 * F14, 200_000);
  const H21 = annCap > F22 ? F22 : annCap;
  let G22: number;
  if (G21 < 100_000 && H21 < F22 && F22 - H21 <= 100_000 - G21) G22 = F22;
  else if (F22 - H21 > 100_000 - G21) G22 = 100_000 - G21 + H21;
  else G22 = H21;
  const F24 = G21 < 100_000 ? 100_000 - G21 : 0;
  const F25 = G21 < 100_000 ? Math.max(0, G22 - F24) : G22;
  const F27 = F20 >= 500_000
    ? Math.max(F24 - G22, 0)
    : Math.max(0, Math.min(annCap, 500_000 - F20) - F25 - (F22 - F25 - F24));
  return { maxPremium: F27, taxSaved: F27 * t.marginalRate };
}
