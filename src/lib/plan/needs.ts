import {
  CHILD_SUPPORTED_UNTIL, CI_YEARS_OF_INCOME, DEFAULT_BUDGET_SHARE, EDUCATION_PER_CHILD, FUNERAL, HEALTH_TIERS,
  HOSPITAL_TIER, LIFE_DOUBLE_BEFORE_AGE, LIFE_EXPECTANCY, LIFE_SUMS, LUMP_LASTS_TO_AGE, PENSION_FROM_AGE, PLANNER_AGE,
  RETIRE_AGES, RETIRE_SHARE_OF_EXPENSE, YEARS_FOR_OTHER_DEPENDANTS, type Hospital, type LifeWant, type RetireAge,
} from "./assumptions";

/**
 * What a customer tells the planner, and the need in each area worked out from it.
 * Pure: no rate tables and no I/O, so every figure here is testable to the baht.
 * All money is baht; income and expense are a month, premiumsNow a year.
 */

export type Sex = "M" | "F";
export type HealthNow = "none" | "public" | "employer" | "private";

export interface PlanInput {
  age: number;
  sex: Sex;
  income: number;
  /** the part of the family's monthly spending this person pays */
  expense: number;
  savings: number;
  /** each child's age */
  children: number[];
  /** parents or a spouse who live on this income */
  otherDependants: boolean;
  debts: number;
  lifeCover: number;
  ciCover: number;
  healthNow: HealthNow;
  /** the room a day the customer's own health policy pays; read only when healthNow is "private" */
  healthRoom: number;
  premiumsNow: number;
  hospital: Hospital;
  /** cheap high cover, or cover that saves */
  lifeWant: LifeWant;
  /** the age the customer wants to stop work; the pension starts then or at the next age the plan issues */
  retireAge: RetireAge;
  /** baht a month wanted after retiring */
  retireMonthly: number;
  /** baht a month already coming: a civil-service or social-security pension, pension policies */
  pensionHave: number;
  /** baht kept for retirement (PVD, RMF, savings for it) — not the savings the life need counts */
  retireLump: number;
  /** the age the lump sum must last to; LUMP_LASTS_TO_AGE when absent */
  lifeExpectancy?: number;
  /** baht a month the customer will add */
  budget: number;
}

const MAX_MONEY = 1_000_000_000;
const HEALTH_NOW: HealthNow[] = ["none", "public", "employer", "private"];
const HOSPITALS: Hospital[] = ["public", "private", "premium"];

function money(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_MONEY) : 0;
}

/** The form's values made safe, or the sentence to show when they cannot be. */
export function cleanInput(raw: unknown): PlanInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const age = Math.floor(Number(r.age));
  if (!Number.isFinite(age) || age < PLANNER_AGE.min || age > PLANNER_AGE.max) {
    return `กรอกอายุ ${PLANNER_AGE.min}–${PLANNER_AGE.max} ปี`;
  }
  const income = money(r.income);
  if (!income) return "กรอกเงินเดือนก่อนนะครับ";
  const kids = Array.isArray(r.children) ? r.children : [];
  const expense = money(r.expense);
  return {
    age,
    sex: r.sex === "F" ? "F" : "M",
    income,
    expense,
    savings: money(r.savings),
    children: kids.slice(0, 4).map((k) => Math.floor(Number(k))).filter((k) => Number.isFinite(k) && k >= 0 && k <= 40),
    otherDependants: r.otherDependants === true,
    debts: money(r.debts),
    lifeCover: money(r.lifeCover),
    ciCover: money(r.ciCover),
    healthNow: HEALTH_NOW.find((h) => h === r.healthNow) ?? "none",
    healthRoom: money(r.healthRoom),
    premiumsNow: money(r.premiumsNow),
    hospital: HOSPITALS.find((h) => h === r.hospital) ?? "private",
    lifeWant: r.lifeWant === "save" ? "save" : "cover",
    retireAge: RETIRE_AGES.find((a) => a === Number(r.retireAge)) ?? PENSION_FROM_AGE,
    retireMonthly: money(r.retireMonthly) || defaultRetireMonthly(expense),
    pensionHave: money(r.pensionHave),
    retireLump: money(r.retireLump),
    lifeExpectancy: lifeExpectancy(r.lifeExpectancy),
    budget: money(r.budget),
  };
}

function lifeExpectancy(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isInteger(n) && n >= LIFE_EXPECTANCY.min && n <= LIFE_EXPECTANCY.max ? n : undefined;
}

/** the first step at or above x, or the last step when x is past them all */
export function roundUpTo(steps: readonly number[], x: number): number {
  return steps.find((s) => s >= x) ?? steps[steps.length - 1];
}

