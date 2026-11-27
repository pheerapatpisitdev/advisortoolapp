import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { hospitalBriefEn } from "../hospitals";
import { arrangementFor } from "../ihealthy/quote";
import { DOCUMENTS, exclusionsLineEn, FAQ_EN, faqMatches, RISES } from "./faq";
import { COMPANY_EN } from "./words";

/**
 * A message that asks several things at once, answered in one reply (owner, 2026-11-23).
 *
 * Foreigners write the way they would write to an insurer: their details, then a list of
 * questions. The brain used to answer the first thing it recognised — an Irishman's six
 * questions got the hospital list and nothing else, his age and gender sitting there unpriced.
 *
 * Every answer here is a written sentence or the engine's figures, never a model's: the same
 * answers the brain gives each question asked alone (faq.ts, hospitals.ts), in one message.
 */

export const COMPANY = /which company|who is the insurer|what company|insurance company|underwrit|is this legit|are you (?:licensed|real)/i;

/** What a line has to say to be a question rather than a statement of the customer's details. */
const ASKING = /\?|\b(?:what|how|when|which|where|why|does|do|is|are|can|could|would|will)\b|please|let me know|tell me|send me|confirm|wondering|(?:like|want) to (?:know|understand)/i;
const BULLET = /^\s*(?:[*•\-–·]|\d+[.)])\s*/;

/** The message cut into its lines and sentences, bullets taken off. */
export function segmentsOf(text: string): string[] {
  return text
    .split(/\n+|(?<=[?!])\s+|(?<=\.)\s+(?=[A-Z*•\-\d])/)
    .map((s) => s.replace(BULLET, "").trim())
    .filter(Boolean);
}

export interface Topic {
  key: string;
  /** the line of the message it answers, for the answers that read it again (hospitals, ages) */
  segment: string;
}

/** The order a line is read in: benefits before the health declaration, as faq.ts explains. */
const ORDER = ["deductible", "outpatient", "accident", "health", "documents", "company", "direct", "noclaim", "ages",
  "rises", "waiting", "monthly", "tax", "visa", "abroad", "hospitals"];

function topicOf(segment: string, awaitingProvince: boolean): string | undefined {
  for (const key of ORDER) {
    if (key === "company") {
      if (COMPANY.test(segment)) return key;
    } else if (key === "hospitals") {
      if (hospitalBriefEn(segment, awaitingProvince)) return key;
    } else {
      const entry = FAQ_EN.find((e) => e.key === key);
      if (entry && faqMatches(entry, segment)) return key;
    }
  }
  return undefined;
}

export interface Asked {
  topics: Topic[];
  /** questions with a question mark and no written answer: someone has to come back to them */
  unknown: string[];
}

/** What a message asks, each subject once, in the order the customer asked them. */
export function topicsIn(text: string, awaitingProvince = false): Asked {
  const topics: Topic[] = [];
  const unknown: string[] = [];
  for (const segment of segmentsOf(text)) {
    // "Could you please confirm:" introduces the questions; it is not one
    if (!ASKING.test(segment) || /:\s*$/.test(segment)) continue;
    const key = topicOf(segment, awaitingProvince);
    if (!key) {
      if (segment.includes("?")) unknown.push(segment);
      continue;
    }
    if (!topics.some((t) => t.key === key)) topics.push({ key, segment });
  }
  return { topics, unknown };
}

