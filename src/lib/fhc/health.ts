import { formatBaht } from "@/calc/money";
import { LIFE_EXPECTANCY } from "@/lib/plan/assumptions";
import { ciNeed, cleanInput, healthNeed, lifeNeed, retireNeed, type PlanInput } from "@/lib/plan/needs";
import type { Area, AreaKey, PlanResult } from "@/lib/plan/recommend";
import {
  COVER_SHARE, DEBT_YEARS, DEFAULT_EXPECTANCY, EMERGENCY_MONTHS, EVENTS, MAX_PEOPLE, RELATION_LABEL, SAVING_SHARE,
  WORK_ABILITY_LABEL, type EventKey, type Relation, type WorkAbility,
} from "./assumptions";

/**
 * The Financial Health Check's figures: the questionnaire's own sums, six scores, and the
 * five events tied to the plan the planner engine (lib/plan) prices. Pure, so every figure is testable; the
 * page, the print-out and the LINE message all read from here. Money is baht unless a field
 * says satang.
 */

/** the planner engine's fields FHC asks in the same words */
type Shared = Pick<PlanInput,
  "age" | "sex" | "income" | "expense" | "lifeCover" | "ciCover" | "healthNow" | "healthRoom" | "premiumsNow"
  | "hospital" | "lifeWant" | "retireAge" | "retireMonthly" | "pensionHave" | "budget">;

export interface Person {
  relation: Relation;
  age: number;
}

export interface FhcInput extends Shared {
  /** the age the money has to last to */
  expectancy: number;
  work: WorkAbility;
  cash: number;
  fixed: number;
  otherSaving: number;
  homeLoan: number;
  carLoan: number;
  otherDebt: number;
  /** LTF/RMF — counted toward retirement only */
  taxFund: number;
  stocks: number;
  /** relation and age only; names stay in the browser */
  people: Person[];
}

const MAX_MONEY = 1_000_000_000;

function money(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_MONEY) : 0;
}

/** The form's values made safe, or the sentence to show when they cannot be — the planner's rules for age and income, and spending too: without it every score reads well. */
export function cleanFhc(raw: unknown): FhcInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const base = cleanInput(r);
  if (typeof base === "string") return base;
  if (!base.expense) return "กรอกค่าใช้จ่ายต่อเดือนก่อนนะครับ";
  const expectancy = Math.floor(Number(r.expectancy));
  const people = (Array.isArray(r.people) ? r.people : []).flatMap((x): Person[] => {
    const row = (x ?? {}) as Record<string, unknown>;
    const age = Number(row.age);
    const relation = (Object.keys(RELATION_LABEL) as Relation[]).find((k) => k === row.relation);
    return relation && Number.isInteger(age) && age >= 0 && age <= 100 ? [{ relation, age }] : [];
  });
  return {
    age: base.age, sex: base.sex, income: base.income, expense: base.expense, lifeCover: base.lifeCover,
    ciCover: base.ciCover, healthNow: base.healthNow, healthRoom: base.healthRoom, premiumsNow: base.premiumsNow,
    hospital: base.hospital, lifeWant: base.lifeWant, retireAge: base.retireAge, retireMonthly: base.retireMonthly,
    pensionHave: base.pensionHave, budget: base.budget,
    expectancy: expectancy >= LIFE_EXPECTANCY.min && expectancy <= LIFE_EXPECTANCY.max ? expectancy : DEFAULT_EXPECTANCY,
    work: (Object.keys(WORK_ABILITY_LABEL) as WorkAbility[]).find((k) => k === r.work) ?? "full",
    cash: money(r.cash), fixed: money(r.fixed), otherSaving: money(r.otherSaving),
    homeLoan: money(r.homeLoan), carLoan: money(r.carLoan), otherDebt: money(r.otherDebt),
    taxFund: money(r.taxFund), stocks: money(r.stocks),
    people: people.slice(0, MAX_PEOPLE),
  };
}

export interface FhcFigures {
  /** years of work left; none when the customer cannot work */
  workYears: number;
  /** years from retiring (or from today, once past it) to the expected age */
  moneyYears: number;
  incomeYear: number;
  /** ค่าความสามารถในการทำงาน: a year's income times the years of work left */
  lifetimeIncome: number;
  netMonth: number;
  savings: number;
  debts: number;
  invest: number;
  netWorth: number;
  /** the emergency fund to aim for */
  emergencyTarget: number;
}

export function figures(f: FhcInput): FhcFigures {
  const workYears = f.work === "none" ? 0 : Math.max(0, f.retireAge - f.age);
  const incomeYear = f.income * 12;
  const savings = f.cash + f.fixed + f.otherSaving;
  const debts = f.homeLoan + f.carLoan + f.otherDebt;
  const invest = f.taxFund + f.stocks;
  return {
    workYears,
    moneyYears: Math.max(0, f.expectancy - Math.max(f.age, f.retireAge)),
    incomeYear,
    lifetimeIncome: incomeYear * workYears,
    netMonth: f.income - f.expense,
    savings,
    debts,
    invest,
    netWorth: savings + invest - debts,
    emergencyTarget: f.expense * EMERGENCY_MONTHS.green,
  };
}

/** The plan engine's input. Stocks count as savings, the tax funds as retirement money — never both. */
export function toPlanInput(f: FhcInput): PlanInput {
  return {
    age: f.age, sex: f.sex, income: f.income, expense: f.expense,
    savings: f.cash + f.fixed + f.otherSaving + f.stocks,
    children: f.people.filter((p) => p.relation === "child").map((p) => p.age),
    otherDependants: f.people.some((p) => p.relation !== "child"),
    debts: f.homeLoan + f.carLoan + f.otherDebt,
    lifeCover: f.lifeCover, ciCover: f.ciCover, healthNow: f.healthNow, healthRoom: f.healthRoom,
    premiumsNow: f.premiumsNow, hospital: f.hospital, lifeWant: f.lifeWant, retireAge: f.retireAge,
    retireMonthly: f.retireMonthly, pensionHave: f.pensionHave, retireLump: f.taxFund,
    lifeExpectancy: f.expectancy, budget: f.budget,
  };
}

