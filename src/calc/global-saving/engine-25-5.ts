/**
 * Global Savings Plus 25/5 (Index Linked), Krungthai-AXA plan code E25G5A — pay 5 years, covered
 * 25: 1% of the sum at the end of every year 1–24, 501% at maturity (525% guaranteed in all), and
 * an index bonus at the end of years 10, 15, 20 and at maturity that is not guaranteed.
 *
 * Where each figure comes from (2026-11-16):
 *  - payback, maturity, the death steps, the index payout tables and the 90% participation rate:
 *    AdvisorZone 6.33's own benefit illustration for this plan.
 *  - premium rates: 995 at ages 2, 30, 40, 50, 55, 60 and 65 (sums 100,000 and 200,000), 990 at
 *    age 2 (sum 500,000 and up), 1,000 at ages 66, 70 and 75 (sums 100,000 to 1,000,000) — so the
 *    dearer rate starts at 66 and has no size discount, and a woman of 30 pays what a man does;
 *    sum limits 20,000–20,000,000: AdvisorZone's premium screen and printed illustrations.
 *  - the surrender column: ten AdvisorZone illustrations — men at entry ages 2, 40, 50, 55, 60,
 *    65, 66, 70 and 75, a woman at 30. They are the ONLY rows on hand, and men and women share
 *    them here (whether the column differs by sex is not known): `surrenderPct` returns the row
 *    of the nearest of those ages at or below the entry age — the low side for the ages between.
 *  - NOT confirmed: the rate under a sum of 100,000 (taken as 1,000 at every age).
 *    `quoteGlobalSaving255` notes it when a quote leans on it.
 *  - the rounding of the index bonus: the printed illustrations for men of 40 to 75 (the owner's
 *    40.pdf … 75.pdf, AdvisorZone 6.33, 2026-11-16), which works each example through — the index level
 *    is cut to four places, and the bonus to the satang before and after the payout share.
 *  - NOT confirmed: the rate under a sum of 100,000 (taken as 1,000) and the rate from 66 under a
 *    sum of 500,000 (taken as 1,000 too). `quoteGlobalSaving255` warns when a quote leans on either.
 *  - the index bonus formula reproduces the age-65 illustration at 3% a year to the baht (year-10
 *    bonus 15,398.84, death and surrender add-ons, IRR 3.02%).
 *
 * The figures the illustration showed are pinned in tests/calc/global-saving-25-5.test.ts.
 */

import { irr } from "./engine";

export const GS25_TERM = 25;
export const GS25_PREM_YEARS = 5;
export const GS25_CODE = "E25G5A";
/** the code the illustration prints at 75; 66 and 70 still print E25G5A, so where it starts (71, with the 200,000 floor?) is not known */
export const GS25_CODE_SENIOR = "E25G5AS";
export const GS25_AGE_MIN = 0;
export const GS25_AGE_MAX = 75;
export const GS25_MIN_SA = 20_000;
export const GS25_MAX_SA = 20_000_000;
/** the sum assured floor from age 71 */
export const GS25_MIN_SA_FROM_71 = 200_000;
/** what the Revenue Department allows off income for life premiums, all policies together */
export const GS25_TAX_CAP = 100_000;

const PAYBACK_PCT = 0.01;
const MATURITY_PCT = 5.01;
/** the participation rate in the index's rise */
const PARTICIPATION = 0.9;
/** the index bonus paid while alive: [end of year, share of the rise] */
const ALIVE_BONUS: [number, number][] = [[10, 0.05], [15, 0.1], [20, 0.15], [25, 0.7]];
/** the share of the index rise that rides on the surrender value, by year (nothing before year 6) */
const SURRENDER_BONUS: Record<number, number> = {
  6: 0.01, 7: 0.02, 8: 0.03, 9: 0.04, 10: 0.05, 11: 0.06, 12: 0.07, 13: 0.08, 14: 0.09, 15: 0.1,
  16: 0.11, 17: 0.12, 18: 0.13, 19: 0.14, 20: 0.15, 21: 0.3, 22: 0.45, 23: 0.55, 24: 0.65, 25: 0.7,
};

