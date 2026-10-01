import type { PayMode, PlanRates } from "../types";
import { riderRateByAgeClass } from "../lookup";
import { applyModeFactor, premiumPerThousand, toHundredths } from "../money";

export interface RatePerThousandInput {
  age: number;
  sumAssured: number;
  mode: PayMode;
}
export interface RatePerThousandResult {
  rate: number;
  annual: number; // satang
  modal: number; // satang
}

/**
 * The occupation class AP and ECARE are priced at. The rate tables carry four classes and
 * this app asks for none, so every quote is class 1 — the office worker's rate. A class-4
 * occupation pays twice that (AP at 1,000,000: 3,000 a year at class 1, 6,000 at class 4).
 *
 * Owner's call, review 2026-10-01: no occupation input, but never a silent class 1 either —
 * every place these riders are priced says which class the figure is for (`OCCUPATION_NOTE`,
 * the quote's `OCCUPATION_CLASS` warning, the rider row's note).
 */
export const OCCUPATION_CLASS = 1 as const;

/** What a quote that prices AP or ECARE says about the class it assumed. */
export const OCCUPATION_NOTE = `คิดที่อาชีพชั้น ${OCCUPATION_CLASS}`;

/** The rider kinds whose rate depends on the occupation class. */
export const BY_OCCUPATION_CLASS = new Set(["ratePerThousandByAgeClass", "flatRateByClass"]);

/** Excel Cal!G17/H17 (AP) and G18/H18 (ECARE). */
export function ratePerThousandRiderPremium(
  rates: PlanRates,
  code: string,
  input: RatePerThousandInput,
): RatePerThousandResult | undefined {
  const rate = riderRateByAgeClass(rates, code, input.age, OCCUPATION_CLASS);
  if (rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  const factor100 = toHundredths(rates.modeFactors[input.mode]);
  return {
    rate,
    annual: premiumPerThousand(rate100, input.sumAssured),
    modal: applyModeFactor(rate100, input.sumAssured, factor100),
  };
}