export type Level = "green" | "yellow" | "red" | "none";
export type ScoreKey = "emergency" | "saving" | "debt" | "life" | "healthCi" | "retire";

export interface Score {
  key: ScoreKey;
  label: string;
  level: Level;
  /** the figure behind the colour, in words */
  shown: string;
}

const higherIsBetter = (v: number | null, t: { green: number; yellow: number }): Level =>
  v === null ? "none" : v >= t.green ? "green" : v >= t.yellow ? "yellow" : "red";
const pct = (v: number) => `${Math.round(Math.min(v, 9.99) * 100)}%`;
const baht = (n: number) => Math.round(n).toLocaleString("en-US");

export function scores(f: FhcInput): Score[] {
  const g = figures(f);
  const p = toPlanInput(f);
  const months = f.expense > 0 ? (f.cash + f.fixed) / f.expense : null;
  const left = g.netMonth;
  const share = f.income > 0 ? left / f.income : null;
  const debtYears = f.income > 0 ? g.debts / g.incomeYear : null;
  const life = lifeNeed(p);
  const lifeShare = life.need > 0 ? life.have / life.need : null;
  const [health, ci] = [healthNeed(p).covered, ciNeed(p).gap === 0];
  const retire = retireNeed(p);
  const retireShare = retire.should > 0 ? retire.have / retire.should : null;
  return [
    {
      key: "emergency", label: "เงินสำรองฉุกเฉิน", level: higherIsBetter(months, EMERGENCY_MONTHS),
      shown: months === null ? "—" : `สำรองได้ ${months.toFixed(1)} เดือน`,
    },
    {
      key: "saving", label: "เงินเหลือต่อเดือน", level: higherIsBetter(share, SAVING_SHARE),
      shown: share === null ? "—" : left < 0 ? `ใช้เกินรายได้ ${baht(-left)} บาท/เดือน` : `${pct(share)} ของรายได้`,
    },
    {
      key: "debt", label: "ภาระหนี้",
      level: debtYears === null ? "none"
        : debtYears < DEBT_YEARS.green ? "green" : debtYears <= DEBT_YEARS.yellow ? "yellow" : "red",
      shown: debtYears === null ? "—" : g.debts === 0 ? "ไม่มีหนี้" : `${debtYears.toFixed(1)} เท่าของรายได้ต่อปี`,
    },
    {
      key: "life", label: "ความคุ้มครองชีวิต", level: higherIsBetter(lifeShare, COVER_SHARE),
      shown: lifeShare === null ? "—" : `${pct(lifeShare)} ของที่ควรมี`,
    },
    {
      key: "healthCi", label: "ค่ารักษาและโรคร้าย",
      level: health && ci ? "green" : health || ci ? "yellow" : "red",
      shown: health && ci ? "มีครบ" : health ? "ยังขาดโรคร้ายแรง" : ci ? "ยังขาดค่ารักษา" : "ยังขาดทั้งสองด้าน",
    },
    {
      key: "retire", label: "เงินเกษียณ", level: higherIsBetter(retireShare, COVER_SHARE),
      shown: retireShare === null ? "—" : `${pct(retireShare)} ของที่อยากมี`,
    },
  ];
}

export interface EventRow {
  key: EventKey;
  name: string;
  level: Level;
  lines: string[];
}

/** What the plan card says about one area, in a line. */
function offerLine(plan: PlanResult, key: AreaKey): string {
  const a: Area | undefined = plan.areas.find((x) => x.key === key);
  if (!a || a.status === "covered") return "มีพอแล้ว";
  if (a.status === "unavailable") return "อายุนี้แบบที่มีรับไม่ได้ ปรึกษาตัวแทน";
  if (!a.offer) return "งบหมดที่ด้านก่อนหน้าแล้ว";
  if (a.status === "short") return `${a.offer.product} (งบไม่พอ)`;
  return `${a.offer.product} · เดือนละ ${formatBaht(Math.round(a.offer.annual / 12))} บาท`;
}

/** The five events, each tied to what we sell for it — or, for losing a job, to what nobody sells. */
export function events(f: FhcInput, sc: Score[], plan: PlanResult): EventRow[] {
  const level = (k: ScoreKey) => sc.find((s) => s.key === k)?.level ?? "none";
  const lines: Record<EventKey, { level: Level; lines: string[] }> = {
    illness: { level: level("healthCi"), lines: [offerLine(plan, "health"), offerLine(plan, "ci")] },
    accident: { level: "none", lines: ["สัญญาเพิ่มเติมอุบัติเหตุ แนบกับแบบประกันชีวิต เบี้ยขึ้นกับอาชีพ ปรึกษาตัวแทน"] },
    disability: { level: "none", lines: ["สัญญาเพิ่มเติมยกเว้นเบี้ยเมื่อทุพพลภาพ (WP) ปรึกษาตัวแทน"] },
    death: { level: level("life"), lines: [offerLine(plan, "life")] },
    jobLoss: {
      level: level("emergency"),
      lines: [`ไม่มีประกันสำหรับเรื่องนี้ ควรมีเงินสำรองราว ${baht(figures(f).emergencyTarget)} บาท (ค่าใช้จ่าย ${EMERGENCY_MONTHS.green} เดือน)`],
    },
  };
  return EVENTS.map((e) => ({ ...e, ...lines[e.key] }));
}