/** the share of the index rise paid with the death benefit, by the year of death */
export function deathBonusShare(y: number): number {
  return y <= 1 ? 0 : y <= 10 ? 1 : y <= 15 ? 0.95 : y <= 20 ? 0.85 : 0.7;
}

/** the age the dearer (senior) rate and its own surrender row start at */
export const GS25_SENIOR_AGE = 66;
/** the entry ages the surrender rows below were read at */
export const GS25_SURR_AGES = [2, 30, 40, 50, 55, 60, 65, 66, 70, 75];
/** guaranteed surrender value, % of the sum, policy year 1–25 */
const SURR_BY_AGE: Record<number, number[]> = {
  2: [
    0.0, 0.0, 71.0, 170.7, 293.6, 301.3, 309.2, 317.4, 325.8, 334.5, 343.4, 352.6, 362.0,
    371.8, 381.8, 392.1, 402.7, 413.6, 424.9, 436.5, 448.4, 460.7, 473.4, 486.5, 501.0,
  ],
  30: [
    0.0, 0.0, 71.5, 171.3, 294.2, 301.9, 309.8, 317.9, 326.3, 334.9, 343.8, 352.9, 362.3,
    372.0, 382.0, 392.3, 402.9, 413.8, 425.0, 436.6, 448.5, 460.8, 473.5, 486.5, 501.0,
  ],
  40: [
    0.0, 2.3, 76.6, 176.9, 300.2, 307.6, 315.3, 323.2, 331.3, 339.6, 348.2, 357.0, 366.1,
    375.5, 385.1, 395.1, 405.3, 415.9, 426.8, 438.0, 449.6, 461.6, 474.0, 486.8, 501.0,
  ],
  50: [
    0.0, 7.4, 84.7, 185.9, 310.1, 317.4, 324.8, 332.5, 340.3, 348.4, 356.7, 365.1, 373.8,
    382.7, 391.8, 401.1, 410.8, 420.6, 430.8, 441.3, 452.2, 463.4, 475.1, 487.3, 501.0,
  ],
  55: [
    0.0, 12.7, 93.2, 195.4, 320.6, 327.7, 335.0, 342.5, 350.0, 357.8, 365.6, 373.7, 381.9,
    390.3, 398.8, 407.6, 416.5, 425.7, 435.1, 444.8, 454.9, 465.3, 476.3, 487.8, 501.0,
  ],
  60: [
    0.0, 21.5, 107.2, 211.1, 337.9, 344.8, 351.9, 359.0, 366.2, 373.4, 380.8, 388.2, 395.7,
    403.3, 411.0, 418.9, 426.9, 435.1, 443.5, 452.3, 461.5, 470.1, 479.3, 489.2, 501.0,
  ],
  65: [
    0.0, 31.4, 126.9, 233.2, 362.1, 368.7, 375.3, 381.9, 388.5, 395.1, 401.6, 408.2, 414.9,
    421.6, 428.4, 435.4, 441.4, 447.5, 453.7, 460.2, 467.0, 474.2, 482.0, 490.5, 501.0,
  ],
  66: [
    0.0, 41.0, 136.2, 240.8, 367.5, 374.0, 380.5, 387.0, 393.4, 399.8, 406.2, 412.7, 419.2,
    425.7, 432.4, 438.1, 443.9, 449.7, 455.7, 461.9, 468.4, 475.4, 482.8, 490.9, 501.0,
  ],
  70: [
    0.0, 64.2, 155.6, 261.9, 390.3, 396.2, 402.1, 408.0, 413.9, 419.7, 425.6, 430.7, 435.6,
    440.5, 445.4, 450.2, 455.1, 460.1, 465.1, 470.2, 475.3, 480.7, 486.5, 492.7, 501.0,
  ],
  // as printed: a value already in year 1, and year 24 above the maturity amount
  75: [
    17.1, 84.7, 179.8, 288.1, 418.5, 423.9, 428.7, 433.5, 438.1, 442.7, 447.2, 451.7, 456.2,
    460.6, 464.9, 469.0, 473.1, 477.2, 481.2, 485.3, 489.7, 494.5, 500.2, 507.2, 501.0,
  ],
};

/**
 * The guaranteed surrender value at the end of policy year `y`, as a share of the sum: the row
 * of the nearest table age at or below the entry age. No line is drawn between rows — the climb
 * to 65 comes mostly in the last ages before it (15/8's full table shows the shape), so a
 * straight line would overstate a guaranteed figure.
 */
