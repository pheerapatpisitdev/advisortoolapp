import { hasExpired } from "@/calc/calendar";
import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange, riderAvailability } from "@/calc/rules";
import { fixedPremiumByAgePlan } from "@/calc/lookup";
import { PARENT_MAX_INSURED_AGE, premiumBasedRate } from "@/calc/riders/premium-based";
import { waiverBenefit } from "@/calc/riders/waivers";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import type { CoverTopUp, PayMode, Sex } from "@/calc/types";

/**
 * Everything the Life Protect x 2 page needs to price itself in the browser.
 *
 * /legacy sells one arrangement over a closed domain, so the server prices all of it. This
 * page lets the customer pick any of twenty sums in three terms, and a table of every answer
 * would run to 200 kB. The base plan has no riders, so its premium is one rate per thousand
 * times the sum, rounded the way money.ts rounds — the browser can do that itself from about
 * five hundred rates, and the plan registry (with every other plan's tables) stays on the
 * server.
 */
export interface LifeProtectTerm {
  variant: string;
  /** what the term is called in prose and in the chat message, e.g. "จ่าย 19 ปี" */
  label: string;
  /** the same term as it fits on a third of a phone screen, e.g. "ถึงอายุ 99" */
  short: string;
  /** premium-paying years, when fixed */
  payTerm?: number;
  /** the age premiums are paid to, when the term runs to an age instead */
  payToAge?: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /**
   * cash-value factors per thousand of sum assured, [sex][age - ageMin] → one factor per
   * policy year, from the first. Null where the company table has no schedule for that
   * issue age.
   *
   * The whole schedule rather than only the milestones, because the chart and the
   * year-by-year table need every year and the milestones are a subset of it. Sending both
   * would be one set of numbers travelling two ways, which can drift apart.
   */
  schedule: Record<Sex, (number[] | null)[]>;
}

/**
 * One flavour of a rider — พีบี ฟิต, พีบี บียอนด์ — with the rates the page's pickers can
 * reach and nothing else.
 *
 * A premium-based rider's rate turns on the row it is read off, never on the sum assured or
 * the instalment, so the sum slider and the mode buttons move without needing another rate.
 * That leaves one rate per term, sex and age: about a thousand numbers, against the three
 * hundred thousand in the contract's whole table.
 */
export interface LifeProtectRiderOption {
  /** the code the rate table knows it by, e.g. "FIT" */
  code: string;
  /** the contract's own name, e.g. "สัญญาเพิ่มเติมพีบี ฟิต" */
  name: string;
  /** what this flavour is written against, when the agency has worded it; else absent */
  covers?: string;
  /** rate per 100 baht of yearly base premium, [variant][sex][age - ageMin]; null where unsold */
  rates: Record<string, Record<Sex, (number | null)[]>>;
  /**
   * The same rate when a parent pays for a child, read off the parent's plancode:
   * [payer sex][payer age - child.payerMin][waive period]; null where unsold. Present only
   * on a rider with `child`.
   */
  childRates?: Record<Sex, (number | null)[][]>;
}

/**
 * A rider the page offers beside the base plan.
 *
 * Only the two that waive premiums: they cost a share of the base premium rather than
 * carrying a sum assured of their own, so the page can offer them without asking the
 * customer a single new question about money.
 */
export interface LifeProtectRider {
  code: string;
  /** the family's name, e.g. "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)" */
  name: string;
  /** what the contract does, in one sentence, when the agency has worded it; else absent */
  what?: string;
  /** the ages the page may offer it at with the insured paying — the payer window folded in */
  ageMin: number;
  ageMax: number;
  /**
   * A payer-keyed rider is also sold on a child whose parent pays: up to `ageMax`, and only
   * once the page has the parent's age (`payerMin`–`payerMax`) and sex. Absent otherwise.
   */
  child?: { ageMax: number; payerMin: number; payerMax: number };
  options: LifeProtectRiderOption[];
}

/**
 * The medical-expense rider, sold in fixed plans at a yearly premium set by age alone. It
 * stacks with either premium waiver, so the page offers it as a choice of its own.
 *
 * The premium is the year's, not the contract's: it is renewed yearly and moves with the
 * insured's age, unlike the base plan's level premium.
 */