export interface LifeNeed {
  years: number;
  support: number;
  education: number;
  debts: number;
  funeral: number;
  need: number;
  /** life cover plus savings */
  have: number;
  gap: number;
  /** Life Protect's double cover lasts through every year of support (PLB never doubles) */
  doubled: boolean;
  /** the Life Protect sum that closes the gap; 0 when there is none */
  sumAssured: number;
}

export function lifeNeed(p: PlanInput): LifeNeed {
  const young = p.children.filter((a) => a < CHILD_SUPPORTED_UNTIL);
  const years = young.length
    ? CHILD_SUPPORTED_UNTIL - Math.min(...young)
    : p.otherDependants ? YEARS_FOR_OTHER_DEPENDANTS : 0;
  const support = p.expense * 12 * years;
  const education = young.reduce(
    (s, a) => s + Math.round((EDUCATION_PER_CHILD * (CHILD_SUPPORTED_UNTIL - a)) / CHILD_SUPPORTED_UNTIL / 10_000) * 10_000,
    0,
  );
  const need = p.debts + support + education + FUNERAL;
  const have = p.lifeCover + p.savings;
  const gap = Math.max(0, need - have);
  const doubled = p.age < LIFE_DOUBLE_BEFORE_AGE && p.age + years <= LIFE_DOUBLE_BEFORE_AGE;
  const sumAssured = gap === 0 ? 0 : roundUpTo(LIFE_SUMS, doubled ? gap / 2 : gap);
  return { years, support, education, debts: p.debts, funeral: FUNERAL, need, have, gap, doubled, sumAssured };
}

export interface HealthNeed {
  plan: string;
  room: number;
  haveRoom: number;
  covered: boolean;
}

/** Employer welfare is not counted: it ends with the job. */
export function healthNeed(p: PlanInput): HealthNeed {
  const plan = HOSPITAL_TIER[p.hospital];
  const room = HEALTH_TIERS.find((t) => t.code === plan)!.room;
  const haveRoom = p.healthNow === "private" ? p.healthRoom : 0;
  return { plan, room, haveRoom, covered: haveRoom >= room };
}

export function ciNeed(p: PlanInput): { need: number; have: number; gap: number } {
  const need = p.income * 12 * CI_YEARS_OF_INCOME;
  return { need, have: p.ciCover, gap: Math.max(0, need - p.ciCover) };
}

/** baht a month, the 70% rule to the hundred — the retirement field's starting value */
export function defaultRetireMonthly(expense: number): number {
  return Math.round((expense * RETIRE_SHARE_OF_EXPENSE) / 100) * 100;
}

/** baht a month: what the customer wants after work, what is already coming, and the gap */
export function retireNeed(p: PlanInput): { should: number; have: number; gap: number } {
  // past the retirement age the money is spread from today
  const months = Math.max(1, (p.lifeExpectancy ?? LUMP_LASTS_TO_AGE) - Math.max(p.age, p.retireAge)) * 12;
  const have = p.pensionHave + Math.round(p.retireLump / months / 100) * 100;
  return { should: p.retireMonthly, have, gap: Math.max(0, p.retireMonthly - have) };
}

/** baht a month: ten percent of income less what is already paid, down to the hundred */
export function defaultBudget(income: number, premiumsNow: number): number {
  return Math.max(0, Math.floor((income * DEFAULT_BUDGET_SHARE - premiumsNow / 12) / 100) * 100);
}

/** Thai personal income tax, on net income a year */
const BRACKETS: [upTo: number, rate: number][] = [
  [150_000, 0], [300_000, 0.05], [500_000, 0.1], [750_000, 0.15],
  [1_000_000, 0.2], [2_000_000, 0.25], [5_000_000, 0.3], [Infinity, 0.35],
];

/** An estimate: salary only, the expense deduction and the personal allowance, nothing else. */
export function marginalRate(monthlyIncome: number): number {
  const annual = monthlyIncome * 12;
  const net = annual - Math.min(annual * 0.5, 100_000) - 60_000;
  return BRACKETS.find(([upTo]) => net <= upTo)![1];
}

/** baht a year of new premium, by the deduction each counts under */
export interface NewPremiums {
  life: number;
  health: number;
  pension: number;
}

/**
 * The tax the new premiums save a year, estimated. Life and health share 100,000 (health alone
 * 25,000), with what is already paid counted first; pension counts to 15% of income or 200,000.
 */
export function taxSaved(p: PlanInput, add: NewPremiums): number {
  const annual = p.income * 12;
  const before = Math.min(p.premiumsNow, 100_000);
  const after = Math.min(p.premiumsNow + add.life + Math.min(add.health, 25_000), 100_000);
  const pension = Math.min(add.pension, annual * 0.15, 200_000);
  return Math.round((after - before + pension) * marginalRate(p.income));
}
