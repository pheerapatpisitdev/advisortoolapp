import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { MODES } from "@/calc/mode-premiums";
import { riderDiseases } from "@/calc/riders/diseases";
import type { DeathBenefit, Sex } from "@/calc/types";
import { getPlan } from "@/calc/plans/registry";

/**
 * Every price the legacy page can ever show, worked out on the server.
 *
 * The page sells one arrangement over a closed domain — 46 ages, two sexes, ten sums — so
 * the whole answer is 920 rows. Pricing it in the browser instead meant shipping the plan
 * registry, and that registry statically imports the rate tables of all five plans: an ad
 * visitor was downloading 461 kB of iSmart and LifeTreasure rates to be told what one Life
 * Protect bundle costs. The table below is about 30 kB, and the engine never leaves the
 * server.
 */
export interface LegacyTable {
  /** the bundle a card for this page is addressed by */
  bundleCode: string;
  ageMin: number;
  ageMax: number;
  /** the number of tiers, which are the round millions the family receives */
  tiers: number;
  /** true when the rate table behind these figures has lapsed; then no price may be shown */
  expired: boolean;
  /** how many illnesses the rider names, for the sentence that counts them */
  diseaseCount: number;
  /** the smallest monthly instalment the company will accept, in baht */
  minMonthlyTotal: number;
  /**
   * [tier - 1][age - ageMin] = [annual, semi, monthly, monthlyUnderMinimum], in satang.
   * Null where the arrangement cannot be priced at all.
   *
   * The under-minimum flag is carried rather than recomputed from a threshold: the rule for
   * it belongs to the engine, and a second copy in the browser is a second thing to get
   * wrong later.
   */
  premiums: Record<Sex, (readonly number[] | null)[][]>;
  /** [tier - 1] — the bands turn only on whether the insured has reached the booster age */
  death: { under: DeathBenefit; from: DeathBenefit }[];
  /**
   * [tier - 1] — what the insured receives in their own hand on a critical illness claim.
   *
   * It is the rider's sum assured, not the tier's headline: the base policy pays on death
   * only, so it stays in force and is not part of this. Saying "the full amount" here, as
   * the page first did, overstates the smallest plan by 150,000 baht.
   */
  critical: number[];
  /**
   * [age - ageMin] = [annual, semi, monthly], in satang: the base policy alone. Its sum is
   * the same at every tier, so one row per age serves all ten; the rider's share of a tier is
   * that tier's total less this (owner, 2026-10-14: the page shows each contract's sum and
   * premium).
   */
  basePremiums: Record<Sex, (readonly number[] | null)[]>;
  /** what the page calls the two contracts, and how long each covers */
  contracts: {
    base: { name: string; sumAssured: number; coverToAge: number };
    rider: { name: string; coverToAge: number };
  };
}

const BUNDLE = getBundle("LEGACY_FAMILY")!;
const RANGE = bundleAgeRange(BUNDLE);

/**
 * The prices are built once per server process. Nothing in them depends on the date — the
 * engine consults it only to decide whether the rate table has lapsed — so `expired` is
 * asked again on every call and deliberately left out of what is remembered. Caching it
 * with the rest would let a process that happened to start before the lapse go on telling
 * customers the table was current for as long as it stayed alive.
 */
let cached: Omit<LegacyTable, "expired"> | undefined;

export function legacyTable(today: Date = new Date()): LegacyTable {
  const meta = quoteBundle(BUNDLE, 1, { age: RANGE.min, sex: "M", mode: "annual" }, today)!.meta;
  const expired = meta.expired;
  if (cached) return { ...cached, expired };
  const ages = Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i);
  const tiers = BUNDLE.tiers.map((t) => t.no);

  const priceRow = (tier: number, sex: Sex, age: number): readonly number[] | null => {
    const modes = bundleModePremiums(BUNDLE, tier, { age, sex }, today);
    if (!modes) return null;
    const by = (m: (typeof modes)[number]["mode"]) => modes.find((x) => x.mode === m);
    const [annual, semi, monthly] = MODES.map(by);
    if (!annual || !semi || !monthly) return null;
    return [annual.total, semi.total, monthly.total, monthly.belowMinimum ? 1 : 0];
  };

  const forSex = (sex: Sex) => tiers.map((tier) => ages.map((age) => priceRow(tier, sex, age)));

  // the base policy's own line of the quote, in each instalment
  const baseRow = (sex: Sex, age: number): readonly number[] | null => {
    const row = MODES.map((mode) => quoteBundle(BUNDLE, 1, { age, sex, mode }, today)?.items[0]?.modal);
    return row.every((v): v is number => typeof v === "number" && v > 0) ? row : null;
  };
  const plan = getPlan(BUNDLE.planCode)!;
  const riderCode = BUNDLE.tiers[0].riders[0].code;

  // a quote at each side of the booster age gives both sets of bands without recomputing them
  const death = tiers.map((tier) => ({
    under: quoteBundle(BUNDLE, tier, { age: RANGE.min, sex: "M", mode: "annual" }, today)!.deathBenefit!,
    from: quoteBundle(BUNDLE, tier, { age: RANGE.max, sex: "M", mode: "annual" }, today)!.deathBenefit!,
  }));

  cached = {
    bundleCode: BUNDLE.code,
    ageMin: RANGE.min,
    ageMax: RANGE.max,
    tiers: tiers.length,
    diseaseCount: riderDiseases(BUNDLE.tiers[0].riders[0].code)?.diseases.length ?? 0,
    minMonthlyTotal: meta.minMonthlyTotal,
    premiums: { M: forSex("M"), F: forSex("F") },
    death,
    critical: BUNDLE.tiers.map((t) => t.riders.reduce((sum, r) => sum + (r.sumAssured ?? 0), 0)),
    basePremiums: { M: ages.map((age) => baseRow("M", age)), F: ages.map((age) => baseRow("F", age)) },
    contracts: {
      // the variant names the age it runs to: WLF99H is whole life to 99
      base: { name: "Life Protect x 2", sumAssured: BUNDLE.tiers[0].sumAssured, coverToAge: Number(/\d+/.exec(BUNDLE.variant)?.[0] ?? 99) },
      rider: { name: plan.rules.riders[riderCode]?.name ?? riderCode, coverToAge: plan.rules.riders[riderCode]?.coverToAge ?? RANGE.max },
    },
  };
  return { ...cached, expired };
}
