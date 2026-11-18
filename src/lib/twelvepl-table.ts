import { getPlan } from "@/calc/plans/registry";
import { wPlanTable, type LifeProtectTable } from "@/lib/lifeprotect-table";

/**
 * Everything the 12 พีแอล page prices from in the browser: the W family's table (one term,
 * the same riders the Life Protect page sells — owner, 2026-11-18) plus what this plan pays
 * the living insured, which no other page has: a cash back every year and a dividend the
 * company does not guarantee.
 */
export interface TwelvePlBenefits {
  /** the age cover ends and the maturity is paid */
  coverToAge: number;
  /** what staying to the end pays, per 1,000 of sum assured, before that year's cash back */
  maturityPer1000: number;
  /** guaranteed cash back per 1,000 by policy year, from the first; the same at every issue age */
  cashBackPer1000: number[];
  /**
   * cash back plus the dividend scale, per 1,000 by policy year, [issue age - ageMin]. The
   * workbook's dividend is (this − cash back) × the example's share.
   */
  nonGuaranteedPer1000: number[][];
  /** the share of the dividend scale each of the company's three examples pays, in percent */
  dividendShares: number[];
  /** the yearly interest on money left with the company, as a fraction (0.005) */
  keepRate: number;
}

export interface TwelvePlTable extends LifeProtectTable {
  benefits: TwelvePlBenefits;
}

export const TWELVEPL_PLAN = "12PL";

interface RawBenefits {
  coverToAge: number;
  maturityPer1000: number;
  cashBackPer1000: number[];
  nonGuaranteedPer1000: Record<string, number[]>;
  dividendShares: number[];
  keepRate: number;
}

export function twelvePlTable(today: Date = new Date()): TwelvePlTable {
  const base = wPlanTable(TWELVEPL_PLAN, [{ variant: "12PL", label: "ชำระเบี้ย 12 ปี", short: "จ่าย 12 ปี" }], today);
  const raw = (getPlan(TWELVEPL_PLAN)!.rates as unknown as { benefits: RawBenefits }).benefits;
  return {
    ...base,
    benefits: {
      coverToAge: raw.coverToAge,
      maturityPer1000: raw.maturityPer1000,
      cashBackPer1000: raw.cashBackPer1000,
      nonGuaranteedPer1000: Array.from(
        { length: base.ageMax - base.ageMin + 1 },
        (_, i) => raw.nonGuaranteedPer1000[String(base.ageMin + i)] ?? [],
      ),
      dividendShares: raw.dividendShares,
      keepRate: raw.keepRate,
    },
  };
}
