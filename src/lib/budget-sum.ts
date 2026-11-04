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
 * With a `fine` step the fit walks on from the list's best sum in steps of it, up to the
 * list's next sum, so the sum lands to the thousand rather than the list's own coarse steps
 * (the Life Protect page; the chat keeps the list's steps). The company's monthly floor is then
 * met by the smallest fine step that reaches it.
 *
 * `sums` must be ascending, and an instalment never falls as the sum rises.
 */
export function budgetFit(
  sums: readonly number[], priceAt: (sum: number) => ModePremium[] | undefined, budget: PageBudget, fine?: number,
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

  let sum = sums[best];
  let fits = at(sum)!;
  // the fine steps between this sum and the list's next; none past the list's last
  const ceiling = sums[best + 1] ?? sum;
  if (fine) {
    for (let s = sum + fine; s < ceiling; s += fine) {
      const p = at(s);
      if (!p || p.total > limit) break;
      sum = s;
      fits = p;
    }
  }
  if (!fits.belowMinimum) return { sum, total: fits.total, over: false };
  if (fine) {
    for (let s = sum + fine; s < ceiling; s += fine) {
      const p = at(s);
      if (p && !p.belowMinimum) return { sum: s, total: p.total, over: true };
    }
  }
  const up = sums[best + 1] === undefined ? undefined : at(sums[best + 1]);
  return up && !up.belowMinimum ? { sum: sums[best + 1], total: up.total, over: true } : undefined;
}
