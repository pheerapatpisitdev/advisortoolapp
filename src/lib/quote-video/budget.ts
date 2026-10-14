import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { budgetFit, type PageBudget } from "@/lib/budget-sum";
import { iHealthyCard } from "@/lib/ihealthy-card";
import { iShieldModes, termAt as iShieldTermAt, termTakes } from "@/lib/ishield-quote";
import { iShieldTable } from "@/lib/ishield-table";
import { lifeProtectModes, termAt as lifeProtectTermAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { ISHIELD_SUMS, LIFEPROTECT_BUDGET_SUMS } from "@/lib/quote-pdf/pages";
import { legacyFromBudget } from "./legacy";
import { pensionFromBudget } from "./pension";
import { plbFromBudget } from "./plb";
import { iHealthyPlanCodes } from "./script";
import type { VideoInput } from "./script";

/**
 * วิดีโอนำเสนอ from a budget (owner, 2026-10-11): the agent gives what the customer can save and
 * the plan is worked out for them — the biggest sum whose instalment fits (Life Protect, iShield:
 * the sales pages' own budgetFit on their own sum lists) or the richest health plan whose
 * instalment fits (iHealthy Ultra), or the sum the premium buys to the baht (บำนาญ 95), or the
 * largest legacy whose instalment fits, monthly only where the company takes it (มรดก, legacy.ts), or the
 * largest of the /plb page's sums on the chosen term, likewise (Protection Life, plb.ts). What comes back is an ordinary arrangement, so everything
 * after it — facts, script, drawing — is the clip it always was.
 */

export interface Budget { baht: number; per: "month" | "year" }
export const BUDGET_LIMITS = { month: { min: 500, max: 1_000_000 }, year: { min: 6_000, max: 12_000_000 } } as const;

const NOT_SOLD = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";

export function cleanBudget(raw: unknown): Budget | string {
  const b = raw as Partial<Budget> | undefined;
  if (!b || (b.per !== "month" && b.per !== "year") || !Number.isFinite(b.baht)) return "ใส่งบให้ถูกต้อง";
  const baht = Math.floor(b.baht as number);
  const { min, max } = BUDGET_LIMITS[b.per];
  if (baht < min || baht > max) return `งบ${b.per === "month" ? "ต่อเดือน" : "ต่อปี"}ใส่ได้ ${min.toLocaleString("en-US")} – ${max.toLocaleString("en-US")} บาท`;
  return { baht, per: b.per };
}

const word = (per: Budget["per"]) => (per === "month" ? "เดือนละ" : "ปีละ");
const pick = (modes: ModePremium[] | undefined, per: Budget["per"]) => modes?.find((m) => m.mode === (per === "month" ? "monthly" : "annual"));

/** a sum list's own words when the budget is under its smallest: what the smallest costs */
function tooLow(smallest: number, modes: ModePremium[] | undefined, budget: Budget): string {
  const at = pick(modes, budget.per);
  return at
    ? `งบนี้ยังไม่พอสำหรับทุนต่ำสุด ${smallest.toLocaleString("en-US")} (เริ่มที่${word(budget.per)} ${formatBaht(at.total)} บาท)`
    : NOT_SOLD;
}

/**
 * The arrangement this budget buys, or the words for why it buys none. `v` is the form as sent
 * (its sum or plan is ignored); the answer carries the budget on, for the clip's own words.
 */
export function resolveBudget(v: VideoInput, budget: Budget, today: Date = new Date()): VideoInput | string {
  const page: PageBudget = { baht: budget.baht, per: budget.per };
  if (v.product === "IHEALTHY") {
    const codes = iHealthyPlanCodes();
    const card = iHealthyCard(new URLSearchParams({ age: String(v.age), sex: v.sex }), today);
    const row = card.premiumRows.find((r) => r.label === (budget.per === "month" ? "รายเดือน" : "รายปี"));
    if (!row) return NOT_SOLD;
    const price = (i: number) => Number((row.cells[i]?.text ?? "").replace(/[^\d]/g, "")) || 0;
    let best = -1;
    card.columns.forEach((c, i) => { if (c.sold && price(i) > 0 && price(i) <= budget.baht) best = i; });
    if (best < 0) {
      const first = card.columns.findIndex((c, i) => c.sold && price(i) > 0);
      return first < 0 ? NOT_SOLD : `งบนี้ยังไม่พอสำหรับแผนต่ำสุด ${card.columns[first].name} (เริ่มที่${word(budget.per)} ${price(first).toLocaleString("en-US")} บาท)`;
    }
    const plan = codes[best];
    return { ...v, plan, compare: v.compare.filter((c) => c !== plan), budget } as VideoInput;
  }

  // บำนาญ 95: the engine works a sum out of a premium itself, to the baht (pension.ts)
  if (v.product === "PENSION") return pensionFromBudget(v, budget);
  if (v.product === "LEGACY") return legacyFromBudget(v, budget, today);
  if (v.product === "PLB") return plbFromBudget(v, budget, today);

  const product = v.product === "ISHIELD" ? "ISHIELD" : "LIFEPROTECT";
  if (product === "ISHIELD") {
    const t = iShieldTable(today);
    if (t.expired) return NOT_SOLD;
    const term = iShieldTermAt(t, v.variant);
    if (!termTakes(t, term, v.age)) return NOT_SOLD;
    const sums = ISHIELD_SUMS.filter((s) => s >= t.saMin && s <= t.saMax && s % 50_000 === 0);
    const price = (sum: number) => iShieldModes(t, term, { sex: v.sex, age: v.age, sumAssured: sum });
    const fit = budgetFit(sums, price, page);
    return fit ? { ...v, sumAssured: fit.sum, budget } as VideoInput : tooLow(sums[0], price(sums[0]), budget);
  }

  const t = lifeProtectTable(today);
  if (t.expired) return NOT_SOLD;
  const term = lifeProtectTermAt(t, v.variant);
  const sums = LIFEPROTECT_BUDGET_SUMS.filter((s) => s >= 500_000 && s <= 50_000_000);
  const price = (sum: number) => lifeProtectModes(t, term, { sex: v.sex, age: v.age, sumAssured: sum });
  const fit = budgetFit(sums, price, page);
  return fit ? { ...v, sumAssured: fit.sum, budget } as VideoInput : tooLow(sums[0], price(sums[0]), budget);
}
