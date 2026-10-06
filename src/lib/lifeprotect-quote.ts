import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, applyModeFactorToFixed, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import { premiumBasedAmounts, waivePeriod } from "@/calc/riders/premium-based";
import type {
  LifeProtectMedical, LifeProtectRider, LifeProtectRiderOption, LifeProtectTable, LifeProtectTerm,
} from "@/lib/lifeprotect-table";

/** The ages the page quotes a surrender value at, besides the end of the contract. */
export const CASH_AGES = [60, 70, 80];

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

/** Whoever pays the premium, when it is not the insured. */
export interface Payer {
  sex: Sex;
  age: number;
}

export function termAt(table: LifeProtectTable, variant: string): LifeProtectTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * rate per thousand, no discount (this plan's discount table is all zeros), each instalment
 * rounded down on its own in satang. The test suite prices random arrangements both ways.
 *
 * Undefined when the workbook has no rate for the age, which the picker already prevents.
 */
export function lifeProtectModes(
  table: LifeProtectTable, term: LifeProtectTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => {
    const total = applyModeFactor(rate100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** A rider and the flavour of it, as the page's buttons name them. */
export interface RiderPick {
  code: string;
  option: string;
}

export interface PickedRider {
  rider: LifeProtectRider;
  option: LifeProtectRiderOption;
}

/** The contract a pick names, when the table still carries it. */
export function pickedRider(table: LifeProtectTable, pick: RiderPick | undefined): PickedRider | undefined {
  if (!pick) return undefined;
  const rider = table.riders.find((r) => r.code === pick.code);
  const option = rider?.options.find((o) => o.code === pick.option);
  return rider && option ? { rider, option } : undefined;
}

/**
 * True when this rider, at this insured's age, is a child's with a parent paying — and so
 * cannot be quoted until the page has the parent's age and sex.
 */
export function needsParent(rider: LifeProtectRider, age: number): boolean {
  return rider.child !== undefined && age <= rider.child.ageMax;
}

/** Whether the rider is sold at this insured's age at all, either way of paying for it. */
export function riderSoldAt(rider: LifeProtectRider, age: number): boolean {
  return needsParent(rider, age) || (age >= rider.ageMin && age <= rider.ageMax);
}

/** The years of premium the rider would waive, read the way the engine reads them. */
export function riderWaiveYears(rider: LifeProtectRider, term: LifeProtectTerm, age: number): number {
  return waivePeriod(rider.child !== undefined, age, payYears(term, age));
}

/**
 * The rider's own premium in every payment mode, worked out the way premium-based.ts does
 * from the base plan's yearly premium in satang.
 *
 * Undefined when the table holds no rate for this insured on this term — a missing rate is
 * the page's only permission to quote the contract, so it refuses rather than guesses. A
 * child's rider is read off the parent's row, and is undefined without a `payer` in range.
 *
 * `belowMinimum` is false on every instalment here: the company's monthly floor is a floor
 * on what the customer pays altogether, never on one contract's share of it.
 */
export function riderModes(
  table: LifeProtectTable, term: LifeProtectTerm, who: Insured, picked: PickedRider, baseAnnual: number,
  payer?: Payer,
): ModePremium[] | undefined {
  const child = picked.rider.child;
  const rate = child && needsParent(picked.rider, who.age)
    ? payer && picked.option.childRates?.[payer.sex]?.[payer.age - child.payerMin]
      ?.[riderWaiveYears(picked.rider, term, who.age)]
    : picked.option.rates[term.variant]?.[who.sex]?.[who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  return MODES.map((mode) => ({
    mode,
    total: premiumBasedAmounts(rate, baseAnnual, toHundredths(table.modeFactors[mode])).modal,
    belowMinimum: false,
  }));
}

/** The medical plans this age may buy, smallest first; empty outside the rider's ages. */
export function medicalPlansAt(table: LifeProtectTable, medical: LifeProtectMedical, age: number): number[] {
  const row = medical.premiums[age - table.ageMin] ?? [];
  return medical.plans.filter((_, i) => typeof row[i] === "number");
}

/**
 * The medical rider's premium this year in every payment mode, worked out the way
 * fixed-by-plan.ts does: the year's premium, then the mode factor on it.
 *
 * Undefined when this age may not buy this plan.
 */
export function medicalModes(
  table: LifeProtectTable, medical: LifeProtectMedical, age: number, plan: number,
): ModePremium[] | undefined {
  const premium = medical.premiums[age - table.ageMin]?.[medical.plans.indexOf(plan)];
  if (premium === null || premium === undefined) return undefined;
  const annual = toHundredths(premium);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactorToFixed(annual, toHundredths(table.modeFactors[mode])),
    belowMinimum: false,
  }));
}

/**
 * What the riders add to each policy year's yearly premium, in satang, from the first year
 * for `years` years — for the value table, which walks the contract a year at a time.
 *
 * A waiver costs the same each year it runs and runs as long as it waives (a child's พีบี
 * stops at 25). The medical rider renews yearly at the premium for the insured's age that
 * year, at today's rates, until the rate table runs out.
 */
export function riderDueByYear(
  table: LifeProtectTable, term: LifeProtectTerm, age: number, years: number,
  waiver?: { rider: LifeProtectRider; annual: number },
  medical?: { plan: number },
): number[] {
  const waiveYears = waiver ? riderWaiveYears(waiver.rider, term, age) : 0;
  const meb = table.medical;
  const planAt = meb && medical ? meb.plans.indexOf(medical.plan) : -1;
  return Array.from({ length: years }, (_, i) => {
    const waived = waiver && i < waiveYears ? waiver.annual : 0;
    const renewal = meb && planAt >= 0 ? meb.renewal[age + i - meb.ageMin]?.[planAt] : undefined;
    return waived + (renewal ? toHundredths(renewal) : 0);
  });
}

/** Instalments added up mode by mode; what is missing adds nothing. */
export function addModes(...parts: (ModePremium[] | undefined)[]): ModePremium[] | undefined {
  const present = parts.filter((p): p is ModePremium[] => p !== undefined);
  if (present.length === 0) return undefined;
  return MODES.map((mode) => ({
    mode,
    total: present.reduce((sum, p) => sum + (p.find((m) => m.mode === mode)?.total ?? 0), 0),
    belowMinimum: false,
  }));
}

/**
 * What the customer pays each instalment: the base plan and its rider added up.
 *
 * The monthly floor is judged here rather than on the base alone, because the total is what
 * the company judges it against (quote.ts hands checkMonthlyMinimum the total). A base
 * premium just under the floor can therefore become payable monthly once a rider is added,
 * which is what the company does too.
 */
export function totalModes(
  table: LifeProtectTable, base: ModePremium[], rider: ModePremium[] | undefined,
): ModePremium[] {
  return base.map((m) => {
    const total = m.total + (rider?.find((r) => r.mode === m.mode)?.total ?? 0);
    return { mode: m.mode, total, belowMinimum: m.mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid: the term itself, or the years left to the paying age. */
export function payYears(term: LifeProtectTerm, age: number): number {
  if (term.payToAge !== undefined) return Math.max(0, term.payToAge - age);
  return term.payTerm ?? 0;
}

/** Every yearly premium added up, in satang. Honest only because this plan's premium is level. */
export function totalPaid(annualSatang: number, years: number): number {
  return annualSatang * years;
}

/** What quote.ts returns for this plan with no riders: double before the booster age, the sum after. */
export function deathBenefitOf(table: LifeProtectTable, age: number, sumAssured: number): DeathBenefit {
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * table.booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}

export interface CashRow {
  age: number;
  /** baht */
  amount: number;
}

/**
 * The cash value at each milestone still ahead of the insured, worth something. The same
 * ROUND(factor × sum / 1000) as cash-value.ts, so the figure equals the company's table.
 *
 * The schedule's last value is the money held when cover ends, which the company labels
 * with the age after the final policy year rather than the age that year opened at.
 */
export function cashAt(term: LifeProtectTerm, sex: Sex, age: number, sumAssured: number, ageMin: number): CashRow[] {
  const factors = term.schedule[sex][age - ageMin];
  if (!factors) return [];
  const baht = (factor: number) => Math.round((factor * sumAssured) / 1000);
  const rows = CASH_AGES
    .filter((at) => at > age && at - age < factors.length)
    .map((at) => ({ age: at, amount: baht(factors[at - age]) }));
  rows.push({ age: age + factors.length, amount: baht(factors[factors.length - 1]) });
  return rows.filter((r) => r.amount > 0);
}
