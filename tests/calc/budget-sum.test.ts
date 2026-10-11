import { describe, expect, it } from "vitest";
import { budgetFit, type PageBudget } from "@/lib/budget-sum";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { iShieldTable } from "@/lib/ishield-table";
import { iShieldModes, termAt as iShieldTermAt } from "@/lib/ishield-quote";
import { ISHIELD_SUMS, LIFEPROTECT_BUDGET_SUMS } from "@/lib/quote-pdf/pages";

const WHILE_CURRENT = new Date("2026-09-05");

/** What the page does: the biggest sum on the list whose instalment fits, priced forwards. */
describe("what a budget buys on the Life Protect page", () => {
  const table = lifeProtectTable(WHILE_CURRENT);
  const priceAt = (variant: string, sex: "M" | "F", age: number) => (sumAssured: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured });
  const mode = (b: PageBudget) => (b.per === "month" ? "monthly" : "annual");

  for (const variant of ["WLF09H", "WLF19H", "WLF99H"]) {
    for (const [sex, age] of [["M", 35], ["F", 25], ["M", 55]] as const) {
      for (const budget of [{ baht: 100_000, per: "year" }, { baht: 5_000, per: "month" }, { baht: 20_000, per: "month" }] as PageBudget[]) {
        it(`${variant} ${sex}${age} ${budget.baht}/${budget.per}: fits, and the next sum up does not`, () => {
          const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt(variant, sex, age), budget);
          expect(fit).toBeDefined();
          expect(LIFEPROTECT_BUDGET_SUMS).toContain(fit!.sum);
          expect(fit!.over).toBe(false);
          expect(fit!.total).toBeLessThanOrEqual(budget.baht * 100);
          const next = LIFEPROTECT_BUDGET_SUMS[LIFEPROTECT_BUDGET_SUMS.indexOf(fit!.sum) + 1];
          const p = priceAt(variant, sex, age)(next)!.find((m) => m.mode === mode(budget))!;
          expect(p.total).toBeGreaterThan(budget.baht * 100);
        });
      }
    }
  }

  it("never lifts a budget to the smallest sum: a budget that does not reach it buys nothing", () => {
    expect(budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF99H", "M", 35), { baht: 1_000, per: "year" })).toBeUndefined();
  });

  it("starts at the plan's own smallest sum, 150,000, in fifty-thousand steps", () => {
    expect(LIFEPROTECT_BUDGET_SUMS[0]).toBe(150_000);
    expect(LIFEPROTECT_BUDGET_SUMS[1] - LIFEPROTECT_BUDGET_SUMS[0]).toBe(50_000);
  });
});

/**
 * The page buys what the chat buys with the same money (review, 2026-10-11): the chat's own
 * answers for these budgets, which the page used to miss on its 150,000 slider steps.
 */
describe("the Life Protect page and the chat agree on a budget", () => {
  const table = lifeProtectTable(new Date("2026-10-11"));
  const fitOn = (variant: string, sex: "M" | "F", age: number, budget: PageBudget) =>
    budgetFit(LIFEPROTECT_BUDGET_SUMS, (sumAssured) => lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured }), budget);

  for (const [variant, sex, age, budget, sum, total] of [
    ["WLF09H", "M", 35, { baht: 2_000, per: "month" }, 400_000, 196_560],
    ["WLF19H", "M", 35, { baht: 2_000, per: "month" }, 750_000, 193_725],
    ["WLF99H", "M", 35, { baht: 2_000, per: "month" }, 1_250_000, 193_500],
    ["WLF09H", "M", 45, { baht: 3_000, per: "month" }, 450_000, undefined],
    ["WLF99H", "F", 30, { baht: 50_000, per: "year" }, 4_050_000, undefined],
  ] as const) {
    it(`${variant} ${sex}${age} ${budget.baht}/${budget.per} buys ${sum.toLocaleString("en-US")}`, () => {
      const fit = fitOn(variant, sex, age, budget);
      expect(fit?.sum).toBe(sum);
      if (total !== undefined) expect(fit?.total).toBe(total);
    });
  }
});

describe("what a budget buys on the iShield page", () => {
  const table = iShieldTable(WHILE_CURRENT);
  const sums = ISHIELD_SUMS.filter((s) => s >= table.saMin && s <= table.saMax);
  const priceAt = (variant: string, sex: "M" | "F", age: number) => (sumAssured: number) =>
    iShieldModes(table, iShieldTermAt(table, variant), { sex, age, sumAssured });

  it("fits, and the next sum up does not", () => {
    for (const budget of [{ baht: 3_000, per: "month" }, { baht: 60_000, per: "year" }] as PageBudget[]) {
      const fit = budgetFit(sums, priceAt("WLCI10", "M", 35), budget);
      expect(fit).toBeDefined();
      expect(fit!.over).toBe(false);
      expect(fit!.total).toBeLessThanOrEqual(budget.baht * 100);
      const next = sums[sums.indexOf(fit!.sum) + 1];
      const p = priceAt("WLCI10", "M", 35)(next)!.find((m) => m.mode === (budget.per === "month" ? "monthly" : "annual"))!;
      expect(p.total).toBeGreaterThan(budget.baht * 100);
    }
  });

  it("says over, and only over, when the company's monthly floor lifts the instalment", () => {
    const fit = budgetFit(sums, priceAt("WLCI10", "M", 35), { baht: 1_000, per: "month" });
    expect(fit).toBeDefined();
    expect(fit!.over).toBe(true);
    expect(fit!.total).toBeGreaterThanOrEqual(table.minMonthly * 100);
  });

  it("never lifts a budget to the smallest sum", () => {
    expect(budgetFit(sums, priceAt("WLCI10", "M", 35), { baht: 500, per: "month" })).toBeUndefined();
  });
});