export interface LifeProtectMedical {
  code: string;
  /** the contract's own name, e.g. "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)" */
  name: string;
  ageMin: number;
  ageMax: number;
  /** every plan the rider is written in, smallest first */
  plans: number[];
  /** yearly premium in baht, [age - table ageMin][plan index]; null where this age may not buy that plan */
  premiums: (number | null)[][];
  /**
   * The yearly premium a contract already in force renews at, [age - ageMin][plan index],
   * through the last age the rate table carries; null where it carries none. No cap by age
   * here: a plan bought at ten stays that plan.
   */
  renewal: (number | null)[][];
}

export interface LifeProtectTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  /** the smallest monthly instalment the company accepts, in baht */
  minMonthly: number;
  /** death before this age pays the extra multiple */
  boosterBeforeAge: number;
  /** the extra multiple of the sum assured (1 = pays double) */
  booster: number;
  /** the age cover runs to */
  coverToAge: number;
  /** how the death benefit is topped up above the sum assured */
  topUp: CoverTopUp;
  modeFactors: Record<PayMode, number>;
  terms: LifeProtectTerm[];
  /**
   * The riders the page offers, in the order it offers them. Empty when the plan has none
   * the page can price without asking a new question.
   */
  riders: LifeProtectRider[];
  /** the medical-expense rider, when the plan carries it */
  medical?: LifeProtectMedical;
}

const PLAN_CODE = "LIFEPROTECT";

/** The three payment terms of ไลฟ์ โพรเทค+ 100, in the order the page offers them. */
const TERMS: { variant: string; label: string; short: string }[] = [
  { variant: "WLF09H", label: "จ่าย 9 ปี", short: "จ่าย 9 ปี" },
  { variant: "WLF19H", label: "จ่าย 19 ปี", short: "จ่าย 19 ปี" },
  { variant: "WLF99H", label: "จ่ายถึงอายุ 99", short: "ถึงอายุ 99" },
];

/**
 * The riders the page offers, in the order it offers them. Both waive premiums and both are
 * priced off the base premium, so neither adds a question the page does not already ask —
 * and the company sells them one or the other, which is why the page offers a choice of one.
 */
const RIDERS = ["PB", "WP"];

/** The medical-expense rider the page offers beside the premium waivers. */
const MEDICAL = "MEB";

/** Built once per process; `expired` is asked again on every call, as in legacy-table.ts. */
let cached: Omit<LifeProtectTable, "expired"> | undefined;

