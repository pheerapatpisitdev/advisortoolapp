import { describe, expect, it } from "vitest";
import { budgetFit, type PageBudget } from "@/lib/budget-sum";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectModes, lifeProtectSumFor, termAt } from "@/lib/lifeprotect-quote";
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

/**
 * The Life Protect page lands a budget on a sum to the thousand (owner, 2026-11-04, ข): a man of
 * 34 with a million a year was offered 18,600,000 at 998,820 on the fifty-thousand steps, with
 * 1,180 left over, when 18,621,000 at 999,947.70 fits. The chat keeps its fifty-thousand steps.
 */
describe("the Life Protect page walks the budget up to the thousand", () => {
  const table = lifeProtectTable(new Date("2026-11-04"));
  const priceAt = (variant: string, sex: "M" | "F", age: number) => (sumAssured: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured });

  it("M34 pay 9, 1,000,000 a year: 18,621,000 at 999,947.70, and the next thousand is over", () => {
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 1_000_000, per: "year" }, 1_000);
    expect(fit).toEqual({ sum: 18_621_000, total: 99_994_770, over: false });
    const next = priceAt("WLF09H", "M", 34)(18_622_000)!.find((m) => m.mode === "annual")!;
    expect(next.total).toBeGreaterThan(100_000_000);
  });

  it("M34 pay 9, 10,000 a month: 2,069,000 at 9,999.47", () => {
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 10_000, per: "month" }, 1_000);
    expect(fit).toEqual({ sum: 2_069_000, total: 999_947, over: false });
  });

  it("without the fine step the fifty-thousand answer stands", () => {
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 1_000_000, per: "year" });
    expect(fit).toEqual({ sum: 18_600_000, total: 99_882_000, over: false });
  });

  it("never walks past the list's last sum", () => {
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 9_000_000, per: "year" }, 1_000);
    expect(fit?.sum).toBe(50_000_000);
  });

  it("the fine step may be one baht, and the bisection lands on the same sum a walk would", () => {
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 1_000_000, per: "year" }, 1);
    // every baht under 18,621,000 + 999 fits or not by the same rule: the last one that fits
    const annual = (s: number) => priceAt("WLF09H", "M", 34)(s)!.find((m) => m.mode === "annual")!.total;
    expect(annual(fit!.sum)).toBeLessThanOrEqual(100_000_000);
    expect(annual(fit!.sum + 1)).toBeGreaterThan(100_000_000);
    expect(fit!.over).toBe(false);
  });

  it("the fine steps fit between the coarse ones: every thousand up to the next coarse step is tried", () => {
    // a plan priced at one satang per baht of sum, with a monthly floor of 150 baht
    const price = (sum: number) => [
      { mode: "annual" as const, total: sum, belowMinimum: false },
      { mode: "monthly" as const, total: sum, belowMinimum: sum < 15_000 },
    ];
    const sums = [10_000, 20_000, 30_000];
    // 125 a month buys 12,500 on the thousand... which is under the floor, so the smallest sellable thousand, 15,000, is sold as over
    expect(budgetFit(sums, price, { baht: 125, per: "month" }, 1_000)).toEqual({ sum: 15_000, total: 15_000, over: true });
    // 125 a year buys 12,000, no floor on a year's instalment
    expect(budgetFit(sums, price, { baht: 125, per: "year" }, 1_000)).toEqual({ sum: 12_000, total: 12_000, over: false });
  });
});

/**
 * The Life Protect page lands a budget on the sum to the nearest baht, as the company's own
 * AdvisorZone app does (owner, 2026-11-05, ก): a man of 35 paying 19 years with a million a year
 * is quoted 34,843,206 at 1,000,000.01 there — a satang over the budget, because the sum the
 * money divides to (34,843,205.57) rounds up. Landing under (ข) would have given 34,843,205 at
 * 999,999.98; landing to the thousand gave 34,843,000 at 999,994.10.
 */
