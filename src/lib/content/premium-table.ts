import { personPhrases, premiumAmounts, sameFigures, strayNumbers } from "./check";
import { EXPAT_NUMBERS_PLANS, NUMBERS_PLANS } from "./numbers-plans";
import { money, sexWord, sexWordEn, type NumberSheet, type PricedPlan } from "./numbers";
import type { Lang } from "./output";
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
  /**
   * "en": the English table of an Expat Page's campaign (spec 2026-10-06) — the same figures,
   * said in English. Absent on a Thai table, which is as it always was.
   */
  lang?: "en";
}

const annualBaht = (s: NumberSheet | null) => (s ? s.annualSatang / 100 : null);
/** a premium to the satang when it has satang (9,483.50), whole baht otherwise, as the engines say it */
const baht = (n: number) => (Number.isInteger(n) ? money(n) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** ตกเดือนละ: the yearly premium ÷ 12, rounded up, the way ตกวันละ is ÷ 365 */
const perMonth = (annual: number) => money(Math.ceil(annual / 12));
/** an English premium: "19,415 THB", "2,176.29 THB" */
const thb = (n: number) => `${baht(n)} THB`;
/** the English year's premium and its month, as a cell and the headline say them */
const yearEn = (annual: number) => `${thb(annual)}/yr (about ${perMonth(annual)} a month)`;
/**
 * one money format in an English ad (spec 2026-10-06): the sheet's "THB 25,000,000" said as the
 * cells say it, "25,000,000 THB". Only the ad table's text: the sheets, and Organic's English
 * posts built from them, keep their own wording.
 */
export const thbAfter = (s: string) => s.replace(/\bTHB\s?(\d[\d,]*(?:\.\d+)?)/g, "$1 THB");
/** the plans a language's tables come from: the English ones only for an English table */
const plansOf = (lang: Lang) => (lang === "en" ? EXPAT_NUMBERS_PLANS : NUMBERS_PLANS);

/**
 * a plan's table for an age; the href lookup is premiumTable's, so a stub plan can be tried.
 * `lang` "en": the plan is an English one (EXPAT_NUMBERS_PLANS), whose words are kept as written —
 * ตลอดชีพ is Thai wording.
 */
export function premiumTableOf(plan: PricedPlan, age: number, today: Date, lang: Lang = "th"): PremiumTable | null {
  const ladder = plan.ladder;
  const en = lang === "en";
  const said = (t: string) => (en ? thbAfter(t) : lifelong(t));
  if (!ladder) return null;
  const rows: PremiumRow[] = [];
  for (let r = 0; r < ladder.rungs; r++) {
    const f = ladder.price(r, "F", age, today);
    const m = ladder.price(r, "M", age, today);
    const head = f ?? m;
    if (!head) continue;
    rows.push({ heading: said(head.sumLine), ...(head.sumNote ? { note: said(head.sumNote) } : {}), female: annualBaht(f), male: annualBaht(m) });
  }
  if (rows.length === 0) return null;
  return {
    product: plan.product, age, term: said(ladder.term), firstYear: ladder.firstYear,
    ...(ladder.note ? { note: said(ladder.note) } : {}),
    rows,
    ...(en ? { lang: "en" as const } : {}),
  };
}

/** `lang` "en": the plan's English table (campaignLang), from the English plans; Thai otherwise */
export function premiumTable(href: string, age: number, today: Date = new Date(), lang: Lang = "th"): PremiumTable | null {
  const plan = plansOf(lang)[href];
  return plan ? premiumTableOf(plan, age, today, lang) : null;
}

/** whether the plan has a premium table at all in that language — without one, no age can be tried */
export function hasLadder(href: string, lang: Lang = "th"): boolean {
  return Boolean(plansOf(lang)[href]?.ladder);
}

/** The exact lines of the ad's table block: the term (and the package's note), then a block per row. */
export function tableText(t: PremiumTable): string {
  if (t.lang === "en") return tableTextEn(t);
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

/** tableText in English: "First-year premium · renewable up to age 98 (age 30)", then a block per row */
function tableTextEn(t: PremiumTable): string {
  const head = [`${t.firstYear ? `First-year premium · ${t.term}` : capital(t.term)} (age ${t.age})`, ...(t.note ? [`(${t.note})`] : [])].join("\n");
  const blocks = t.rows.map((r) =>
    [
      r.heading,
      ...(r.note ? [`(${r.note})`] : []),
      ...(r.female === null ? [] : [`🙆‍♀️ Female = ${yearEn(r.female)}`]),
      ...(r.male === null ? [] : [`🕵️‍♂️ Male = ${yearEn(r.male)}`]),
    ].join("\n"),
  );
  return [head, ...blocks].join("\n\n");
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The row and sex the ad's headline is about, as the owner picks them on the writing form. */
export interface HeadlinePick {
  sex: "F" | "M";
  /** an index into the table's rows */
  rung: number;
}

/** the middle row: the headline's row when none is picked, or one off the table */
export const middleRung = (rows: number) => Math.floor((rows - 1) / 2);

/**
 * The pick settled against the table: a rung off it is the middle row; a sex the row is not
 * priced for gives way to the other, which the headline then names.
 */
function settle(t: PremiumTable, pick?: Partial<HeadlinePick>) {
  const r = pick?.rung;
  const rung = typeof r === "number" && Number.isInteger(r) && r >= 0 && r < t.rows.length ? r : middleRung(t.rows.length);
  const row = t.rows[rung];
  const want = pick?.sex === "M" ? "M" : "F";
  const priced = (s: "F" | "M") => (s === "F" ? row.female : row.male) !== null;
  const other = want === "F" ? "M" : "F";
  const sex: "F" | "M" | null = priced(want) ? want : priced(other) ? other : null;
  return { rung, row, sex, annual: sex === "F" ? row.female : sex === "M" ? row.male : null };
}

/**
 * The ad's headline figures, for the writer to read and the code to place: the product, then the
 * picked row's sum (the middle one by default) with its note (the condition on a doubled cover,
 * what a package includes), then its premium for the picked sex (a woman by default), with whose
 * premium it is.
 */
export function headlineFigures(t: PremiumTable, pick?: Partial<HeadlinePick>): string {
  const { row, sex, annual } = settle(t, pick);
  const note = [row.note, t.note].filter(Boolean).join(" · ");
  const sum = `💁‍♀️ ${row.heading}${note ? ` (${note})` : ""}`;
  if (sex === null || annual === null) return [t.product, sum].join("\n");
  if (t.lang === "en") {
    return [t.product, sum, `💰 ${t.firstYear ? "First-year premium" : "Premium"} ${yearEn(annual)} (${sexWordEn(sex)}, ${t.age})`].join("\n");
  }
  const premium = `💰 ${t.firstYear ? "เบี้ยปีแรก" : "เบี้ย"} ${baht(annual)} บาท/ปี (ตกเดือนละ ${perMonth(annual)}) (${sexWord(sex)} อายุ ${t.age} ปี)`;
  return [t.product, sum, premium].join("\n");
}

/**
 * Whose ad it is, as the headline settles it: the writer is told this (spec 2026-10-05) so its
 * words cannot name another age, sex or sum than the figures the code places under them.
 */
export function headlineOwner(t: PremiumTable, pick?: Partial<HeadlinePick>): { sex: "F" | "M"; rung: number; heading: string; line: string } {
  const { rung, row, sex } = settle(t, pick);
  const shown = sex ?? (pick?.sex === "M" ? "M" : "F");
  const note = [row.note, t.note].filter(Boolean).join(" · ");
  const who = t.lang === "en" ? `${sexWordEn(shown)}, ${t.age}` : `${sexWord(shown)} อายุ ${t.age} ปี`;
  return { sex: shown, rung, heading: row.heading, line: `${who} · ${row.heading}${note ? ` (${note})` : ""}` };
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
 * amount neither the brief nor the table's sums have, any premium of the table restated, and any
 * amount said as a premium at all — "วันละ 48 บาท" copied from the brief's sample cases is as
 * wrong beside the code's table as one made up (the 2026-10-05 ad). The writer is told the table
 * but must not say a premium (spec "Keeping figures true"). Checked once, when the ad is written;
 * an edit later is checked against the brief and every line the code placed.
 */
export function restatedFigures(modelText: string, brief: string, t: PremiumTable): string[] {
  return [...new Set([
    ...strayNumbers(modelText, `${brief}\n${tableSums(t)}`),
    ...sameFigures(modelText, tableCells(t)),
    // an English table's writer is held to the English premium phrases (check.ts)
    ...premiumAmounts(modelText, t.lang ?? "th"),
  ])];
}

/**
 * The people in what the model itself wrote whose sex or age is not the ad's (personPhrases): its
 * words must be about the person the headline prices (headlineOwner), never "ผู้หญิงอายุ 35"
 * beside a man's premium (the 2026-10-05 ad). Checked with restatedFigures, once, when the ad is written.
 */
export function otherPeople(modelText: string, sex: "F" | "M", age: number, lang: Lang = "th"): string[] {
  return [...new Set(personPhrases(modelText, lang).filter((p) => p.sex !== sex || p.age !== age).map((p) => p.phrase))];
}
