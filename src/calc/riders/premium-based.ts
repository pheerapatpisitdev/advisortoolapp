import type { PayMode, Payer, PlanRates, Sex } from "../types";
import { applyModeFactorToFixed, floorDiv, toHundredths } from "../money";

export interface PremiumBasedInput {
  /** option code from rates.riders[code].options, e.g. "FIT" */
  option: string;
  insuredAge: number;
  insuredSex: Sex;
  /** required when the rider is keyed on the payer */
  payer?: Payer;
  /** base plan premium-paying term in years */
  payTerm: number;
  /** base plan annual premium in satang (Excel Cal!I13) */
  baseAnnual: number;
  mode: PayMode;
}
export interface PremiumBasedResult {
  plancode: string;
  period: number;
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

/** Which row of the rider's table an arrangement is read off, and the rate written there. */
export type PremiumBasedRate = Pick<PremiumBasedResult, "plancode" | "period" | "rate">;

/** Everything the lookup needs; the money is applied to it afterwards. */
export type PremiumBasedLookup = Omit<PremiumBasedInput, "baseAnnual" | "mode">;

/** The oldest insured a parent's plancode is written for; from 16 the spouse's takes over. */
export const PARENT_MAX_INSURED_AGE = 15;

/**
 * How many years of premium the rider waives: the base plan's paying term, except that a
 * payer-keyed rider on a child stops when the child turns 25.
 */
export function waivePeriod(byPayer: boolean, insuredAge: number, payTerm: number): number {
  return byPayer && insuredAge <= PARENT_MAX_INSURED_AGE ? Math.min(payTerm, 25 - insuredAge) : payTerm;
}

/**
 * Excel Cal!F10/F11, D14/D15, G14/G15, H14/H15 — the row, then the money on it. The two
 * halves are exported separately below and this is the whole of it.
 */
export function premiumBasedRiderPremium(rates: PlanRates, code: string, input: PremiumBasedInput): PremiumBasedResult | undefined {
  const found = premiumBasedRate(rates, code, input);
  if (!found) return undefined;
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return { ...found, ...premiumBasedAmounts(found.rate, input.baseAnnual, factor100) };
}

/**
 * The first half on its own: the row and its rate, with no money in it.
 *   plancode = insured ≤15 ? parent : spouse
 *   period   = payer-keyed and insured ≤15 ? MIN(payTerm, 25 − insuredAge) : payTerm
 *
 * Split out because a rate depends on nothing the customer drags — not the sum assured, not
 * the instalment — so a page that prices itself in the browser can be handed the handful of
 * rates its pickers can reach instead of the rider's whole table.
 */
export function premiumBasedRate(rates: PlanRates, code: string, input: PremiumBasedLookup): PremiumBasedRate | undefined {
  const rider = rates.riders[code];
  if (!rider || (rider.kind !== "premiumBased" && rider.kind !== "payorBenefit")) return undefined;
  const opt = rider.options[input.option];
  if (!opt) return undefined;
  const byPayer = rider.kind === "payorBenefit" || rider.by === "payer";
  const isParent = input.insuredAge <= PARENT_MAX_INSURED_AGE;
  const plancode = isParent ? opt.parent : opt.spouse;
  const period = waivePeriod(byPayer, input.insuredAge, input.payTerm);
  const who = byPayer ? input.payer : { age: input.insuredAge, sex: input.insuredSex };
  if (!who) return undefined;
  const rate = rider.rates[plancode]?.[who.sex]?.[String(who.age)]?.[String(period)];
  if (rate === undefined) return undefined;
  return { plancode, period, rate };
}

/**
 * The second half: Excel G14/H14, from a rate and the base plan's yearly premium.
 *   annual = TRUNC(rate × TRUNC(baseAnnual/100, 3), 2)
 *   modal  = TRUNC(annual × factor, 2)          (from the rounded annual)
 */
export function premiumBasedAmounts(
  rate: number, baseAnnual: number, factor100: number,
): { annual: number; modal: number } {
  // TRUNC(baseAnnual/100, 3) expressed in thousandths of a baht = floor(satang / 10)
  const annual = floorDiv(toHundredths(rate) * floorDiv(baseAnnual, 10), 1000);
  return { annual, modal: applyModeFactorToFixed(annual, factor100) };
}
