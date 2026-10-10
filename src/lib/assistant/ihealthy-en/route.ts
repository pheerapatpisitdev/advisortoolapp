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

/**
 * An age is read only where it cannot be anything else — the Thai reader's rule (`peopleIn`):
 * beside a sex, said as an age, or as the whole message. A number on its own inside a
 * sentence is too many things — "a 3 day stay", "2 nights", "70 M" — and a wrong age is a
 * wrong premium (review, 2026-10-02).
 */
const SEX = "female|woman|lady|girl|male|man|gentleman|boy|f|m";
/** "35 male", "35, male", "35/F", "35yo m", "25m", "35 years old female" */
const AGE_THEN_SEX = new RegExp(
  String.raw`(?<![\d,.])(\d{1,2})\s*(?:years?\s*old|yrs?|y\/?o)?\s*[,/-]?\s*(${SEX})\b`, "i",
);
/** "F 42", "male 45", "F, 35" — never the m of "I'm" */
const SEX_THEN_AGE = new RegExp(String.raw`(?<![\w'’])(${SEX})\s*[,/-]?\s*(?:aged?\s*)?(\d{1,2})(?![\d,.])`, "i");

/** An age said as an age: "35 years old", "age 35", "aged 35", "I'm 35", "I'm actually 45". */
// "I'm 35" first: "I'm 35, can I renew until age 80?" is a man of thirty-five, and an age said
// as a limit — "until age 80", "max age 70", "over age 65" — is not the customer's own
const AGE_SAID = [
  /\b(?:i['’]?m|i\s+am)\s+(?:actually\s+|now\s+|turning\s+)?(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:years?\s*old|yrs?\b|y\/?o\b)/i,
  /(?<!(?:until|till|up\s+to|to|max(?:imum)?|limit|over|after|beyond|by|past|above|below|under)\s+(?:the\s+)?)\bage(?:d)?\s*(?:is\s*)?(\d{1,2})\b/i,
];
/** The whole message is the age. */
const AGE_ONLY = /^\s*(\d{1,2})\s*[.!]?\s*$/;

// not "wife" or "husband": that is somebody else's sex, said by the customer about their other half
const FEMALE_WORD = /\b(?:female|woman|lady|girl|mrs|ms)\b/i;
const MALE_WORD = /\b(?:male|man|gentleman|boy|mr)\b/i;

const sexOf = (word: string): "M" | "F" => (/^(?:female|woman|lady|girl|f)$/i.test(word) ? "F" : "M");

function sexInEn(text: string): "M" | "F" | undefined {
  const f = FEMALE_WORD.test(text);
  const m = MALE_WORD.test(text);
  if (f === m) return undefined;
  return f ? "F" : "M";
}

/** The age and the sex a message gives, whichever of the two it gives. */
export function personInEn(text: string): { age?: number; sex?: "M" | "F" } {
  const after = AGE_THEN_SEX.exec(text);
  if (after) return { age: Number(after[1]), sex: sexOf(after[2]) };
  const before = SEX_THEN_AGE.exec(text);
  if (before) return { age: Number(before[2]), sex: sexOf(before[1]) };

  const said = AGE_SAID.map((re) => re.exec(text)).find(Boolean) ?? AGE_ONLY.exec(text);
  const age = said ? Number(said[1]) : undefined;
  const sex = sexInEn(text);
  return { ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** As the Thai `territoryNamedIn`: the widest one named wins, spelled the way the rate table spells it. */
const TERRITORY_WORDS_EN: [string, RegExp][] = [
  ["ทั่วโลก", /worldwide|global|whole world|anywhere in the world/i],
  ["เอเชีย", /\basia\b/i],
  // Thailand said in passing — "hospitals in Thailand", "lived in Thailand 12 years" — is not a choice of cover
  ["ประเทศไทย", /thailand only|only (?:in |within )?thailand|just (?:in )?thailand|within thailand/i],
];

export function territoryNamedInEn(text: string): string | undefined {
  return TERRITORY_WORDS_EN.find(([, re]) => re.test(text))?.[0];
}

/** A plan by name, or by its yearly limit said in millions — "the 10 million one". */
export function planNamedInEn(text: string): string | undefined {
  const named = planNamedIn(text);
  if (named) return named;
  // written out: "70 M" is a seventy-year-old man before it is a seventy-million plan
  const m = text.match(/(\d+)\s*(?:million|mil)\b/i);
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
