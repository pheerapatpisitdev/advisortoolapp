import type { TwelvePlBenefits } from "@/lib/twelvepl-table";

/**
 * One policy year of 12 พีแอล as the company's ตารางแสดงผลประโยชน์ states it. Every amount
 * is in baht, unrounded where the sheet leaves it unrounded (the dividend and anything kept
 * with the company), so the totals add up the way the sheet's do.
 */
export interface TwelvePlYear {
  policyYear: number;
  /** the insured's age at the start of the year */
  age: number;
  /** guaranteed cash back paid at the end of the year; the last year adds the maturity */
  cashBack: number;
  /** the dividend in each of the company's examples (not guaranteed) */
  dividend: number[];
}

/**
 * ตารางแสดงผลประโยชน์ F, H, K, M for one issue age and sum: F = cash back (+ maturity in the
 * last year) × sum / 1,000; the dividend is (Non-G − cash back) × sum / 1,000 × share / 100.
 */
export function twelvePlYears(b: TwelvePlBenefits, age: number, ageMin: number, sumAssured: number): TwelvePlYear[] {
  const years = b.coverToAge - age;
  const nonG = b.nonGuaranteedPer1000[age - ageMin] ?? [];
  const k = sumAssured / 1000;
  return Array.from({ length: years }, (_, i) => {
    const last = i === years - 1;
    const cb = b.cashBackPer1000[i] ?? 0;
    const spread = (nonG[i] ?? cb) - cb;
    return {
      policyYear: i + 1,
      age: age + i,
      cashBack: (cb + (last ? b.maturityPer1000 : 0)) * k,
      dividend: b.dividendShares.map((share) => (spread * k * share) / 100),
    };
  });
}

/** What is left with the company grows at keepRate a year: G/I/L/N = this year's + last × (1 + rate). */
export function keptWithCompany(amounts: number[], rate: number): number[] {
  const out: number[] = [];
  amounts.forEach((a, i) => out.push(a === 0 ? 0 : a + (i > 0 ? out[i - 1] : 0) * (1 + rate)));
  return out;
}

/** The sheet's summary block: guaranteed cash backs, maturity, and each example's dividends. */
export function twelvePlTotals(rows: TwelvePlYear[], maturityPer1000: number, sumAssured: number) {
  const maturity = (maturityPer1000 * sumAssured) / 1000;
  const allBack = rows.reduce((t, r) => t + r.cashBack, 0);
  const lastCashBack = rows.length ? rows[rows.length - 1].cashBack - maturity : 0;
  return {
    /** cash backs over the contract, the last year's included (สรุป 1) */
    cashBacks: allBack - maturity - lastCashBack,
    /** the maturity with the last year's cash back on it (สรุป 2) */
    maturity: maturity + lastCashBack,
    guaranteed: allBack,
    dividends: rows.length ? rows[0].dividend.map((_, e) => rows.reduce((t, r) => t + r.dividend[e], 0)) : [],
  };
}

/**
 * Whole baht as Excel prints a cell formatted #,##0: half away from zero. The sheet's halves
 * (1,147.5) arrive here a hair under after the float arithmetic, so a nudge puts them back.
 */
export function excelRound(n: number): number {
  return Math.round(n + Math.sign(n) * 1e-7);
}
