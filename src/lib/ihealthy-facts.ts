import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import type { IHealthyPlanOption } from "@/lib/ihealthy-table";
import raw from "../../data/riders/ihealthy-ultra.json";

/**
 * The iHealthy Ultra benefit sheet, typed.
 *
 * Its -facts siblings exist to compute their figures from the engine so that no number is
 * ever typed into the JSX. This one computes nothing: every string below is the company's
 * own wording, lifted out of the workbook by scripts/extract_ihu_benefits.py and never
 * edited by hand. What it adds is the two questions the benefit table would otherwise ask
 * on every cell — is this row a heading, and does this plan's wording change for a child —
 * and the one number the sheet does not carry, which it imports rather than repeat.
 */

/** A row that names a part of the contract and has no figures of its own. */
export interface BenefitHeading {
  heading: string;
}

export interface BenefitRow {
  /** the หมวด number, or null for a sub-row like หมวดย่อยที่ 2.1 */
  no: number | null;
  title: string;
  /** true for the rows that live on the endorsement rather than the rider itself */
  endorsement: boolean;
  /**
   * How many days or times this row may be claimed, where the contract caps it — the second
   * column of each plan's triple on the sheet, identical across all six where it says
   * anything at all. Two of the thirty-six rows have one, and without it they read as cover
   * with no limit on it.
   */
  limit?: string;
  /** plan code → what the sheet says, verbatim */
  adult: Record<string, string>;
  /** the สมาร์ท and บรอนซ์ wording for a child, only where it differs */
  child?: Record<string, string>;
}

export type BenefitEntry = BenefitHeading | BenefitRow;

/**
 * A plan as the benefit sheet describes it. The five fields come from the rate table's own
 * `IHealthyPlanOption` rather than a second declaration of them, because the page holds both
 * lists at once — `plansFor` filters the rate table's for the pickers while the benefit
 * columns are drawn from these — and two lists that only happen to agree will one day not.
 * The note is the company's full sentence for the annual maximum, which only this sheet has.
 */
export interface IHealthyBenefitPlan extends IHealthyPlanOption {
  annualMaxNote: string;
}

export interface IHealthyTerms {
  renewalToAge: number;
  waitingDays: number;
  specialWaitingDays: number;
  specialWaitingDiseases: string[];
  noClaimDiscountPercent: number;
  outOfTerritoryDays: number;
  renewalCopay: string;
  preExisting: string;
  exclusions: string;
  premiumChanges: string;
  outOfTerritory: string;
  noClaimDiscount: string;
  sharedLimit: string;
  participationNote: string;
}

export interface IHealthyFacts {
  name: string;
  plans: IHealthyBenefitPlan[];
  copayPercent: number;
  rows: BenefitEntry[];
  terms: IHealthyTerms;
  disclaimer: string;
  /** below this age the child columns apply; the same boundary the rate key uses */
  juvenileBelowAge: number;
}

/**
 * The sheet is read once at import and every caller is handed the same arrays, so a
 * component that sorted `facts.rows` in place would quietly reorder every later render in
 * the process. One pass at startup turns that into a TypeError at the line that does it.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/**
 * Named one by one, and before the freeze, for two different reasons.
 *
 * The sheet also carries `code` and, in `source`, the filename of the workbook it was cut
 * from — ours to know, not a customer's. A property no module ever reads is one the bundler
 * is free to drop, and webpack does drop it. Freezing the whole import first would instead
 * walk every property to freeze it, and a property that is read is a property that ships:
 * that one line is the difference between the filename being in the browser and not.
 *
 * Naming them also means a field added to the JSON tomorrow cannot reach a browser until
 * somebody declares it here on purpose.
 */
const { name, plans, copayPercent, rows, terms, disclaimer } = raw;
const sheet = deepFreeze({ name, plans, copayPercent, rows, terms, disclaimer });

/**
 * What a plan is called on screen.
 *
 * The sheet's own name is Thai — สมาร์ท, บรอนซ์ — and stays in the data, because that is the
 * company's wording and the extract should keep saying what the workbook says. The page
 * shows the English, which is how the plans are written everywhere else this agency sells
 * them, and it is the rate key's own code title-cased rather than a seventh list to keep.
 */
export function planLabel(code: string): string {
  return code.charAt(0) + code.slice(1).toLowerCase();
}

export function isHeading(entry: BenefitEntry): entry is BenefitHeading {
  return "heading" in entry;
}

/**
 * The company's own numbering, as it appears at the head of a row or a heading — in Thai, and
 * in each of the readings the page offers (see ihealthy-translate.ts), whose headings keep
 * the number where the Thai has it so the phone's "N more categories" counts the same.
 */
const CATEGORY_NO = /^(?:หมวดที่ |Category |Раздел |第|အပိုင်း |Catégorie |Kategorie )(\d+)/;

/**
 * Every หมวด the contract has, in order.
 *
 * Three of the twenty-eight — 2, 4 and 6 — are not rows at all: the sheet gives each a
 * heading and hangs its figures on sub-rows underneath, which carry no number of their own.
 * Counting rows with a number therefore missed those three, and the page told a phone reader
 * there were twenty more categories when there were twenty-three.
 */
export function categoryNumbers(rows: readonly BenefitEntry[]): number[] {
  const found = new Set<number>();
  for (const entry of rows) {
    if (isHeading(entry)) {
      const match = CATEGORY_NO.exec(entry.heading);
      if (match) found.add(Number(match[1]));
    } else if (entry.no !== null) {
      found.add(entry.no);
    }
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * What this plan pays on this row for someone of this age. Only the wording changes here —
 * whether the company sells that plan at that age is the rate table's answer, and the table
 * component asks `plansFor` for it rather than keeping a second list of who may buy what.
 *
 * `undefined` never means "not covered". Every one of the 36 benefit rows carries all six
 * plan codes, and a plan that pays nothing on a row says so in the company's words ("-",
 * "ไม่คุ้มครอง"), so a missing value can only mean the extract dropped a column. Show that
 * as the fault it is; `?? ""` would render the regression as an ordinary empty cell.
 */
export function benefitValue(row: BenefitRow, plan: string, age: number): string | undefined {
  if (age < JUVENILE_BELOW_AGE && row.child && plan in row.child) return row.child[plan];
  return row.adult[plan];
}

/**
 * No cast: the return type is what checks the extract script's output against the shapes
 * above, so a heading that loses its text or a row that loses its adult column fails the
 * build rather than the page.
 *
 * The object is fresh each call and the sheet inside it is not, which is the point — the
 * caller may add to what it hands on, and cannot disturb what it was given.
 */
export function iHealthyFacts(): IHealthyFacts {
  return { ...sheet, juvenileBelowAge: JUVENILE_BELOW_AGE };
}
