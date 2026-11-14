import type { PayMode, Sex } from "@/calc/types";
import type { AttachedRider } from "@/lib/ihealthy-rider-quote";
import { coveragesFor, ihuKey, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import type { IHealthyBase, IHealthyPlanOption, IHealthyTable } from "@/lib/ihealthy-table";

/**
 * One arrangement of the health page, and everything needed to settle on a legal one.
 *
 * It began as somewhere to keep the type, so that the calculator and the link module would
 * not have to import each other for it. It has since taken on the rest of the same job —
 * what the page opens on, which sums each base is written for, and how a choice that the
 * company will not sell is walked to the nearest one it does — because all of it is the same
 * question asked at three different moments: on first paint, on a click, and on a link
 * arriving from somewhere else. Pricing lives next door in ihealthy-quote.ts; nothing here
 * quotes a premium, it only decides what there is to quote.
 */

/** Every choice the form holds: what a link carries and what the calculator opens on. */
export interface IHealthyInitial {
  age: number;
  sex: Sex;
  base: string;
  sumAssured: number;
  plan: string;
  territory: string;
  coverage: string;
  mode: PayMode;
  /**
   * The riders the agent's fold has attached, or nothing where it has not spoken.
   *
   * Three states, not two: a link with no rider in it comes from a page whose fold never
   * answered and is quoted with the agency's standard daily cash, while a link carrying an
   * empty list is a fold that was opened and emptied. Conflating them puts back a rider the
   * agent has just taken off.
   */
  riders?: AttachedRider[];
  /**
   * The instalments the agent switched off in ตั้งค่าส่วนตัว (src/lib/pay-prefs.ts), carried so a
   * picture or a printed page drawn with nobody signed in shows what the agent chose. Absent —
   * every bot's arrangement — is everything shown.
   */
  hide?: PayMode[];
}

/**
 * What a visitor arriving from an ad is shown before touching anything.
 *
 * iHealthy Ultra is a rider and cannot be issued on its own, so a quotation of it is always a
 * quotation of something else as well. The vehicle is therefore the cheapest one the company
 * writes: the Health Ultra Package, whose sum is pinned at fifty thousand and which exists for
 * exactly this — it cannot be bought without the health cover on it.
 *
 * It opened on ไลฟ์ โพรเทค+ x 2 at a hundred and fifty thousand, which is the smallest that
 * base can be written for and is not the smallest vehicle there is. For a woman of 35 on โกลด์
 * that was 2,130 a year against 710 — fourteen hundred a year of life cover added to a price
 * the customer asked for as a health price. The owner chose the cheaper vehicle when the two
 * were put side by side.
 *
 * What is given up is life cover: a hundred thousand before sixty rather than three hundred,
 * and a sum that cannot be raised without changing the base. Both are one tap away — the
 * other base is the second button, and it is the right answer for a customer who wants any
 * life cover at all. What is not given up is anything about the health cover itself: the same
 * plans, the same ceilings, the same riders at the same prices, and the same ages, since the
 * package starts at six and so does the rider.
 *
 * โกลด์ rather than the ceiling: the plan buttons carry their own ceilings and are one tap
 * away, so opening in the middle shows a real premium instead of the largest one.
 *
 * The three labels are the company's own wording. Should the rate table ever re-spell one,
 * `resolveArrangement` falls back to the first arrangement it does sell rather than pricing
 * nothing, so this stays a preference and never a precondition.
 */
export const IHEALTHY_OPENING: IHealthyInitial = {
  age: 35,
  sex: "F",
  base: "WLF99HX",
  sumAssured: 50_000,
  plan: "GOLD",
  territory: "ประเทศไทย",
  coverage: "Full Coverage",
  mode: "annual",
};

/**
 * The sums the form offers where the base lets the customer choose one.
 *
 * This list is the browser's half of a rule the engine keeps on the server: `quote()` voids
 * the whole arrangement to zero below the base's own floor, so a form that could reach a
 * smaller sum would show a premium for something the company would not issue.
 */
const SUMS = [150_000, 300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000];

/** The base a variant names, or — for a variant this rate table no longer carries — the
 * first one it does. `iHealthyPricing` and `deathBenefitOf` throw on a base they have never
 * heard of, and a link written against last season's table must not take the page down with
 * it. The table refuses to build without all three bases, so there is always a first. */
export function baseFor(table: IHealthyTable, variant: string): IHealthyBase {
  return table.bases.find((b) => b.variant === variant) ?? table.bases[0];
}

/** The sums this base can be written for: the one it pins, or the list above less anything
 * its own floor has risen past. A floor above the whole list narrows it to that floor rather
 * than leaving the customer a picker with nothing in it. */
export function sumsFor(base: IHealthyBase): number[] {
  if (base.fixedSum !== undefined) return [base.fixedSum];
  const offered = SUMS.filter((s) => s >= base.saMin);
  return offered.length > 0 ? offered : [base.saMin];
}

/**
 * The sum to price, given the one the customer last asked for.
 *
 * Reading it back through the base on every render is what stops the package's fifty
 * thousand from being carried over to a base that is not issued under a hundred and fifty —
 * an arrangement the engine would zero — and what keeps the select's value one of the
 * options it is showing.
 */
export function sumFor(base: IHealthyBase, wanted: number): number {
  const sums = sumsFor(base);
  return sums.includes(wanted) ? wanted : sums[0];
}

export interface IHealthyArrangement {
  /** the plan being priced, and every plan this age may buy */
  plan?: IHealthyPlanOption;
  plans: IHealthyPlanOption[];
  territory?: string;
  territories: string[];
  coverage?: string;
  coverages: string[];
}

function first<T>(xs: T[]): T | undefined {
  return xs.length > 0 ? xs[0] : undefined;
}

/**
 * Whether the company has a rate for one whole arrangement at this age.
 *
 * Said again here rather than borrowed: ihealthy-quote.ts keeps its own copy private, and
 * its three filters each answer about one field with the other two held at their defaults —
 * which is the right question for a picker's list and the wrong one for the combination
 * being priced. Either sex answers for both, the same assumption the filters are built on.
 */
function sells(
  table: IHealthyTable, plan: string, age: number, territory: string, coverage: string,
): boolean {
  const key = ihuKey(table, plan, age, territory, coverage);
  const rates = key === undefined ? undefined : table.riderRates[key];
  const i = age - table.ageMin;
  if (rates === undefined || i < 0 || i >= rates.M.length) return false;
  return rates.M[i] !== null || rates.F[i] !== null;
}

/**
 * The nearest arrangement the company actually sells to the one asked for — โกลด์ has no
 * เอเชีย, an eight-year-old has no ซิลเวอร์ — together with what it may be swapped for.
 *
 * One pass, because each list only exists once the answer above it is settled: a plan this
 * age cannot buy has no territories to offer, and a territory nobody is sold has no way of
 * sharing the bill.
 *
 * Resolved while rendering rather than corrected afterwards in an effect. An effect runs
 * after the paint, so an age change would put one frame on screen with a plan that has no
 * price — the card blinking empty between two good arrangements — and a customer scrolling
 * the age wheel would see it flicker on every step.
 */
export function resolveArrangement(
  table: IHealthyTable,
  age: number,
  wanted: { plan: string; territory: string; coverage: string },
): IHealthyArrangement {
  const plans = plansFor(table, age);
  const plan = plans.find((p) => p.code === wanted.plan) ?? first(plans);
  const territories = plan === undefined ? [] : territoriesFor(table, plan.code, age);
  const territory = territories.includes(wanted.territory) ? wanted.territory : first(territories);
  // `coveragesFor` answers for the whole page — any plan at all — so the list is narrowed to
  // the plan actually being priced, or the three fields would be legal one at a time and not
  // together. It cannot narrow to nothing: the territory above was chosen under the default
  // coverage, which is therefore one this plan sells there.
  const coverages = plan === undefined || territory === undefined
    ? []
    : coveragesFor(table, territory, age).filter((c) => sells(table, plan.code, age, territory, c));
  const coverage = coverages.includes(wanted.coverage) ? wanted.coverage : first(coverages);
  return { plan, plans, territory, territories, coverage, coverages };
}
