/**
 * Global Savings Plus 15/8 (Index Linked), Krungthai-AXA plan code E15G8A — an endowment that
 * pays 1% of the sum every year, 801% at maturity, and an index bonus at the end of year 10
 * and at maturity that is not guaranteed.
 *
 * Ported line for line from the owner's own calculator (the standalone build kept in
 * `รอ/global-saving/data.js`, itself a port of its React `engine.ts` + `surr158.ts`). The
 * figures it was checked against there are pinned in tests/calc/global-saving.test.ts, so a
 * change here that moves a number shows up as a failing test, not a quiet difference on the page.
 */

export const GS_TERM = 15;
export const GS_PREM_YEARS = 8;
export const GS_CODE = "E15G8A";
export const GS_AGE_MIN = 0;
export const GS_AGE_MAX = 75;
export const GS_MIN_PREMIUM = 20_000;
export const GS_MAX_PREMIUM = 20_000_000;
/** the sum assured floor from age 71 */
export const GS_MIN_SA_FROM_71 = 200_000;
/** what the Revenue Department allows off income for life premiums, all policies together */
export const GS_TAX_CAP = 100_000;

const PAYBACK_PCT = 0.01;
const MATURITY_PCT = 8.01;
/** the participation rate in the index's rise */
const PARTICIPATION = 0.9;
/** the index bonus paid while alive: [end of year, share of the rise] */
const ALIVE_BONUS: [number, number][] = [[10, 0.3], [15, 0.7]];
/** the share of the index rise that rides on the surrender value, by year */
const SURRENDER_BONUS: Record<number, number> = { 9: 0.2, 10: 0.3, 11: 0.4, 12: 0.5, 13: 0.6, 14: 0.65, 15: 0.7 };

/** guaranteed surrender value, % of the sum, by entry age (rows) and policy year 1–15 */
const SURR_AGES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 66, 70, 71, 75];
const SURR_BY_AGE: Record<number, number[]> = {
  0: [0.0, 11.0, 93.9, 197.2, 323.8, 431.7, 542.8, 657.2, 675.9, 695.1, 714.8, 735.2, 756.2, 777.8, 801.0],
  5: [0.0, 11.1, 94.1, 197.3, 324.0, 431.9, 543.0, 657.4, 676.0, 695.2, 714.9, 735.2, 756.2, 777.8, 801.0],
  10: [0.0, 11.3, 94.4, 197.7, 324.4, 432.2, 543.2, 657.6, 676.1, 695.3, 715.0, 735.3, 756.2, 777.8, 801.0],
  15: [0.0, 11.5, 94.7, 197.9, 324.6, 432.3, 543.3, 657.7, 676.2, 695.3, 715.0, 735.3, 756.2, 777.8, 801.0],
  20: [0.0, 11.6, 94.8, 198.1, 324.7, 432.4, 543.4, 657.7, 676.2, 695.3, 715.0, 735.3, 756.2, 777.8, 801.0],
  25: [0.0, 11.7, 95.0, 198.2, 324.8, 432.6, 543.5, 657.8, 676.4, 695.4, 715.1, 735.3, 756.2, 777.8, 801.0],
  30: [0.0, 11.9, 95.3, 198.6, 325.2, 432.9, 543.8, 658.1, 676.5, 695.6, 715.2, 735.4, 756.3, 777.8, 801.0],
  35: [0.0, 12.3, 95.8, 199.1, 325.7, 433.4, 544.2, 658.4, 676.8, 695.8, 715.4, 735.5, 756.3, 777.8, 801.0],
  40: [0.0, 12.8, 96.6, 199.9, 326.5, 434.1, 544.9, 659.0, 677.2, 696.1, 715.6, 735.7, 756.4, 777.9, 801.0],
  45: [0.0, 13.5, 97.7, 201.1, 327.7, 435.2, 545.8, 659.7, 677.9, 696.6, 716.0, 735.9, 756.6, 777.9, 801.0],
  50: [0.0, 14.8, 99.6, 203.1, 329.8, 437.0, 547.4, 661.1, 679.1, 697.6, 716.7, 736.4, 756.9, 778.0, 801.0],
  55: [0.0, 17.0, 102.9, 206.7, 333.5, 440.4, 550.4, 663.7, 681.2, 699.3, 718.0, 737.3, 757.4, 778.2, 801.0],
  60: [0.0, 20.8, 108.8, 212.9, 340.0, 446.3, 555.7, 668.2, 685.0, 702.3, 720.3, 738.9, 758.3, 778.6, 801.0],
  65: [0.0, 26.0, 118.7, 223.5, 350.9, 456.2, 564.5, 675.8, 691.3, 707.3, 724.0, 741.4, 759.8, 779.2, 801.0],
  66: [0.0, 33.2, 125.8, 228.7, 353.7, 458.8, 566.7, 677.7, 692.9, 708.6, 724.9, 742.0, 760.1, 779.4, 801.0],
  70: [0.0, 50.4, 139.2, 242.6, 368.0, 471.9, 578.5, 688.1, 701.8, 716.1, 731.2, 746.4, 762.7, 780.5, 801.0],
  71: [0.0, 53.8, 143.0, 246.7, 372.2, 475.7, 581.9, 691.1, 704.5, 718.5, 732.4, 747.3, 763.2, 780.7, 801.0],
  75: [3.0, 68.2, 159.6, 264.0, 390.1, 492.5, 596.5, 703.5, 714.4, 725.9, 738.1, 751.3, 765.7, 781.8, 801.0],
};

