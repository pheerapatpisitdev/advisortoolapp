import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, applyModeFactorToFixed, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { IHealthyBase, IHealthyPlanOption, IHealthyTable } from "@/lib/ihealthy-table";
import { shows } from "@/lib/pay-prefs";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
export const MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * What a daily-cash plan is called to a customer.
 *
 * One spelling, because four surfaces print it — the standard label the slim table builds,
 * the card, the copied text and the picture — and the agent may attach a plan other than the
 * agency's own. Naming the plan from the label rather than the label from the plan is how the
 * card came to promise a thousand a day over a five-thousand premium.
 *
 * Here rather than beside the table that first builds it: this module is the browser's half
 * of the pricing and reaches nothing but money and types, while ihealthy-table.ts reaches the
 * plan registry and the 2.7 MB of rate tables behind it. One value imported from there by the
 * client island puts all of it in the bundle.
 */
export function dailyCashLabel(plan: number): string {
  return `ค่าชดเชยรายวัน ${plan.toLocaleString("en-US")} บาท`;
}

export interface IHealthyChoice {
  base: string;
  sex: Sex;
  age: number;
  sumAssured: number;
  plan: string;
  territory: string;
  coverage: string;
}

/** A component premium. The company's floor is judged on the total, so only the total carries it. */
export type ComponentPremium = Omit<ModePremium, "belowMinimum">;

export interface IHealthyPricing {
  /** the base plan on its own, per mode */
  base: ComponentPremium[];
  /** the health rider on its own, per mode */
  rider: ComponentPremium[];
  /**
   * The daily-cash rider the agency attaches as standard, per mode, and what to call it —
   * undefined above the age the company writes it at, where the quote is simply the two
   * contracts.
   */
  standard?: { label: string; premiums: ComponentPremium[] };
  /** what the customer actually pays, and the mode that falls under the company's floor */
  total: ModePremium[];
}

/** The base this variant names. Throws rather than quote a stale one, as `termAt` does. */
export function baseAt(table: IHealthyTable, variant: string): IHealthyBase {
  const base = table.bases.find((b) => b.variant === variant);
  if (!base) throw new Error(`Unknown base: ${variant}`);
  return base;
}

/**
 * The label whose rate-key letter is empty — ประเทศไทย, Full Coverage. The filters probe with
 * it, and the table carries it as data, so a re-spelled label moves the probe with it.
 */
function defaultLabel(letters: Record<string, string>): string {
  const found = Object.keys(letters).find((label) => letters[label] === "");
  if (found === undefined) throw new Error("no rate-key letter is the empty one any more");
  return found;
}

/**
 * The key the workbook composes at `'iHealthy Ultra Rate'!D7`. Undefined where a label is
 * not one the rate table spells a letter for; the two defaults spell the empty letter, so
 * every lookup here asks for `undefined` rather than for truth.
 */
export function ihuKey(
  table: IHealthyTable, plan: string, age: number, territory: string, coverage: string,
): string | undefined {
  const option = table.plans.find((p) => p.code === plan);
  const c = table.coverages[coverage];
  const t = table.territories[territory];
  if (!option || c === undefined || t === undefined) return undefined;
  return `MHP${c}${option.planNo}${age < table.juvenileBelowAge ? "J" : "S"}${t}`;
}

/**
 * Whether the company sells this key at this age at all. Either sex answers for both: no key
 * has a rate for one sex only, which ihealthy-table.test.ts asserts across all 28 of them, so
 * the pickers need not ask the customer's sex before offering a plan. Should a rate revision
 * ever break that, the assertion fails rather than this offering a plan with a blank price.
 *
 * An age off either end of the table reads `undefined`, which is neither of the two absences
 * the table defines — so it is ruled out first rather than allowed to pass for a sale.
 */
function hasRate(table: IHealthyTable, key: string, age: number): boolean {
  const rates = table.riderRates[key];
  if (!rates) return false;
  const i = age - table.ageMin;
  if (!(i >= 0 && i < rates.M.length)) return false;
  return rates.M[i] !== null || rates.F[i] !== null;
}

/** Whether one whole arrangement is on sale: the key exists, and it has a rate at this age. */
function sells(table: IHealthyTable, plan: string, age: number, territory: string, coverage: string): boolean {
  const key = ihuKey(table, plan, age, territory, coverage);
  return key !== undefined && hasRate(table, key, age);
}

/**
 * The plans this age can buy, which the rate table answers on its own: there is no
 * `MHP3J`, so a child is never offered ซิลเวอร์. Matching `กรอกข้อมูล!M29` without
 * repeating its conditions.
 */
export function plansFor(table: IHealthyTable, age: number): IHealthyPlanOption[] {
  const territory = defaultLabel(table.territories);
  const coverage = defaultLabel(table.coverages);
  return table.plans.filter((p) => sells(table, p.code, age, territory, coverage));
}

/** The territories this plan sells in at this age, again read off the rate table. */
export function territoriesFor(table: IHealthyTable, plan: string, age: number): string[] {
  const coverage = defaultLabel(table.coverages);
  return Object.keys(table.territories).filter((t) => sells(table, plan, age, t, coverage));
}

/**
 * The ways of sharing the bill that this territory sells at this age — full cover everywhere,
 * the deductible and the co-payment in Thailand only. Read off the rate table like its two
 * neighbours: the company's own list, not a copy of it that a re-spelling would silence.
 */
export function coveragesFor(table: IHealthyTable, territory: string, age: number): string[] {
  return Object.keys(table.coverages)
    .filter((c) => table.plans.some((p) => sells(table, p.code, age, territory, c)));
}

