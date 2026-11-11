import { spokenBaht, spokenBy, type QuoteVideoFacts, type SceneKey } from "./script";

/**
 * The three whole alternative clips a Life Protect quote can be told as (owner, 2026-11-11,
 * mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88, ก ก ก): a question first, the life
 * line, or what is paid against what comes back. This file only says which fits a quote and what
 * each scene's voice says; the frames are drawn elsewhere. Every figure comes from the facts.
 */
export type RecipeKey = "ask" | "life" | "versus";
export const RECIPE_KEYS: RecipeKey[] = ["ask", "life", "versus"];
export const RECIPE_NAMES: Record<RecipeKey, string> = { ask: "เปิดด้วยคำถาม", life: "เส้นชีวิต", versus: "เทียบให้เห็น" };

export const readRecipe = (v: unknown): RecipeKey | undefined => RECIPE_KEYS.find((k) => k === v);

export interface RecipeFigures {
  /** the yearly instalment as the card prints it: "28,700" */
  yearly: string;
  /** the age the cover steps down at, read off the first cover row: 60 */
  splitAge: number;
  early: string;
  late: string;
  /** what is paid in all, and what comes back at the break-even age, in whole baht (versus only) */
  paid?: number;
  cash?: number;
  diff?: number;
}

const digits = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** undefined where the quote has no yearly row or no two cover rows that say an age */
export function recipeFigures(f: QuoteVideoFacts): RecipeFigures | undefined {
  // the Thai card labels the yearly instalment "รายปี"; its rows carry no `per`
  const yearly = f.prices.find((p) => p.label === "รายปี")?.amount;
  const age = f.cover[0]?.label.match(/\d+/)?.[0];
  if (!yearly || f.coverStyle !== "bars" || f.cover.length !== 2 || !age) return undefined;
  const base = { yearly, splitAge: Number(age), early: f.cover[0].amount, late: f.cover[1].amount };
  if (!f.totalPaid || !f.breakEven) return base;
  const paid = digits(f.totalPaid);
  const cash = digits(f.breakEven.cash);
  return { ...base, paid, cash, diff: cash - paid };
}

/** a recipe that does not fit is never offered and never drawn */
export function recipeFits(key: RecipeKey, f: QuoteVideoFacts): boolean {
  if (f.product !== "LIFEPROTECT" || (f.lang && f.lang !== "th") || f.riders || f.budget) return false;
  const fig = recipeFigures(f);
  if (!fig) return false;
  if (key === "versus") return fig.diff !== undefined && fig.diff > 0;
  const told = !f.payToEnd && f.payYears !== undefined && f.lastPayAge !== undefined;
  return key === "ask" ? told && Boolean(f.perDayAmount) : told;
}

export const recipesFor = (f: QuoteVideoFacts): RecipeKey[] => RECIPE_KEYS.filter((k) => recipeFits(k, f));

/** "2 ล้านบาท" runs together as it is said; a figure in digits keeps its space (as script.ts says it) */
const baht = (n: number | string) => {
  const s = spokenBaht(typeof n === "number" ? n : digits(n));
  return s.endsWith("ล้าน") ? `${s}บาท` : `${s} บาท`;
};

/**
 * What each scene says, in the scene order the drawing uses. Wording is the spec's draft, to be
 * checked with the owner on the first real clips; no AI writes it. A man ends with ครับ (spokenBy).
 */
export function recipeScript(key: RecipeKey, f: QuoteVideoFacts, narrator: "F" | "M"): { key: SceneKey; voice: string }[] {
  const fig = recipeFigures(f);
  if (!fig) return [];
  const lines: [SceneKey, string][] = key === "ask" ? [
    ["lead", "ถามจริงนะคะ ถ้าพรุ่งนี้ไม่มีคุณ ที่บ้านจะอยู่ได้กี่เดือน"],
    ["cover", `มีแผนนี้ ครอบครัวได้รับ ${baht(f.lead.baht)} หากจากไปก่อนอายุ ${fig.splitAge}`],
    ["price", `แลกกับวันละ ${f.perDayAmount} บาท จ่าย ${f.payYears} ปี จบตอนอายุ ${f.lastPayAge} แล้วคุ้มครองยาวถึงอายุ ${f.coverToAge}`],
    ["contact", "อยากรู้ตัวเลขของคุณเอง ทักมาได้เลยค่ะ"],
  ] : key === "life" ? [
    ["lead", `วันนี้อายุ ${f.age} เริ่มออมปีละ ${baht(fig.yearly)}`],
    ["price", `อีก ${f.payYears} ปี อายุ ${f.lastPayAge} จ่ายครบ หยุดจ่าย แต่ความคุ้มครองยังอยู่`],
    ["cover", `ตลอดช่วงก่อนอายุ ${fig.splitAge} หากจากไป ครอบครัวได้รับ ${baht(fig.early)}`],
    ["value", `จากนั้นยาวถึงอายุ ${f.coverToAge} ยังคุ้มครองต่อ ${baht(fig.late)}`],
    ["contact", "อยากวางเส้นชีวิตของคุณเอง ทักมาได้เลยค่ะ"],
  ] : [
    ["lead", `จ่ายรวม ${f.payYears} ปี ${baht(fig.paid!)} พออายุ ${f.breakEven!.age} เวนคืนได้ ${baht(fig.cash!)}`],
    ["value", "จ่ายไปกับได้คืน ต่างกันแค่นี้ค่ะ"],
    ["cover", `ได้คืนมากกว่าที่จ่าย ${baht(fig.diff!)} และระหว่างทางมีความคุ้มครอง ${baht(fig.early)} ก่อนอายุ ${fig.splitAge}`],
    ["contact", "อยากดูตัวเลขของคุณ ทักมาได้เลยค่ะ"],
  ];
  return lines.map(([k, voice]) => ({ key: k, voice: spokenBy(voice, narrator) }));
}

/**
 * One recipe at random, never the one the last clip used where another fits; with only one that
 * fits, repeating it beats offering nothing. `roll` is in [0, 1).
 */
export function pickRecipe(fitting: RecipeKey[], last: RecipeKey | undefined, roll: number): RecipeKey | undefined {
  const others = fitting.filter((k) => k !== last);
  const pool = others.length ? others : fitting;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}
