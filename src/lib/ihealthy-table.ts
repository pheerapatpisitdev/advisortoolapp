import { hasExpired } from "@/calc/calendar";
import { dailyCashLabel } from "@/lib/ihealthy-quote";
import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { riderAvailability } from "@/calc/rules";
import { fixedPlanRiderPremium } from "@/calc/riders/fixed-by-plan";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import type { PayMode, Sex } from "@/calc/types";
import benefits from "../../data/riders/ihealthy-ultra.json";

/**
 * Everything the health page needs to price itself in the browser.
 *
 * The registry holds five plans and about 2.7 MB of rate tables, and the two payor riders
 * alone are 416 kB of it. A customer reading this page picks a base plan and a health plan
 * and nothing else, so only those rates travel: three columns of base rate and the 28 keyed
 * tables of the rider. The engine, and every other rider, stays on the server behind the
 * action in `src/app/ihealthy-ultra/actions.ts`.
 */
export interface IHealthyBase {
  variant: string;
  /** what the button says, e.g. "x 2" */
  short: string;
  /** what prose calls it, e.g. "ไลฟ์ โพรเทค+ x 2" */
  label: string;
  /**
   * the note under the button, e.g. "ตั้งทุนเอง". Absent where `fixedSum` pins the sum: the
   * page says that figure from the field itself, so the subtitle cannot drift from it.
   */
  note?: string;
  /**
   * The base whose button this one sits under. ไลฟ์ โพรเทค+ x 2 is one button whatever term
   * it is paid over, so the three terms share it and the form asks for the term on a row of
   * its own; a base sold over one term only is its own group.
   */
  group: string;
  /** years of premium for a limited-pay base, e.g. 9; absent where it is paid to an age */
  payYears?: number;
  /** the age premiums are paid to where they are not paid for a fixed number of years */
  payToAge?: number;
  /** the extra multiple paid on death before the booster age (1 = pays double) */
  booster: number;
  /** the package pins the sum assured here and the form must not let it change */
  fixedSum?: number;
  saMin: number;
  /** rate per thousand, [sex][age - ageMin]; null where this base is not issued at that age */
  rates: Record<Sex, (number | null)[]>;
}

export interface IHealthyPlanOption {
  code: string;
  name: string;
  planNo: number;
  annualMax: number;
  deductible: number;
}

/**
 * The daily-cash rider the agency attaches to every one of these quotes as standard, worked
 * out per age on the server so the browser needs neither its rate table nor its rules.
 *
 * The company caps the plan by age — five hundred a day up to ten, a thousand up to fifteen —
 * and stops writing the rider at sixty-five, so the plan the agency asks for is not always
 * the plan the age may have, and above sixty-five there is none at all.
 */
export interface IHealthyStandardRider {
  code: string;
  name: string;
  /** what it is called to a customer at each age, e.g. "ค่าชดเชยรายวัน 1,000 บาท" */
  label: (string | null)[];
  /** the plan attached at each age, null where the age cannot have it */
  plan: (number | null)[];
  /** its annual premium in satang at that plan, null where there is none */
  annual: (number | null)[];
}

export interface IHealthyTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** the age the key builder switches from the juvenile table to the standard one at */
  juvenileBelowAge: number;
  expired: boolean;
  expiresOn: string;
  rateVersion: string;
  minMonthly: number;
  boosterBeforeAge: number;
  modeFactors: Record<PayMode, number>;
  bases: IHealthyBase[];
  plans: IHealthyPlanOption[];
  /** Thai label → the letter the rate key uses; ประเทศไทย is the empty one */
  territories: Record<string, string>;
  /** Thai label → the letter the rate key uses; Full Coverage is the empty one */
  coverages: Record<string, string>;
  /**
   * rider annual premium, [key][sex][age - ageMin].
   *
   * Two different absences: a key the company does not sell at all is undefined — only 28 of
   * the 108 keys the letters can spell exist, so a miss is the ordinary case and the caller
   * must expect it — while null inside a key's array is an age that key is not sold at.
   */
  riderRates: Record<string, Record<Sex, (number | null)[]> | undefined>;
  /** the daily-cash rider every quote here carries unless the agent takes it off */
  standard: IHealthyStandardRider;
}

const PLAN_CODE = "LIFEPROTECT";
const RIDER = "IHU";
/** The daily cash the agency sells with this health cover, where the age may have it. */
const STANDARD_RIDER = "MEB";
const STANDARD_PLAN = 1_000;


/**
 * The first base is what a link naming an unknown one falls back to, so x 2 paid to 99 stays
 * first. The 9- and 19-year terms (owner, 2026-11-16) come after the package so the buttons,
 * drawn in order of first appearance, still read x 2 then the package.
 */