export function surrenderPct(y: number, age: number): number {
  return SURR_BY_AGE[surrenderRowAge(age)][y - 1] / 100;
}

/** the table age a quote's surrender column is read from */
export function surrenderRowAge(age: number): number {
  let row = GS25_SURR_AGES[0];
  for (const a of GS25_SURR_AGES) if (age >= a) row = a;
  return row;
}

/** premium per 1,000 of sum: 995 from 100,000 and 990 from 500,000 up to age 65, 1,000 from 66 */
export function premiumRate(sa: number, age: number): number {
  if (age >= GS25_SENIOR_AGE) return 1000;
  return sa >= 500_000 ? 990 : sa >= 100_000 ? 995 : 1000;
}

export function premiumFromSa(sa: number, age: number): number {
  return sa * premiumRate(sa, age) / 1000;
}

/** the sum a yearly premium buys: the band whose rate puts the sum back inside that band */
export function saFromPremium(p: number, age: number): number {
  if (age >= GS25_SENIOR_AGE) return p;
  const bands: [number, number, number][] = [[990, 500_000, 1e15], [995, 100_000, 500_000], [1000, 0, 100_000]];
  for (const [r, lo, hi] of bands) {
    const s = p / (r / 1000);
    if (s >= lo - 0.5 && s < hi + 0.5) return s;
  }
  return p / (premiumRate(p, age) / 1000);
}

/** the death benefit as a multiple of the sum: nothing extra the first two years, 315%, 420%, then 535% */
function deathFactor(y: number): number {
  return y <= 2 ? 0 : y < GS25_PREM_YEARS ? 1.05 * y : GS25_PREM_YEARS + 0.35;
}

export interface Gs25Year {
  year: number;
  premium: number;
  /** premiums paid so far */
  paid: number;
  /** the cash paid back this year: 1% of the sum, or the maturity amount in the last year */
  payback: number;
  /** guaranteed death benefit: the larger of 102% of premiums paid and the year's multiple of the sum */
  death: number;
  /** the index share paid on top of the death benefit (not guaranteed) */
  deathBonus: number;
  /** guaranteed surrender value */
  surrender: number;
  /** the index share riding on the surrender value (not guaranteed) */
  surrenderBonus: number;
}

export interface Gs25Bonus { year: number; share: number; value: number }

export interface Gs25Scenario {
  /** the index's assumed yearly return, e.g. 0.03 */
  rate: number;
  rows: Gs25Year[];
  /** the yearly paybacks, years 1–24 */
  paybackTotal: number;
  maturity: number;
  bonuses: Gs25Bonus[];
  /** everything received when held to maturity */
  total: number;
  /** % a year */
  irr: number;
}

/** to two places, as the illustration prints every amount */
const satang = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function scenario(sa: number, premium: number, rate: number, age: number): Gs25Scenario {
  const PY = GS25_PREM_YEARS, T = GS25_TERM;
  const paid = (y: number) => Math.min(y, PY) * premium;
  /**
   * premiums paid × the index's rise (never below zero) × participation, before the payout share.
   * As the illustration works it: the index starts at 100 and its level is cut to four places.
   */
  const rise = (y: number) => {
    const level = Math.round(100 * Math.pow(1 + rate, y) * 1e4) / 1e4;
    return satang(paid(y) * Math.max(0, level / 100 - 1) * PARTICIPATION);
  };
  const rows: Gs25Year[] = [];
  for (let y = 1; y <= T; y++) {
    rows.push({
      year: y,
      premium: y <= PY ? premium : 0,
      paid: paid(y),
      payback: y < T ? PAYBACK_PCT * sa : MATURITY_PCT * sa,
      death: Math.max(1.02 * paid(y), deathFactor(y) * sa),
      deathBonus: satang(rise(y) * deathBonusShare(y)),
      surrender: surrenderPct(y, age) * sa,
      surrenderBonus: satang(rise(y) * (SURRENDER_BONUS[y] ?? 0)),
    });
  }
  const paybackTotal = (T - 1) * PAYBACK_PCT * sa;
  const maturity = MATURITY_PCT * sa;
  const bonuses = ALIVE_BONUS.map(([year, share]) => ({ year, share, value: satang(rise(year) * share) }));
  const total = paybackTotal + maturity + bonuses.reduce((s, b) => s + b.value, 0);
  const cf: [number, number][] = [];
  for (let t = 0; t < PY; t++) cf.push([t, -premium]);
  for (let y = 1; y < T; y++) cf.push([y, PAYBACK_PCT * sa]);
  cf.push([T, maturity]);
  for (const b of bonuses) if (b.value > 0) cf.push([b.year, b.value]);
  return { rate, rows, paybackTotal, maturity, bonuses, total, irr: irr(cf) * 100 };
}