export function lifeProtectTable(today: Date = new Date()): LifeProtectTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = hasExpired(today, plan.rates.expiresOn);
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const packages = TERMS.map((t) => rates.base.packages!.find((p) => p.code === t.variant)!);
  // every term issues at the same ages; the widest would be wrong for the narrowest
  const ageMin = Math.max(...packages.map((p) => baseAgeRange(rules, p.code, rates).min));
  const ageMax = Math.min(...packages.map((p) => baseAgeRange(rules, p.code, rates).max));
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);
  // the company's cash-value table stops the year before cover ends
  const coverToAge = maturityValue(cashValueSchedule(PLAN_CODE, TERMS[2].variant, "M", ageMin, 1000))!.age;

  const scheduleFor = (variant: string, sex: Sex, age: number): number[] | null => {
    // priced on a sum of 1,000 so each row's amount is the factor itself
    const rows = cashValueSchedule(PLAN_CODE, variant, sex, age, 1000);
    return rows.length ? rows.map((r) => r.amount) : null;
  };

  const terms: LifeProtectTerm[] = TERMS.map((t, i) => {
    const pkg = packages[i];
    return {
      variant: t.variant,
      label: t.label,
      short: t.short,
      ...(pkg.payTermToAge !== undefined ? { payToAge: pkg.payTermToAge } : { payTerm: pkg.payTerm }),
      rates: {
        M: ages.map((age) => baseRate(rates, t.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, t.variant, "F", age) ?? null),
      },
      schedule: {
        M: ages.map((age) => scheduleFor(t.variant, "M", age)),
        F: ages.map((age) => scheduleFor(t.variant, "F", age)),
      },
    };
  });

  /**
   * Premium-paying years for a term at an age — the term itself, or the years left to the
   * age it pays to. Read off `rates.base` rather than off the package, because that is the
   * cell quote.ts prices from and the two must not drift.
   */
  const payTermAt = (variant: string, age: number): number => {
    const toAge = rates.base.payTermToAge?.[variant];
    if (toAge !== undefined) return Math.max(0, toAge - age);
    return rates.base.payTerm?.[variant] ?? 0;
  };

  const riders: LifeProtectRider[] = RIDERS.flatMap((code) => {
    const rule = rules.riders[code];
    const rider = rates.riders[code];
    if (!rule || rider?.kind !== "premiumBased") return [];
    /**
     * An adult is taken to pay their own premium — the same reading as everywhere else the
     * app quotes without a payer. For a payer-keyed rider that makes the payer's own age
     * window the adult's, which is why พีบี runs 20 - 70 here; a child is quoted with a
     * parent paying instead (`child` below).
     */
    const byPayer = rider.by === "payer";
    const lo = Math.max(ageMin, rule.ageMin, byPayer ? rule.payer?.ageMin ?? 0 : 0);
    const hi = Math.min(ageMax, rule.ageMax, byPayer ? rule.payer?.ageMax ?? ageMax : ageMax);
    const rateAt = (option: string, variant: string, sex: Sex, age: number): number | null => {
      if (age < lo || age > hi) return null;
      const found = premiumBasedRate(rates, code, {
        option, insuredAge: age, insuredSex: sex, payer: { age, sex }, payTerm: payTermAt(variant, age),
      });
      return found?.rate ?? null;
    };
    /**
     * A child cannot pay their own premium, so a payer-keyed rider on one is quoted with the
     * parent's age and sex, which the page asks for. The rate turns on those and on the
     * waive period alone, so the parent's rows are sent whole, one per period up to the
     * longest a child can reach (a newborn's, to 25).
     */
    const childMax = Math.min(PARENT_MAX_INSURED_AGE, rule.ageMax);
    const child = byPayer && rule.payer && rule.ageMin <= childMax && ageMin <= childMax
      ? { ageMax: childMax, payerMin: rule.payer.ageMin, payerMax: rule.payer.ageMax }
      : undefined;
    const payerAges = child
      ? Array.from({ length: child.payerMax - child.payerMin + 1 }, (_, i) => child.payerMin + i)
      : [];
    const periods = Array.from({ length: 26 }, (_, p) => p);
    const childRatesFor = (plancode: string): Record<Sex, (number | null)[][]> => {
      const at = (sex: Sex) => payerAges.map((payerAge) =>
        periods.map((p) => rider.rates[plancode]?.[sex]?.[String(payerAge)]?.[String(p)] ?? null));
      return { M: at("M"), F: at("F") };
    };
    const words = waiverBenefit(code);
    return [{
      code,
      name: rule.name,
      what: words?.what,
      ageMin: lo,
      ageMax: hi,
      ...(child ? { child } : {}),
      options: Object.entries(rider.options).map(([option, o]) => ({
        code: option,
        name: o.name,
        covers: words?.covers[option],
        rates: Object.fromEntries(TERMS.map((t) => [t.variant, {
          M: ages.map((age) => rateAt(option, t.variant, "M", age)),
          F: ages.map((age) => rateAt(option, t.variant, "F", age)),
        }])),
        ...(child ? { childRates: childRatesFor(o.parent) } : {}),
      })),
    }];
  });

  /**
   * The plans each age may buy are the engine's own (`riderAvailability`), so a cap by age —
   * five hundred only up to ten — is read from the rules rather than copied into the page.
   */
  const medicalRule = rules.riders[MEDICAL];
  const medicalRates = rates.riders[MEDICAL];
  const medical: LifeProtectMedical | undefined = medicalRule && medicalRates?.kind === "fixedByAgePlan"
    ? {
        code: MEDICAL,
        name: medicalRule.name,
        ageMin: Math.max(ageMin, medicalRule.ageMin),
        ageMax: Math.min(ageMax, medicalRule.ageMax),
        plans: medicalRates.plans,
        renewal: Object.keys(medicalRates.premiums).map(Number)
          .filter((age) => age >= Math.max(ageMin, medicalRule.ageMin))
          .sort((a, b) => a - b)
          .map((age) => medicalRates.premiums[String(age)].map((p) => (p ? p : null))),
        premiums: ages.map((age) => {
          const a = riderAvailability(rules, rates, MEDICAL, { age, baseSumAssured: 0 });
          return medicalRates.plans.map((plan) => {
            if (!a.eligible || !a.plans?.includes(plan)) return null;
            const premium = fixedPremiumByAgePlan(rates, MEDICAL, age, plan);
            return premium ? premium : null;
          });
        }),
      }
    : undefined;

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    booster: packages[0].booster ?? 0,
    coverToAge,
    topUp: plan.coverTopUp!,
    modeFactors: rates.modeFactors,
    terms,
    riders,
    ...(medical ? { medical } : {}),
  };
  return { ...cached, expired };
}