const BASES: { variant: string; group: string; short: string; label: string; note?: string }[] = [
  { variant: "WLF99H", group: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2", note: "ตั้งทุนเอง" },
  { variant: "WLF99HX", group: "WLF99HX", short: "แพ็กเกจสุขภาพ", label: "Health Ultra Package" },
  { variant: "WLF09H", group: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2 จ่าย 9 ปี", note: "ตั้งทุนเอง" },
  { variant: "WLF19H", group: "WLF99H", short: "x 2", label: "ไลฟ์ โพรเทค+ x 2 จ่าย 19 ปี", note: "ตั้งทุนเอง" },
];

/** Built once per process; `expired` is asked again on every call, as in lifeprotect-table.ts. */
let cached: Omit<IHealthyTable, "expired"> | undefined;

export function iHealthyTable(today: Date = new Date()): IHealthyTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = hasExpired(today, plan.rates.expiresOn);
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const rider = rates.riders[RIDER];
  if (rider.kind !== "fixedByKeyAge") throw new Error("IHU is not a keyed rider any more");
  // the three tables every rate key is spelled from; a keyed rider may ship without them
  const { planNo, territory, coverage } = rider;
  if (!planNo || !territory || !coverage) {
    throw new Error("the IHU rate table no longer says how its keys are composed");
  }

  // the base plan issues from birth, but nothing on this page sells without the rider
  const { ageMin, ageMax } = rules.riders[RIDER];
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);

  const bases: IHealthyBase[] = BASES.map((b) => {
    const pkg = rates.base.packages?.find((p) => p.code === b.variant);
    if (!pkg) throw new Error(`the rate table no longer sells ${b.variant}`);
    const range = baseAgeRange(rules, b.variant, rates);
    const sum = baseSumAssuredLimits(rules, b.variant);
    // the workbook prices WLF99HX from age 0, which its package does not sell
    const rateAt = (sex: Sex, age: number) =>
      age >= range.min && age <= range.max ? baseRate(rates, b.variant, sex, age) ?? null : null;
    const payToAge = rates.base.payTermToAge?.[b.variant];
    const payYears = payToAge === undefined ? rates.base.payTerm?.[b.variant] : undefined;
    return {
      ...b,
      ...(payYears !== undefined ? { payYears } : {}),
      ...(payToAge !== undefined ? { payToAge } : {}),
      booster: pkg.booster ?? 0,
      ...(sum.exact ? { fixedSum: sum.min } : {}),
      saMin: sum.min,
      rates: { M: ages.map((age) => rateAt("M", age)), F: ages.map((age) => rateAt("F", age)) },
    };
  });

  const riderRates: IHealthyTable["riderRates"] = {};
  for (const [key, bySex] of Object.entries(rider.rates)) {
    riderRates[key] = {
      M: ages.map((age) => bySex.M?.[String(age)] ?? null),
      F: ages.map((age) => bySex.F?.[String(age)] ?? null),
    };
  }

  // The largest plan the agency would attach that this age is allowed. The rider's own
  // planMaxByAge bands are the engine's to apply, so they are asked for rather than
  // restated, and a nought in the premium table means the same "not offered" here as
  // everywhere else.
  const standard: IHealthyStandardRider = {
    code: STANDARD_RIDER,
    name: rules.riders[STANDARD_RIDER].name,
    label: [],
    plan: [],
    annual: [],
  };
  for (const age of ages) {
    const offer = riderAvailability(rules, rates, STANDARD_RIDER, { age, baseSumAssured: 0 });
    const within = offer.eligible ? (offer.plans ?? []).filter((p) => p <= STANDARD_PLAN) : [];
    const plan = within.length > 0 ? Math.max(...within) : null;
    const priced = plan === null
      ? undefined
      : fixedPlanRiderPremium(rates, STANDARD_RIDER, { age, plan, mode: "annual" });
    standard.plan.push(priced ? plan : null);
    standard.annual.push(priced?.annual ?? null);
    standard.label.push(priced ? dailyCashLabel(plan!) : null);
  }

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    juvenileBelowAge: JUVENILE_BELOW_AGE,
    expiresOn: rates.expiresOn,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    modeFactors: rates.modeFactors,
    bases,
    // the number comes from the rate table that keys on it, so the two files join on one map
    plans: benefits.plans.map((p) => {
      const no = planNo[p.code];
      if (no === undefined) throw new Error(`the IHU rate table does not number ${p.code}`);
      return { code: p.code, name: p.name, planNo: no, annualMax: p.annualMax, deductible: p.deductible };
    }),
    territories: territory,
    coverages: coverage,
    riderRates,
    standard,
  };
  return { ...cached, expired };
}
