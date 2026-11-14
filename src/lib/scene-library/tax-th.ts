/**
 * The Thai personal income tax table the tax devices (taxback, taxcap) draw from: the only place in the app
 * these figures live (spec 2026-11-14-devices-life-tax-design.md, owner "3ก": entered as current law, shown to
 * the owner as a table before the push). Browser-safe: constants and one sum.
 */

export const TAX_YEAR = "ปีภาษี 2569";
const YEAR = 2569;

/** the brackets on net income, baht; `to` null is "and above"; rate in percent */
export const TAX_BRACKETS: { from: number; to: number | null; rate: number }[] = [
  { from: 0, to: 150_000, rate: 0 },
  { from: 150_001, to: 300_000, rate: 5 },
  { from: 300_001, to: 500_000, rate: 10 },
  { from: 500_001, to: 750_000, rate: 15 },
  { from: 750_001, to: 1_000_000, rate: 20 },
  { from: 1_000_001, to: 2_000_000, rate: 25 },
  { from: 2_000_001, to: 5_000_000, rate: 30 },
  { from: 5_000_001, to: null, rate: 35 },
];

/** the rates a taxback bracket may be: every bracket's but the exempt one */
export const TAX_RATES: number[] = TAX_BRACKETS.map((b) => b.rate).filter((r) => r > 0);
export const isTaxRate = (n: unknown): n is number => typeof n === "number" && TAX_RATES.includes(n);

/** deduction caps, baht */
export const LIFE_CAP = 100_000;
export const HEALTH_SELF_CAP = 25_000;
/** own health premium with the life premium together */
export const HEALTH_WITH_LIFE_CAP = 100_000;
export const HEALTH_PARENTS_CAP = 15_000;
/** the pension premium: this percent of income, at most PENSION_CAP, and with other retirement funds at most PENSION_RETIRE_CAP */
export const PENSION_PERCENT = 15;
export const PENSION_CAP = 200_000;
export const PENSION_RETIRE_CAP = 500_000;

const baht = (v: number) => v.toLocaleString("en-US");

/** the caps as the taxcap device draws them, one row each */
export const TAX_CAPS: { label: string; cap: number; note?: string }[] = [
  { label: "เบี้ยประกันชีวิต (กรมธรรม์ 10 ปีขึ้นไป)", cap: LIFE_CAP },
  { label: "เบี้ยประกันสุขภาพตนเอง", cap: HEALTH_SELF_CAP, note: `รวมกับประกันชีวิตไม่เกิน ${baht(HEALTH_WITH_LIFE_CAP)}` },
  { label: "เบี้ยประกันสุขภาพพ่อแม่", cap: HEALTH_PARENTS_CAP },
  {
    label: "เบี้ยประกันชีวิตแบบบำนาญ", cap: PENSION_CAP,
    note: `${PENSION_PERCENT}% ของเงินได้ ไม่เกิน ${baht(PENSION_CAP)} (รวมกับกองทุนเพื่อการเกษียณอื่นไม่เกิน ${baht(PENSION_RETIRE_CAP)})`,
  },
];

/** the line under every tax device */
export const TAX_FOOT = "ตามเกณฑ์กรมสรรพากร ตรวจสอบเงื่อนไขก่อนใช้สิทธิ";

/** every figure of the table: taxcap's words may say these as the brief's own (check.ts) */
export const TAX_FIGURES: ReadonlySet<number> = new Set([
  YEAR,
  ...TAX_BRACKETS.flatMap((b) => [b.from, ...(b.to === null ? [] : [b.to]), b.rate]).filter((v) => v > 0),
  LIFE_CAP, HEALTH_SELF_CAP, HEALTH_WITH_LIFE_CAP, HEALTH_PARENTS_CAP, PENSION_PERCENT, PENSION_CAP, PENSION_RETIRE_CAP,
  // "กรมธรรม์ 10 ปีขึ้นไป"
  10,
]);

/**
 * the figures taxback's words may say beside the brief's: the year, the life cap and the bracket thresholds. Not
 * the other caps or the rates: 15,000 and 25,000 are what common premiums give back (50,000 at 30%, 100,000 at
 * 15% or 25%), and a refund is the drawer's sum, never a figure the AI writes.
 */
export const TAXBACK_FIGURES: ReadonlySet<number> = new Set([
  YEAR, LIFE_CAP,
  ...TAX_BRACKETS.flatMap((b) => [b.from, ...(b.to === null ? [] : [b.to])]).filter((v) => v > 0),
]);

/** the tax a life premium gives back at a rate: the premium, at most LIFE_CAP, times the rate, to the baht */
export const refundAt = (premium: number, rate: number): number => Math.round((Math.min(Math.max(0, premium), LIFE_CAP) * rate) / 100);
