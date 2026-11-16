import { cashValueSchedule } from "@/calc/cash-value";
import { toHundredths } from "@/calc/money";
import { getPlan } from "@/calc/plans/registry";
import { fixedPlanRiderPremium } from "@/calc/riders/fixed-by-plan";
import type { CoverTopUp, Sex } from "@/calc/types";
import { ihuKey } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";

/**
 * The health page's value table, year by year (owner chose ข, 2026-11-16: the life page's
 * table with the health premium in a column of its own).
 *
 * Worked out on the server and sent as two short lists, rather than shipped to the browser as
 * tables: the surrender factors for one base at one age, and the health premium for each year
 * the contract runs. The slim table the page prices from stops at 80, the last age the rider is
 * issued at, while the cover renews to 98 — so the renewal years can only be read here.
 */
export interface IHealthySchedule {
  /** surrender value per thousand of sum assured, one per policy year from the first */
  factors: number[];
  /**
   * The health premium falling due each policy year, in satang: iHealthy Ultra at the age
   * reached that year, plus the daily cash while it still renews. Today's rates; the company
   * may reprice at renewal. 0 once neither has a rate.
   */
  healthDue: number[];
  /** how the death benefit is topped up for premiums paid, as the life page draws it */
  topUp: CoverTopUp;
}

export interface IHealthyScheduleInput {
  base: string;
  sex: Sex;
  age: number;
  plan: string;
  territory: string;
  coverage: string;
  /** the daily-cash plan on the quote, or null where the agent took it off */
  dailyCash: number | null;
}

const PLAN_CODE = "LIFEPROTECT";
const RIDER = "IHU";
const DAILY_CASH = "MEB";

export function iHealthySchedule(input: IHealthyScheduleInput, today: Date = new Date()): IHealthySchedule | undefined {
  const table = iHealthyTable(today);
  const plan = getPlan(PLAN_CODE)!;
  if (table.expired || !table.bases.some((b) => b.variant === input.base)) return undefined;
  const rider = plan.rates.riders[RIDER];
  if (rider?.kind !== "fixedByKeyAge") return undefined;

  // the same whole-baht amount per thousand the life page's table is drawn from
  const factors = cashValueSchedule(PLAN_CODE, input.base, input.sex, input.age, 1000).map((r) => r.amount);
  if (factors.length === 0) return undefined;

  const healthDue = factors.map((_, i) => {
    const at = input.age + i;
    const key = ihuKey(table, input.plan, at, input.territory, input.coverage);
    const ihu = key === undefined ? undefined : rider.rates[key]?.[input.sex]?.[String(at)];
    const cash = input.dailyCash === null
      ? undefined
      : fixedPlanRiderPremium(plan.rates, DAILY_CASH, { age: at, plan: input.dailyCash, mode: "annual" });
    return (ihu ? toHundredths(ihu) : 0) + (cash?.annual ?? 0);
  });
  return { factors, healthDue, topUp: plan.coverTopUp! };
}