/** the guaranteed surrender value at the end of policy year `y`, as a share of the sum, between table ages by straight line */
export function surrenderPct(y: number, age: number): number {
  const A = SURR_AGES;
  const a = Math.max(A[0], Math.min(A[A.length - 1], age));
  if (a <= A[0]) return SURR_BY_AGE[A[0]][y - 1] / 100;
  for (let i = 1; i < A.length; i++) {
    if (a <= A[i]) {
      const lo = A[i - 1], hi = A[i];
      const vlo = SURR_BY_AGE[lo][y - 1], vhi = SURR_BY_AGE[hi][y - 1];
      return (vlo + (vhi - vlo) * (a - lo) / (hi - lo)) / 100;
    }
  }
  return SURR_BY_AGE[A[A.length - 1]][y - 1] / 100;
}

/** premium per 1,000 of sum: cheaper from 100,000 and again from 500,000, five baht dearer from 66 */
export function premiumRate(sa: number, age: number): number {
  const base = sa >= 500_000 ? 989 : sa >= 100_000 ? 994 : 999;
  return age >= 66 ? Math.min(base + 5, 999) : base;
}

export function premiumFromSa(sa: number, age: number): number {
  return sa * premiumRate(sa, age) / 1000;
}

/** the sum a yearly premium buys: the band whose rate puts the sum back inside that band */
export function saFromPremium(p: number, age: number): number {
  const bands: [number, number, number][] = age >= 66
    ? [[994, 500_000, 1e15], [999, 100_000, 500_000], [999, 0, 100_000]]
    : [[989, 500_000, 1e15], [994, 100_000, 500_000], [999, 0, 100_000]];
  for (const [r, lo, hi] of bands) {
    const s = p / (r / 1000);
    if (s >= lo - 0.5 && s < hi + 0.5) return s;
  }
  return p / (premiumRate(p, age) / 1000);
}

/** the death benefit as a multiple of the sum: nothing extra the first two years, then 1.05× the years paid, then capped */
function deathFactor(y: number): number {
  return y <= 2 ? 0 : y < GS_PREM_YEARS ? 1.05 * y : GS_PREM_YEARS + 0.35;
}

export interface GsYear {
  year: number;
  premium: number;
  /** premiums paid so far */
  paid: number;
  /** the cash paid back this year: 1% of the sum, or the maturity amount in the last year */
  payback: number;
  death: number;
  /** guaranteed surrender value */
  surrender: number;
  /** the index share riding on the surrender value (not guaranteed) */
  surrenderBonus: number;
}

export interface GsBonus { year: number; share: number; value: number }

export interface GsScenario {
  /** the index's assumed yearly return, e.g. 0.03 */
  rate: number;
  rows: GsYear[];
  /** the yearly paybacks, years 1–14 */
  paybackTotal: number;
  maturity: number;
  bonuses: GsBonus[];
  /** everything received when held to maturity */
  total: number;
  /** % a year */
  irr: number;
}

