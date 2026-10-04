import { NUMBERS_PLANS } from "./numbers-plans";
import { money, type NumberSheet, type PricedPlan } from "./numbers";
import { lifelong } from "./wording";

/**
 * The premium table of a long-form ad (spec 2026-10-05): one row per rung of the plan's
 * ladder, a yearly figure per sex, every one from the plan's own engine. A model never writes
 * a premium. A rung the engine will not sell at this age is left out, and so is a sex it
 * will not sell to; a table with no row left is null, and the round is refused.
 */
export interface PremiumRow {
  heading: string;
  /** annual baht; null when the engine would not price a woman at this rung */
  female: number | null;
  male: number | null;
}

export interface PremiumTable {
  product: string;
  age: number;
  /** the term as the ad says it, ตลอดชีพ for 99 */
  term: string;
  /** the premium rises with age: the table says เบี้ยปีแรก */
  firstYear: boolean;
  rows: PremiumRow[];
}

const annualBaht = (s: NumberSheet | null) => (s ? s.annualSatang / 100 : null);
/** a premium to the satang when it has satang (9,483.50), whole baht otherwise, as the engines say it */
const baht = (n: number) => (Number.isInteger(n) ? money(n) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** ตกเดือนละ: the yearly premium ÷ 12, rounded up, the way ตกวันละ is ÷ 365 */
const perMonth = (annual: number) => money(Math.ceil(annual / 12));

/** a plan's table for an age; the href lookup is premiumTable's, so a stub plan can be tried */
export function premiumTableOf(plan: PricedPlan, age: number, today: Date): PremiumTable | null {
  const ladder = plan.ladder;
  if (!ladder) return null;
  const rows: PremiumRow[] = [];
  for (let r = 0; r < ladder.rungs; r++) {
    const f = ladder.price(r, "F", age, today);
    const m = ladder.price(r, "M", age, today);
    const head = f ?? m;
    if (!head) continue;
    rows.push({ heading: lifelong(head.sumLine), female: annualBaht(f), male: annualBaht(m) });
  }
  if (rows.length === 0) return null;
  return { product: plan.product, age, term: lifelong(ladder.term), firstYear: ladder.firstYear, rows };
}

export function premiumTable(href: string, age: number, today: Date = new Date()): PremiumTable | null {
  const plan = NUMBERS_PLANS[href];
  return plan ? premiumTableOf(plan, age, today) : null;
}

/** The exact lines of the ad's table block: the term, then a block per row. */
export function tableText(t: PremiumTable): string {
  const head = `${t.firstYear ? "เบี้ยปีแรก " : ""}${t.term} (อายุ ${t.age} ปี)`;
  const blocks = t.rows.map((r) =>
    [
      r.heading,
      ...(r.female === null ? [] : [`🙆‍♀️ หญิง = ${baht(r.female)} บาท/ปี (ตกเดือนละ ${perMonth(r.female)})`]),
      ...(r.male === null ? [] : [`🕵️‍♂️ ชาย = ${baht(r.male)} บาท/ปี (ตกเดือนละ ${perMonth(r.male)})`]),
    ].join("\n"),
  );
  return [head, ...blocks].join("\n\n");
}

/** Two lines for the writer and the poster: the middle row's sum and its premium, a woman's first. */
export function headlineFigures(t: PremiumTable): string {
  const row = t.rows[Math.floor((t.rows.length - 1) / 2)];
  const annual = row.female ?? row.male;
  if (annual === null) return row.heading;
  return `${row.heading}\n${t.firstYear ? "เบี้ยปีแรก" : "เบี้ย"} ${baht(annual)} บาท/ปี (ตกเดือนละ ${perMonth(annual)})`;
}