describe("the Life Protect page lands the budget on the nearest baht, as AdvisorZone does", () => {
  const table = lifeProtectTable(new Date("2026-11-05"));
  const priceAt = (variant: string, sex: "M" | "F", age: number) => (sumAssured: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured });
  const nearest = (variant: string, sex: "M" | "F", age: number, budget: PageBudget) =>
    budgetFit(
      LIFEPROTECT_BUDGET_SUMS, priceAt(variant, sex, age), budget, 1,
      lifeProtectSumFor(table, termAt(table, variant), { sex, age }, budget.per === "month" ? "monthly" : "annual"),
    );

  it("M35 pay 19, 1,000,000 a year: 34,843,206 at 1,000,000.01, the AdvisorZone figures", () => {
    expect(nearest("WLF19H", "M", 35, { baht: 1_000_000, per: "year" })).toEqual({ sum: 34_843_206, total: 100_000_001, over: false });
  });

  it("M35 pay 19, 5,000 a month: 1,935,734 at 5,000.00 exactly", () => {
    expect(nearest("WLF19H", "M", 35, { baht: 5_000, per: "month" })).toEqual({ sum: 1_935_734, total: 500_000, over: false });
  });

  it("the sum is the budget divided by the rate, rounded to the baht — 5,000 a month divides to 1,935,733.64", () => {
    const divide = lifeProtectSumFor(table, termAt(table, "WLF19H"), { sex: "M", age: 35 }, "monthly")!;
    expect(divide(500_000)).toBeCloseTo(1_935_733.64, 2);
    const yearly = lifeProtectSumFor(table, termAt(table, "WLF19H"), { sex: "M", age: 35 }, "annual")!;
    expect(yearly(100_000_000)).toBeCloseTo(34_843_205.57, 2);
  });

  it("a budget under the plan's smallest sum buys nothing, as before", () => {
    expect(nearest("WLF99H", "M", 35, { baht: 1_000, per: "year" })).toBeUndefined();
  });

  it("the instalment is never more than a step's worth over the budget", () => {
    for (const variant of ["WLF09H", "WLF19H", "WLF99H"]) {
      for (const [sex, age] of [["M", 35], ["F", 25], ["M", 55]] as const) {
        for (const budget of [{ baht: 100_000, per: "year" }, { baht: 5_000, per: "month" }, { baht: 20_000, per: "month" }] as PageBudget[]) {
          const fit = nearest(variant, sex, age, budget)!;
          expect(fit.sum).toBeGreaterThanOrEqual(150_000);
          // the whole premium of one baht of sum, in satang, is well under a baht: the overshoot is at most that
          expect(fit.total - budget.baht * 100).toBeLessThanOrEqual(10);
          expect(fit.over).toBe(false);
        }
      }
    }
  });

  it("never walks past the list's last sum", () => {
    expect(nearest("WLF09H", "M", 34, { baht: 9_000_000, per: "year" })?.sum).toBe(50_000_000);
  });

  it("the chat's own call, with no fine step, is untouched even when told how to divide", () => {
    const divide = lifeProtectSumFor(table, termAt(table, "WLF09H"), { sex: "M", age: 34 }, "annual");
    const fit = budgetFit(LIFEPROTECT_BUDGET_SUMS, priceAt("WLF09H", "M", 34), { baht: 1_000_000, per: "year" }, undefined, divide);
    expect(fit).toEqual({ sum: 18_600_000, total: 99_882_000, over: false });
  });

  it("a small monthly budget is lifted to the smallest sum the company takes, and says so", () => {
    // the plan's smallest sum paid monthly is under the company's floor at some ages; the next baht that reaches it is sold as over
    const fit = nearest("WLF99H", "M", 35, { baht: 300, per: "month" });
    if (fit) {
      const monthly = (s: number) => priceAt("WLF99H", "M", 35)(s)!.find((m) => m.mode === "monthly")!;
      expect(monthly(fit.sum).belowMinimum).toBe(false);
      if (fit.over) expect(monthly(fit.sum - 1).belowMinimum).toBe(true);
    }
  });
});
