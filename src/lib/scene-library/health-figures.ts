import type { Sex } from "@/calc/types";
import { arrangementFor } from "@/lib/assistant/ihealthy/quote";
import { iHealthyFacts, isHeading, planLabel } from "@/lib/ihealthy-facts";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";

/**
 * The figures the health scenes draw, every one read from the iHealthy sheet or its rate table:
 * nothing here is typed in. The premium at each age is the health rider's own annual premium
 * for the plan (what the plan costs), priced by the same path the iHealthy page and the bot use,
 * on the standard arrangement (`arrangementFor`: default territory and coverage).
 */
export interface HealthFigures {
  plan: string;
  planName: string;
  annualMax: number;
  roomPerDay: number;
  waitingDays: number;
  specialWaitingDays: number;
  copayPercent: number;
  ages: { age: number; annual: number }[];
}

const AGES = [30, 40, 50, 60];
const ERROR = "เลือกแผน";

export function healthFigures(v: { plan: string; sex: Sex; age: number }): HealthFigures | string {
  const table = iHealthyTable();
  const facts = iHealthyFacts();
  const option = plansFor(table, v.age).find((p) => p.code === v.plan);
  if (!option) return ERROR;

  const row = facts.rows.find((r) => !isHeading(r) && r.no === 1);
  const text = row && !isHeading(row) ? row.adult[v.plan] : undefined;
  const room = text ? Number(text.match(/[\d,]+/)?.[0].replace(/,/g, "")) : NaN;
  if (!Number.isFinite(room)) return ERROR;

  const ages: HealthFigures["ages"] = [];
  for (const age of AGES) {
    if (!plansFor(table, age).some((p) => p.code === v.plan)) continue;
    const a = arrangementFor({ age, sex: v.sex, plan: v.plan });
    const priced = iHealthyPricing(table, {
      base: a.base, sex: v.sex, age, sumAssured: a.sumAssured,
      plan: a.plan, territory: a.territory, coverage: a.coverage,
    });
    const annual = priced?.rider.find((m) => m.mode === "annual");
    if (annual) ages.push({ age, annual: Math.round(annual.total) / 100 });
  }

  return {
    plan: v.plan,
    planName: planLabel(v.plan),
    annualMax: option.annualMax,
    roomPerDay: room,
    waitingDays: facts.terms.waitingDays,
    specialWaitingDays: facts.terms.specialWaitingDays,
    copayPercent: facts.copayPercent,
    ages,
  };
}
