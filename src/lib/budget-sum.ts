import type { ModePremium } from "@/calc/mode-premiums";

/** What a visitor says they can pay: an amount, and whether it is a month's or a year's. */
export interface PageBudget {
  baht: number;
  per: "month" | "year";
}

/** What a budget buys on one arrangement. */
export interface BudgetFit {
  /** the sum assured, one the page's slider stops at */
  sum: number;
  /** its instalment, in satang, in the budget's own mode */
  total: number;
  /** the instalment is over the budget, because the smallest monthly instalment the company takes is */
  over: boolean;
}

/**
 * The biggest sum on a plan's list whose instalment fits a budget, or undefined when even the
 * smallest does not.
 *
 * Priced forwards by the page's own pricing function, in the mode the budget was named in, so
 * the figure given back is what that sum costs and never what the visitor said they would pay.
 * The list is the slider's — the plan's smallest sum is its first entry and a hard floor: a
 * budget under it buys nothing rather than being lifted to it. The one thing allowed over the
 * budget is the company's monthly floor: when the best fit is an instalment the company will
 * not take, the next sum up is the smallest that can be sold, and `over` says so.
 *
 * `sums` must be ascending, and an instalment never falls as the sum rises.
 */
export function budgetFit(
  sums: readonly number[], priceAt: (sum: number) => ModePremium[] | undefined, budget: PageBudget,
): BudgetFit | undefined {
  const mode = budget.per === "month" ? "monthly" : "annual";
  const limit = Math.round(budget.baht * 100);
  const at = (sum: number) => priceAt(sum)?.find((m) => m.mode === mode);

  let best = -1;
  for (let i = 0; i < sums.length; i++) {
    const p = at(sums[i]);
    if (!p) continue;
    if (p.total > limit) break;
    best = i;
  }
  if (best < 0) return undefined;

  const fits = at(sums[best])!;
  if (!fits.belowMinimum) return { sum: sums[best], total: fits.total, over: false };
  const up = sums[best + 1] === undefined ? undefined : at(sums[best + 1]);
  return up && !up.belowMinimum ? { sum: sums[best + 1], total: up.total, over: true } : undefined;
}
