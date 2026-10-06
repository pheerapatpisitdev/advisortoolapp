import type { CoverTopUp, DeathBenefit, PlanRules } from "@/calc/types";

export type { CoverTopUp };

/**
 * One policy walked forward a year at a time — what has been paid in, what the family would
 * receive, and what surrendering would return.
 *
 * Every amount is in satang, the way the whole of calc/money.ts works. The company's table
 * gives surrender values in whole baht, so they are multiplied up when the rows are built:
 * comparing a premium against a cash value then needs no rounding on either side first, and
 * the year the one overtakes the other is exact.
 */
export interface ProjectionRow {
  policyYear: number;
  /** the insured's age at the start of that policy year, as the company table labels it */
  age: number;
  /**
   * What the family receives if the insured dies that year — the greater of the plan's
   * multiple of the sum assured, the surrender value, and 101% of the premiums paid so far
   */
  cover: number;
  /**
   * the premium falling due that year, riders included; 0 once nothing is left to pay, null
   * with no price
   */
  premiumDue: number | null;
  /** every premium due up to and including this year, riders included */
  premiumPaid: number | null;
  /** what surrendering at the end of that year returns */
  cashValue: number;
  /**
   * What the policy pays the living insured that year, for the plans that pay one.
   *
   * It is the whole point of a savings plan and it is invisible in every other column: a
   * first year that shows 277,000 paid in and 2,000 surrenderable reads as a terrible
   * bargain until the 10,000 handed back that same year is on the page beside it.
   */
  payout?: number;
}

export interface Projection {
  rows: ProjectionRow[];
  /** the first year the policy is worth at least what has been put into it */
  breakEven: ProjectionRow | null;
  /** how many opening years return nothing at all */
  zeroYears: number;
  /** the age the last row's money is held at — the company labels it the year after */
  maturityAge: number;
  /**
   * The cover the plan promises on the sum assured alone once the booster is past, before
   * any top-up for premiums paid. The chart rules a line at it because it is the number the
   * customer chose; `cover` on a row can sit above it.
   */
  coverFloor: number;
}

export interface ProjectionInput {
  /** cash-value factors per thousand of sum assured, one per policy year from the first */
  factors: number[];
  /** the insured's age when the policy is issued */
  age: number;
  sumAssured: number;
  /** the yearly premium in satang, or null when no price may be shown */
  annualSatang: number | null;
  /** how many years the premium is paid */
  payYears: number;
  /**
   * What the riders add to each policy year's premium, in satang, from the first year; a
   * year past the end adds nothing. Counted in what is paid and in the break-even, never in
   * the cover's top-up, which the contract works out on the plan's own premiums.
   */
  riderDue?: number[];
  death: DeathBenefit;
  topUp: CoverTopUp;
  /** the plan's yearly survival benefit, where it sells one — `rules.base.maturity.survivalPayout` */
  payout?: NonNullable<PlanRules["base"]["maturity"]>["survivalPayout"];
  /** what staying to the end pays, as a percent of the sum assured — `maturity.percentOfSumAssured` */
  maturityPercent?: number;
}

/**
 * What the plan hands back in one policy year, in satang.
 *
 * The final year is the maturity rather than another instalment, which is how the company's
 * own sheet reads it: the column is headed "เงินจ่ายคืน… และเงินครบกำหนดสัญญา" and its last
 * row carries the whole contract. That figure is handled by the caller, not here.
 */
function payoutIn(
  bands: ProjectionInput["payout"], sumAssured: number, policyYear: number, lastYear: number,
): number | undefined {
  if (!bands?.length || policyYear >= lastYear) return undefined;
  let from = 1;
  for (const band of bands) {
    const through = band.throughPolicyYear ?? lastYear - 1;
    if (policyYear >= from && policyYear <= through) {
      return Math.round((sumAssured * band.percentOfSumAssured) / 100) * 100;
    }
    from = through + 1;
  }
  return undefined;
}

export function cashProjection(
  { factors, age, sumAssured, annualSatang, payYears, death, topUp, payout, maturityPercent, riderDue }: ProjectionInput,
): Projection {
  /**
   * Staying to the end pays what the rules promise, or the surrender value if that has grown
   * past it — which it does at the older issue ages, where six years of premium come to more
   * than the promise and the table's own last factor rises to meet them.
   */
  const maturity = maturityPercent === undefined
    ? undefined
    : Math.round((sumAssured * maturityPercent) / 100) * 100;
  let paid = 0;
  let planPaid = 0;
  const rows: ProjectionRow[] = factors.map((factor, i) => {
    const at = age + i;
    const planDue = annualSatang === null ? null : i < payYears ? annualSatang : 0;
    const due = planDue === null ? null : planDue + (riderDue?.[i] ?? 0);
    if (due !== null) paid += due;
    if (planDue !== null) planPaid += planDue;
    // the same ROUND(factor × sum / 1000) baht as cash-value.ts, then carried in satang
    const cashValue = Math.round((factor * sumAssured) / 1000) * 100;
    /**
     * Late in a long contract the premiums paid overtake the sum assured, and a cover drawn
     * without the top-up would understate what the family receives.
     */
    const promised = (at < death.beforeAge ? death.sumBefore : death.sumFrom)
      * (topUp.sumAssuredMultiple ?? 1) * 100;
    const floors = [promised];
    if (topUp.includeCashValue) floors.push(cashValue);
    if (annualSatang !== null) floors.push(Math.round((planPaid * topUp.premiumPercent) / 100));
    return {
      policyYear: i + 1,
      age: at,
      cover: Math.max(...floors),
      premiumDue: due,
      premiumPaid: annualSatang === null ? null : paid,
      cashValue,
      ...(() => {
        const last = i + 1 === factors.length;
        const back = last && maturity !== undefined
          ? Math.max(maturity, cashValue)
          : payoutIn(payout, sumAssured, i + 1, factors.length);
        return back === undefined ? {} : { payout: back };
      })(),
    };
  });

  let zeroYears = 0;
  while (zeroYears < rows.length && rows[zeroYears].cashValue === 0) zeroYears += 1;

  /**
   * The first year the policy has returned what was put into it.
   *
   * The money handed back along the way counts. On a plan that pays one, leaving it out puts
   * the break-even sixteen years late — iSmart at 35 surrenders its way past the premiums in
   * year 34, and has already handed back 610,000 of them by then. A table that highlights
   * the later year is telling the customer the plan is worse than it is, in the one figure
   * they look for.
   */
  let received = 0;
  const breakEven = rows.find((r) => {
    received += r.payout ?? 0;
    return r.premiumPaid !== null && r.cashValue + received >= r.premiumPaid;
  }) ?? null;
  return {
    rows, breakEven, zeroYears, maturityAge: age + factors.length,
    coverFloor: death.sumFrom * (topUp.sumAssuredMultiple ?? 1) * 100,
  };
}