/** Bisection on NPV, as the source does it: cash flows are [year, amount]. */
export function irr(cfs: [number, number][]): number {
  let lo = -0.6, hi = 1.5;
  const npv = (x: number) => cfs.reduce((s, [t, c]) => s + c / Math.pow(1 + x, t), 0);
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2;
    if (npv(m) > 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

export function scenario(sa: number, premium: number, rate: number, age: number): GsScenario {
  const PY = GS_PREM_YEARS, T = GS_TERM;
  const paid = (y: number) => Math.min(y, PY) * premium;
  const idx = (y: number) => Math.pow(1 + rate, y);
  const rows: GsYear[] = [];
  for (let y = 1; y <= T; y++) {
    rows.push({
      year: y,
      premium: y <= PY ? premium : 0,
      paid: paid(y),
      payback: y < T ? PAYBACK_PCT * sa : MATURITY_PCT * sa,
      death: Math.max(1.02 * paid(y), deathFactor(y) * sa),
      surrender: surrenderPct(y, age) * sa,
      surrenderBonus: paid(y) * Math.max(0, idx(y) - 1) * PARTICIPATION * (SURRENDER_BONUS[y] ?? 0),
    });
  }
  const paybackTotal = (T - 1) * PAYBACK_PCT * sa;
  const maturity = MATURITY_PCT * sa;
  const bonuses = ALIVE_BONUS.map(([year, share]) => ({
    year, share, value: paid(PY) * Math.max(0, idx(year) - 1) * PARTICIPATION * share,
  }));
  const total = paybackTotal + maturity + bonuses.reduce((s, b) => s + b.value, 0);
  const cf: [number, number][] = [];
  for (let t = 0; t < PY; t++) cf.push([t, -premium]);
  for (let y = 1; y < T; y++) cf.push([y, PAYBACK_PCT * sa]);
  cf.push([T, maturity]);
  for (const b of bonuses) if (b.value > 0) cf.push([b.year, b.value]);
  return { rate, rows, paybackTotal, maturity, bonuses, total, irr: irr(cf) * 100 };
}

/** the index returns the page shows side by side, as the company's own illustration does */
export const GS_RATES = [-0.01, 0.02, 0.03, 0.04, 0.05];

export interface GsBank { rate: number; principal: number; interest: number; total: number }

/** the same premiums left in a bank at a compound rate until the plan would mature */
export function bankCompare(premium: number, rate: number): GsBank {
  let total = 0;
  for (let t = 0; t < GS_PREM_YEARS; t++) total += premium * Math.pow(1 + rate, GS_TERM - t);
  const principal = GS_PREM_YEARS * premium;
  return { rate, principal, interest: total - principal, total };
}

/** a savings account, and a fixed deposit at its better rate */
export const GS_BANK_RATES = [0.0025, 0.015];

export type GsBasis = "premium" | "sumAssured";

export interface GsQuote {
  sa: number;
  premium: number;
  age: number;
  scenarios: GsScenario[];
  banks: GsBank[];
  /** yearly paybacks + maturity, the same in every scenario */
  guaranteed: number;
  warnings: string[];
}

/** The page's one call: from a premium or a sum, every scenario and both bank columns. */
export function quoteGlobalSaving({ basis, amount, age }: { basis: GsBasis; amount: number; age: number }): GsQuote {
  const premium = basis === "premium" ? amount : premiumFromSa(amount, age);
  const sa = basis === "premium" ? Math.ceil(saFromPremium(amount, age)) : amount;
  const scenarios = GS_RATES.map((r) => scenario(sa, premium, r, age));
  const warnings: string[] = [];
  if (premium > 0 && premium < GS_MIN_PREMIUM) {
    warnings.push(`เบี้ยขั้นต่ำ ${GS_MIN_PREMIUM.toLocaleString("en-US")} บาท/ปี`);
  }
  if (premium > GS_MAX_PREMIUM) {
    warnings.push(`เบี้ยต่อปีสูงสุด ${GS_MAX_PREMIUM.toLocaleString("en-US")} บาท`);
  }
  if (age >= 71 && sa > 0 && sa < GS_MIN_SA_FROM_71) {
    const floor = Math.ceil(premiumFromSa(GS_MIN_SA_FROM_71, age));
    warnings.push(`อายุ 71 ปีขึ้นไป ทุนขั้นต่ำ ${GS_MIN_SA_FROM_71.toLocaleString("en-US")} บาท (เบี้ยอย่างน้อย ${floor.toLocaleString("en-US")} บาท/ปี)`);
  }
  return {
    sa, premium, age, scenarios,
    banks: GS_BANK_RATES.map((r) => bankCompare(premium, r)),
    guaranteed: scenarios[0].paybackTotal + scenarios[0].maturity,
    warnings,
  };
}