/**
 * The index returns the page shows side by side, the five 15/8's page shows (owner, 2026-11-16).
 * The company's own illustration prints −1%, 3% and 5% (its examples 1, 2 and 3); 2% and 4% are
 * the same formula at a return it does not print.
 */
export const GS25_RATES = [-0.01, 0.02, 0.03, 0.04, 0.05];
/** the three of them the company's illustration prints */
export const GS25_PRINTED_RATES = [-0.01, 0.03, 0.05];

export interface Gs25Bank { rate: number; principal: number; interest: number; total: number }

/** the same premiums left in a bank at a compound rate until the plan would mature */
export function bankCompare(premium: number, rate: number): Gs25Bank {
  let total = 0;
  for (let t = 0; t < GS25_PREM_YEARS; t++) total += premium * Math.pow(1 + rate, GS25_TERM - t);
  const principal = GS25_PREM_YEARS * premium;
  return { rate, principal, interest: total - principal, total };
}

/** a savings account, and a fixed deposit at its better rate — the two 15/8's page shows */
export const GS25_BANK_RATES = [0.0025, 0.015];

export type Gs25Basis = "premium" | "sumAssured";

export interface Gs25Quote {
  sa: number;
  premium: number;
  age: number;
  scenarios: Gs25Scenario[];
  banks: Gs25Bank[];
  /** yearly paybacks + maturity, the same in every scenario: 525% of the sum */
  guaranteed: number;
  /** what stops the quote: a sum outside the plan's limits */
  warnings: string[];
  /** what the reader should know about a figure shown: an unconfirmed rate, a borrowed surrender row */
  notes: string[];
}

/** The page's one call: from a premium or a sum, every scenario. */
export function quoteGlobalSaving255({ basis, amount, age }: { basis: Gs25Basis; amount: number; age: number }): Gs25Quote {
  const premium = basis === "premium" ? amount : premiumFromSa(amount, age);
  const sa = basis === "premium" ? Math.ceil(saFromPremium(amount, age)) : amount;
  const scenarios = GS25_RATES.map((r) => scenario(sa, premium, r, age));
  const baht = (n: number) => n.toLocaleString("en-US");
  const warnings: string[] = [];
  const notes: string[] = [];
  if (sa > 0 && sa < GS25_MIN_SA) warnings.push(`ทุนขั้นต่ำ ${baht(GS25_MIN_SA)} บาท`);
  if (sa > GS25_MAX_SA) warnings.push(`ทุนสูงสุด ${baht(GS25_MAX_SA)} บาท`);
  if (age >= 71 && sa > 0 && sa < GS25_MIN_SA_FROM_71) {
    warnings.push(`อายุ 71 ปีขึ้นไป ทุนขั้นต่ำ ${baht(GS25_MIN_SA_FROM_71)} บาท`);
  }
  if (sa > 0 && sa < 100_000) {
    notes.push("อัตราเบี้ยที่ทุนต่ำกว่า 100,000 บาท ยังไม่ได้ยืนยันกับ AdvisorZone");
  }
  if (!GS25_SURR_AGES.includes(age)) {
    notes.push(`มูลค่าเวนคืนอ้างอิงจากตารางอายุ ${surrenderRowAge(age)} ปี อายุจริงอาจสูงกว่าเล็กน้อยในปีแรก ๆ`);
  }
  return {
    sa, premium, age, scenarios,
    banks: GS25_BANK_RATES.map((r) => bankCompare(premium, r)),
    guaranteed: scenarios[0].paybackTotal + scenarios[0].maturity,
    warnings, notes,
  };
}
