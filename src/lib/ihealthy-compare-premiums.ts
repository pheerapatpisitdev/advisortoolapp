import type { PayMode, Sex } from "@/calc/types";
import premiums from "../../data/riders/ihealthy-compare-premiums.json";

/**
 * The compare page's own premiums: the owner's first iHealthy Ultra app's table, as it stood.
 *
 * They are not the rate tables' figures, and that is the owner's decision (2026-11-06, told that
 * 576 of the 580 differ from /ihealthy-ultra). So nothing here reaches the engine, and nothing
 * else in the system reads this table. It is whole baht a year, one number to an age, and the
 * other instalments are worked out from it the way that app did.
 */
const YEARLY = premiums.yearly as Record<Sex, Record<string, Record<string, number>>>;
const FACTOR: Record<PayMode, number> = { annual: 1, semi: 0.52, monthly: 0.09 };

/** Whole baht for this instalment, or undefined where the table has no figure. */
export function comparePremium(plan: string, sex: Sex, age: number, mode: PayMode): number | undefined {
  const yearly = YEARLY[sex][plan]?.[String(age)];
  return yearly === undefined ? undefined : Math.round(yearly * FACTOR[mode]);
}

/**
 * The daily cash a compare premium pays for, in baht a day. That table's figures carry none
 * below the juvenile age, so the plan the age could have is not offered at a price without it.
 */
export function compareDailyCash(standardPlan: number | null, age: number, juvenileBelowAge: number): number | null {
  return age < juvenileBelowAge ? null : standardPlan;
}
