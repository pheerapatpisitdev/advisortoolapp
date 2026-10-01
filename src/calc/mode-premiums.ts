import type { PayMode, QuoteInput, QuoteResult } from "./types";
import { quote } from "./quote";

export interface ModePremium {
  mode: PayMode;
  /** the premium for one instalment, in satang */
  total: number;
  /** true when this instalment falls under the plan's monthly minimum */
  belowMinimum: boolean;
}

export const MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * One arrangement priced in every payment mode. Each mode is quoted in full rather than
 * scaled from the annual figure, because the workbook rounds each instalment down on its
 * own: twelve monthly instalments do not add up to a year.
 *
 * Undefined when any mode cannot be priced, so a caller never shows a partial row of modes.
 *
 * A total of nought is "cannot be priced" too, not a price (review 2026-10-01). The engine
 * answers an amount or an age it will not issue with a quote of 0 and a warning, and that
 * row once went out as "รายปี 0 บาท · ราย 6 เดือน 0 บาท · รายเดือน 3,000 บาท" — two
 * instalments nobody can buy printed as if they were free. Only the zero is read here: a
 * monthly instalment under the plan's floor is still a real figure, marked `belowMinimum`.
 */
export function modePremiumsFrom(
  quoteFor: (mode: PayMode) => QuoteResult | undefined,
): ModePremium[] | undefined {
  const priced = MODES.map((mode) => {
    const result = quoteFor(mode);
    if (!result || !(result.totalModal > 0)) return undefined;
    return { mode, total: result.totalModal, belowMinimum: result.warnings.some((w) => w.code === "MIN_MONTHLY") };
  });
  return priced.every((p) => p !== undefined) ? (priced as ModePremium[]) : undefined;
}

/**
 * The three prices for a quote assembled by hand. The input's own `mode` is ignored — except
 * on a premium-basis quote, where it is the mode the target premium was given in.
 *
 * A premium-basis quote is "I want to pay 20,000 a month": the sum assured is what that buys,
 * and it is worked out once, from the mode the premium was named in. Each mode used to derive
 * its own sum from the same 20,000, so every row of the panel read 20,000 — yearly, half-yearly
 * and monthly alike — for three different contracts (review 2026-10-01: iShield WLCI10, man of
 * 35, 20,000 a month is a sum assured of 3,317,740, and that contract costs 222,222.22 a year,
 * not 20,000). The other modes are now that one contract priced by its sum assured, which is
 * what an agent switching the instalment on the same customer means.
 */
export function quoteModePremiums(input: QuoteInput, today: Date = new Date()): ModePremium[] | undefined {
  const fixed: QuoteInput = input.basis === "premium"
    ? { ...input, basis: "sumAssured", sumAssured: quote(input, today).sumAssured, targetPremium: undefined }
    : input;
  return modePremiumsFrom((mode) => quote({ ...fixed, mode }, today));
}
