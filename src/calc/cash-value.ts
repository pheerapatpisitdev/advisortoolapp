import lifeprotectCashValues from "../../data/cash-values/lifeprotect.json";
import ishieldCashValues from "../../data/cash-values/ishield.json";
import lifetreasureCashValues from "../../data/cash-values/lifetreasure.json";
import ismartCashValues from "../../data/cash-values/ismart.json";
import easyprotectCashValues from "../../data/cash-values/easyprotect.json";
import twelvePlCashValues from "../../data/cash-values/12pl.json";

export interface CashValueRow {
  /** the insured's age at the start of that policy year, as the company table labels it */
  age: number;
  policyYear: number;
  /** baht at the end of that policy year */
  amount: number;
}

interface CashValueTable {
  planCode: string;
  lastCoveredAge: number;
  factors: Record<string, Record<string, Record<string, number[]>>>;
}

/** The plans whose surrender tables have been extracted, by the plan code the engine uses. */
const TABLES: Record<string, CashValueTable> = Object.fromEntries(
  [lifeprotectCashValues, ishieldCashValues, lifetreasureCashValues, ismartCashValues, easyprotectCashValues, twelvePlCashValues]
    .map((t) => [t.planCode, t as unknown as CashValueTable]),
);

export function hasCashValues(planCode: string): boolean {
  return planCode in TABLES;
}

/**
 * A package that layers health cover on a base plan surrenders like that base plan, so
 * "WLF99HX#7" reads the WLF99HX table.
 */
function cvVariant(variant: string): string {
  return variant.split("#")[0];
}

/**
 * The whole surrender schedule, one row per policy year. Excel computes each amount as
 * ROUND(factor * sumAssured / 1000, 0) — half away from zero, which is what Math.round does
 * for the positive numbers here.
 */
export function cashValueSchedule(planCode: string, variant: string, sex: "M" | "F", age: number, sumAssured: number): CashValueRow[] {
  const table = TABLES[planCode];
  if (!table) return [];
  const factors = table.factors[cvVariant(variant)]?.[sex]?.[String(age)];
  if (!factors) return [];
  return factors.map((factor, i) => ({
    age: age + i,
    policyYear: i + 1,
    amount: Math.round((factor * sumAssured) / 1000),
  }));
}

/**
 * What the policy pays for staying to the end. The company's table stops at the age before
 * the cover ends because each row's amount is the value at the END of that policy year, so
 * the last row is what the customer holds at age 99.
 */
export function maturityValue(rows: CashValueRow[]): CashValueRow | null {
  const last = rows[rows.length - 1];
  return last ? { ...last, age: last.age + 1 } : null;
}

/**
 * A phone screen fits a dozen rows, so the schedule is thinned to round ages — every five
 * years while that fits, every ten when it does not. Years worth nothing are left out
 * because a column of zeros tells the customer nothing.
 */
export function cashValueHighlights(rows: CashValueRow[], max = 12): CashValueRow[] {
  const worthSomething = rows.slice(0, -1).filter((r) => r.amount > 0);
  if (!worthSomething.length) return [];
  for (const step of [5, 10, 20]) {
    const picked = worthSomething.filter((r) => r.age % step === 0);
    if (picked.length <= max) return picked.length ? picked : worthSomething.slice(0, max);
  }
  return worthSomething.slice(0, max);
}