/** The ages a line names after "age", "at" or "when I'm": "at ages 50, 55, 60, and 65". */
function agesNamed(text: string): number[] {
  const from = /\b(?:ages?|at|when i(?:'m| am)|turn(?:ing|s)?)\s+\d{2}\b/i.exec(text);
  if (!from) return [];
  return [...text.slice(from.index).matchAll(/\b(\d{2})\b/g)].map((m) => Number(m[1]));
}

const PREMIUM_AGES = 6;

/**
 * The medical part of the premium at older ages, at today's rates (owner chose ข, 2026-11-23).
 *
 * Only the medical part: it is the part priced by the age reached, renewed each year. The base
 * policy's premium is fixed at the age it starts, so pricing the whole quote at 60 would be
 * the premium of someone who started at 60 — not this customer's. The note says the rates
 * themselves can change, because the company may change them on renewal.
 *
 * Undefined when there is no age to start from and none was named.
 */
export function premiumByAgeEn(who: { age?: number; sex: Sex; plan?: string; asked: string }, today: Date = new Date()): string | undefined {
  const table = iHealthyTable(today);
  if (table.expired) return undefined;
  const { renewalToAge } = iHealthyFacts().terms;
  const named = agesNamed(who.asked).filter((a) => a >= table.ageMin && a <= renewalToAge && (who.age === undefined || a >= who.age));
  const start = who.age;
  const wanted = named.length
    ? [...new Set(named)].sort((a, b) => a - b)
    : start === undefined ? [] : [0, 5, 10, 15, 20].map((n) => start + n).filter((a) => a <= renewalToAge);
  const ages = wanted.slice(0, PREMIUM_AGES);
  if (ages.length === 0) return undefined;

  const priced = ages.filter((a) => a <= table.ageMax);
  const from = start ?? priced[0];
  if (from === undefined || from > table.ageMax) return undefined;
  const sellable = plansFor(table, from).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const plans = who.plan && sellable.includes(who.plan) ? [who.plan] : phoneColumns(order, sellable);

  const medical = (age: number, plan: string): string => {
    const v = arrangementFor({ age, sex: who.sex, plan });
    const p = iHealthyPricing(table, {
      base: v.base, sex: who.sex, age, sumAssured: v.sumAssured, plan, territory: v.territory, coverage: v.coverage,
    });
    const annual = p?.rider.find((m) => m.mode === "annual");
    return annual ? formatBaht(annual.total) : "—";
  };
  const lines = priced.map((age) => `Age ${age} — ${plans.map((plan) => `${planLabel(plan)} ${medical(age, plan)}`).join(" · ")}`);
  const beyond = ages.some((a) => a > table.ageMax)
    ? `\nRates after age ${table.ageMax} aren't in today's table — the policy renews up to age ${renewalToAge}.`
    : "";
  const person = who.sex === "M" ? "a man" : "a woman";
  return `The medical part of the premium for ${person} at each age, at today's rates (THB a year):\n${lines.join("\n")}${beyond}\n`
    + "The base life policy's premium stays level. Renewal rates can change, so future premiums may differ from these.";
}

/** The words for one subject in a reply to several, or undefined where its figures go out on their own. */
export function topicAnswer(topic: Topic, awaitingProvince: boolean): { label: string; text: string; asksProvince?: true } | undefined {
  switch (topic.key) {
    case "company":
      return { label: "Insurer", text: COMPANY_EN.split(". ")[0].replace(/\.?$/, ".") };
    case "hospitals": {
      const h = hospitalBriefEn(topic.segment, awaitingProvince);
      return h ? { label: "Hospitals", text: h.text, ...(h.asksProvince ? { asksProvince: true as const } : {}) } : undefined;
    }
    case "direct":
      return { label: "Paying at the hospital", text: FAQ_EN.find((e) => e.key === "direct")!.answer(), asksProvince: true };
    default: {
      const entry = FAQ_EN.find((e) => e.key === topic.key);
      return entry ? { label: LABELS[topic.key] ?? topic.key, text: entry.answer() } : undefined;
    }
  }
}

const LABELS: Record<string, string> = {
  deductible: "Deductibles and limits",
  outpatient: "Inpatient and outpatient",
  accident: "Accidents",
  health: "Pre-existing conditions",
  documents: "Policy documents",
  noclaim: "No-claim discount",
  ages: "Ages",
  rises: "Premium as you get older",
  waiting: "Waiting period",
  monthly: "Paying monthly",
  tax: "Tax",
  visa: "Visa",
  abroad: "Outside Thailand",
};

export const labelOf = (key: string) => LABELS[key] ?? key;

export { DOCUMENTS, exclusionsLineEn, RISES };