function baseModes(table: IHealthyTable, choice: IHealthyChoice): ComponentPremium[] | undefined {
  const rate = baseAt(table, choice.base).rates[choice.sex][choice.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactor(rate100, choice.sumAssured, toHundredths(table.modeFactors[mode])),
  }));
}

function riderModes(table: IHealthyTable, choice: IHealthyChoice): ComponentPremium[] | undefined {
  const key = ihuKey(table, choice.plan, choice.age, choice.territory, choice.coverage);
  const annual = key === undefined ? null : table.riderRates[key]?.[choice.sex][choice.age - table.ageMin];
  if (annual === null || annual === undefined) return undefined;
  const annual100 = toHundredths(annual);
  return MODES.map((mode) => ({
    mode,
    total: applyModeFactorToFixed(annual100, toHundredths(table.modeFactors[mode])),
  }));
}

/**
 * The base plan and the health rider priced in every mode, the way base-premium.ts and
 * riders/fixed-by-key-age.ts do it: the base is a rate per thousand rounded down in satang,
 * the rider is a fixed annual premium scaled by the mode factor and rounded down. The
 * company's monthly floor is judged on the total, as `checkMonthlyMinimum` judges it.
 *
 * One thing base-premium.ts does that this does not: subtract a per-thousand discount for a
 * large sum assured. This plan's discount table is all zeros, and the parity test draws sums
 * up to five million, so a rate revision that started discounting would fail it rather than
 * quietly overcharge the browser's half of the page.
 *
 * Undefined when the arrangement has no price, which the pickers already prevent.
 */
export function iHealthyPricing(
  table: IHealthyTable,
  choice: IHealthyChoice,
  attached?: IHealthyPricing["standard"],
): IHealthyPricing | undefined {
  const base = baseModes(table, choice);
  const rider = riderModes(table, choice);
  if (!base || !rider) return undefined;
  // What the agent has actually attached, once the fold has said — it replaces the standard
  // rider rather than joining it, because the standard is one of the things it counts. None
  // of those riders is priced on the health plan, so the same subtotal is right under every
  // one of the six.
  const standard = attached ?? standardModes(table, choice.age);
  const total = MODES.map((mode, i) => {
    const sum = base[i].total + rider[i].total + (standard ? standard.premiums[i].total : 0);
    return { mode, total: sum, belowMinimum: mode === "monthly" && sum < table.minMonthly * 100 };
  });
  return { base, rider, standard, total };
}

/**
 * The daily-cash rider at the plan the agency attaches for this age, scaled to each mode the
 * way the engine scales a fixed annual premium. The server has already decided which plan
 * the age may have and what it costs a year; nothing about the company's age bands is
 * repeated here.
 */
function standardModes(table: IHealthyTable, age: number): IHealthyPricing["standard"] {
  const i = age - table.ageMin;
  const annual = table.standard.annual[i] ?? null;
  const label = table.standard.label[i];
  if (annual === null || !label) return undefined;
  return {
    label,
    premiums: MODES.map((mode) => ({
      mode,
      total: applyModeFactorToFixed(annual, toHundredths(table.modeFactors[mode])),
    })),
  };
}

/** What quote.ts returns for this base with no death-paying rider attached. */
export function deathBenefitOf(table: IHealthyTable, base: string, age: number, sumAssured: number): DeathBenefit {
  const { booster } = baseAt(table, base);
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}

export interface IHealthyShown {
  /** all three in satang, as the pricing carries them */
  base: number;
  rider: number;
  /** the daily cash the agency attaches as standard, absent above the age it is written at */
  standard?: { label: string; total: number };
  total: number;
  belowMinimum: boolean;
  /**
   * The instalments the card is not headlining, in the order the table prices them — less any
   * the company will not accept. Every sibling calculator drops those the same way: a figure
   * printed under a heading that says how to pay is an offer to be paid that way.
   */
  others: { mode: PayMode; total: number }[];
  /**
   * The instalments the company will not accept, named rather than merely absent. Dropping
   * them was right — a figure under a heading that says how to pay is an offer to be paid
   * that way — but dropping them silently left a reader wondering where the monthly line
   * went, and this page has no instalment picker to ask again with.
   */
  refused: PayMode[];
}

/**
 * The three figures for the instalment on screen, or nothing at all.
 *
 * Nothing rather than a partial row: a mode the pricing turns out not to carry is a miss,
 * and a card that printed a total with no base line under it would read as a complete quote.
 *
 * It lived in the calculator until the bot needed it. The calculator is a client component,
 * and a server module importing a value out of one drags the whole component after it.
 */
export function shownAt(
  priced: IHealthyPricing | undefined, mode: PayMode, hide: readonly PayMode[] = [],
): IHealthyShown | undefined {
  if (priced === undefined) return undefined;
  const base = priced.base.find((m) => m.mode === mode);
  const rider = priced.rider.find((m) => m.mode === mode);
  const total = priced.total.find((m) => m.mode === mode);
  if (!base || !rider || !total) return undefined;
  const standard = priced.standard?.premiums.find((m) => m.mode === mode);
  return {
    base: base.total,
    rider: rider.total,
    ...(priced.standard && standard
      ? { standard: { label: priced.standard.label, total: standard.total } }
      : {}),
    total: total.total,
    belowMinimum: total.belowMinimum,
    others: priced.total
      .filter((m) => m.mode !== mode && !m.belowMinimum && shows(hide, m.mode))
      .map((m) => ({ mode: m.mode, total: m.total })),
    // an instalment the agent switched off (src/lib/pay-prefs.ts) is neither offered nor
    // explained away: the customer is not told about a way of paying they were not shown
    refused: priced.total.filter((m) => m.mode !== mode && m.belowMinimum && shows(hide, m.mode)).map((m) => m.mode),
  };
}
