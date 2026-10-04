import { sameFigures, strayNumbers } from "./check";
import { NUMBERS_PLANS } from "./numbers-plans";
import { money, sexWord, type NumberSheet, type PricedPlan } from "./numbers";
import { lifelong } from "./wording";

/**
 * The premium table of a long-form ad (spec 2026-10-05): one row per rung of the plan's
 * ladder, a yearly figure per sex, every one from the plan's own engine. A model never writes
 * a premium. A rung the engine will not sell at this age is left out, and so is a sex it
 * will not sell to; a table with no row left is null, and the round is refused.
 */
export interface PremiumRow {
  heading: string;
  /**
   * how the heading's sum is reached, or what the price includes — the sheet's sumNote, in
   * brackets under the heading: Life Protect's doubled cover holds only for a death before the
   * booster age, and a set's price is the whole package's
   */
  note?: string;
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
  /** what every price includes, for a package whose sheets do not say it (the ladder's note) */
  note?: string;
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
    rows.push({ heading: lifelong(head.sumLine), ...(head.sumNote ? { note: lifelong(head.sumNote) } : {}), female: annualBaht(f), male: annualBaht(m) });
  }
  if (rows.length === 0) return null;
  return {
    product: plan.product, age, term: lifelong(ladder.term), firstYear: ladder.firstYear,
    ...(ladder.note ? { note: lifelong(ladder.note) } : {}),
    rows,
  };
}

export function premiumTable(href: string, age: number, today: Date = new Date()): PremiumTable | null {
  const plan = NUMBERS_PLANS[href];
  return plan ? premiumTableOf(plan, age, today) : null;
}

/** whether the plan has a premium table at all — without one, no age can be tried */
export function hasLadder(href: string): boolean {
  return Boolean(NUMBERS_PLANS[href]?.ladder);
}

/** The exact lines of the ad's table block: the term (and the package's note), then a block per row. */
export function tableText(t: PremiumTable): string {
  const head = [`${t.firstYear ? "เบี้ยปีแรก " : ""}${t.term} (อายุ ${t.age} ปี)`, ...(t.note ? [`(${t.note})`] : [])].join("\n");
  const blocks = t.rows.map((r) =>
    [
      r.heading,
      ...(r.note ? [`(${r.note})`] : []),
      ...(r.female === null ? [] : [`🙆‍♀️ หญิง = ${baht(r.female)} บาท/ปี (ตกเดือนละ ${perMonth(r.female)})`]),
      ...(r.male === null ? [] : [`🕵️‍♂️ ชาย = ${baht(r.male)} บาท/ปี (ตกเดือนละ ${perMonth(r.male)})`]),
    ].join("\n"),
  );
  return [head, ...blocks].join("\n\n");
}

/**
 * The ad's headline figures, for the writer to read and the code to place: the product, then the
 * middle row's sum with its note (the condition on a doubled cover, what a package includes),
 * then its premium, a woman's first, with whose premium it is.
 */
export function headlineFigures(t: PremiumTable): string {
  const row = t.rows[Math.floor((t.rows.length - 1) / 2)];
  const note = [row.note, t.note].filter(Boolean).join(" · ");
  const sum = `💁‍♀️ ${row.heading}${note ? ` (${note})` : ""}`;
  const sex = row.female !== null ? "F" : row.male !== null ? "M" : null;
  const annual = sex === "F" ? row.female : row.male;
  if (sex === null || annual === null) return [t.product, sum].join("\n");
  const premium = `💰 ${t.firstYear ? "เบี้ยปีแรก" : "เบี้ย"} ${baht(annual)} บาท/ปี (ตกเดือนละ ${perMonth(annual)}) (${sexWord(sex)} อายุ ${t.age} ปี)`;
  return [t.product, sum, premium].join("\n");
}

/** Every premium the table prints, yearly and ตกเดือนละ, as values. */
export function tableCells(t: PremiumTable): number[] {
  return t.rows.flatMap((r) => [r.female, r.male].flatMap((a) => (a === null ? [] : [a, Math.ceil(a / 12)])));
}

/**
 * Every line of the table but its premiums: the term, the package note, each row's heading and
 * note. The sums the writer is shown and may name — "คุ้มครอง 4 ล้าน" is the doubled cover a
 * Life Protect row heads with, though its brief says only the plain sums.
 */
export function tableSums(t: PremiumTable): string {
  return [t.term, t.note ?? "", ...t.rows.flatMap((r) => [r.heading, r.note ?? ""])].filter(Boolean).join("\n");
}

/**
 * The figures in what the model itself wrote (never the code's lines) that it may not write: any
 * amount neither the brief nor the table's sums have, and any premium of the table restated — the
 * writer is told the table but must not say a premium (spec "Keeping figures true"). Checked once,
 * when the ad is written; an edit later is checked against the brief and every line the code placed.
 */
export function restatedFigures(modelText: string, brief: string, t: PremiumTable): string[] {
  return [...new Set([...strayNumbers(modelText, `${brief}\n${tableSums(t)}`), ...sameFigures(modelText, tableCells(t))])];
}
