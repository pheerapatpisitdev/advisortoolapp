import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { recentTurns } from "../common";
import { merge, planNamedIn, type HealthSlots } from "../ihealthy/route";

/**
 * What an English-speaking customer is asking for, read the way the Thai router reads Thai:
 * by pattern first, and by a model only for what a pattern cannot read.
 *
 * The plan and the territory are never taken from the model — the same rule, for the same
 * reason, as the Thai router's `clean`: the plan is the price.
 */

/** An age said as an age: "35 years old", "age 35", "I'm 35". */
const AGE_SAID = [
  /\b(\d{1,2})\s*(?:years?\s*old|yrs?\b|y\/?o\b)/i,
  /\bage(?:d)?\s*(?:is\s*)?(\d{1,2})\b/i,
  /\b(?:i'?m|i\s+am)\s+(\d{1,2})\b/i,
];

/** A number on its own, and not part of a year, a sum or a limit in millions. */
const AGE_ALONE = /(?<![\d,.])(\d{1,2})(?![\d,.]|\s*(?:million|mil\b|m\b|k\b|baht|thb))/i;

const FEMALE = /\b(?:female|woman|women|lady|girl|wife|mrs|ms)\b|\bf\s*\d|\d\s*f\b/i;
const MALE = /\b(?:male|man|men|gentleman|boy|husband|mr)\b|\bm\s*\d|\d\s*m\b(?!\s*(?:illion|il))/i;

function ageInEn(text: string): number | undefined {
  for (const re of AGE_SAID) {
    const m = re.exec(text);
    if (m) return Number(m[1]);
  }
  const m = AGE_ALONE.exec(text);
  return m ? Number(m[1]) : undefined;
}

function sexInEn(text: string): "M" | "F" | undefined {
  const f = FEMALE.test(text);
  const m = MALE.test(text);
  if (f === m) return undefined;
  return f ? "F" : "M";
}

/** The age and the sex a message gives, whichever of the two it gives. */
export function personInEn(text: string): { age?: number; sex?: "M" | "F" } {
  const age = ageInEn(text);
  const sex = sexInEn(text);
  return { ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** As the Thai `territoryNamedIn`: the widest one named wins, spelled the way the rate table spells it. */
const TERRITORY_WORDS_EN: [string, RegExp][] = [
  ["ทั่วโลก", /worldwide|global|whole world|anywhere in the world/i],
  ["เอเชีย", /\basia\b/i],
  ["ประเทศไทย", /thailand/i],
];

export function territoryNamedInEn(text: string): string | undefined {
  return TERRITORY_WORDS_EN.find(([, re]) => re.test(text))?.[0];
}

/** A plan by name, or by its yearly limit said in millions — "the 10 million one". */
export function planNamedInEn(text: string): string | undefined {
  const named = planNamedIn(text);
  if (named) return named;
  const m = text.match(/(\d+)\s*(?:million|mil\b|m\b)/i);
  if (!m) return undefined;
  const baht = Number(m[1]) * 1_000_000;
  return iHealthyFacts().plans.find((p) => p.annualMax === baht)?.code;
}

const SYSTEM = `You help an insurance agent. Read the customer's latest message and say what they want. Reply in JSON only.

The conversation is about "iHealthy Ultra", a lump-sum medical rider that pays hospital bills as charged up to a yearly limit.

intent is one of
- "quote" = wants a premium, a price, or to choose a plan
- "plan_info" = asks what is covered, room rates, outpatient, waiting periods, renewal age, how plans differ
- "other" = a greeting, or anything else

Fill these fields only when the message gives them
- age as a number of years
- sex as "M" (male) or "F" (female)
- question: the question rewritten to stand on its own, filling in what it refers to from earlier turns

Leave out any field the message does not give. Never guess.`;

/** Short messages that pattern-read as a person or a plan are answered without a model. */
const SHORT = 6;

export async function routeHealthEn(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthSlots> {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const person = personInEn(last);
  const plan = planNamedInEn(last);
  const territory = territoryNamedInEn(last);

  const read: HealthSlots = { product: "ihealthy", intent: "other", question: last };
  if (plan) read.plan = plan;
  if (territory) read.territory = territory;

  const pattern = person.age !== undefined || person.sex !== undefined || plan !== undefined;
  if (pattern && last.trim().split(/\s+/).length <= SHORT) {
    return { ...merge(previous, { ...read, ...person, intent: "quote" }), lang: "en" };
  }

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  const r = await chat({ tier: "small", task: "route_health_en", messages, maxTokens: 250, json: true });
  const raw = parseJsonReply<Partial<HealthSlots>>(r.text) ?? {};

  const out: HealthSlots = {
    ...read,
    intent: raw.intent && ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other",
  };
  // the message's own words beat the model's reading of them
  if (person.age !== undefined) out.age = person.age;
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);
  if (person.sex) out.sex = person.sex;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  if (out.plan !== undefined && out.intent === "other") out.intent = "quote";
  if (typeof raw.question === "string" && raw.question.trim()) out.question = raw.question.trim();
  return { ...merge(previous, out), lang: "en" };
}
