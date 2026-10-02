import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import { keepGivenFigures, one, recentTurns, spoken, type Reply } from "../common";
import type { HealthAnswer } from "../ihealthy/answer";
import { hasHealthQuote } from "../ihealthy/quote";
import { asksForPicture, asksShareOfBill, type HealthSlots } from "../ihealthy/route";
import { healthFaqAnswerEn } from "./faq";
import { HEALTH_PLAN_INFO_SYSTEM_EN, HEALTH_SMALL_TALK_SYSTEM_EN, healthFactsForEn } from "./prompts";
import {
  cheaperEn, fullTableLinkEn, healthMenuEn, healthQuoteEn, otherPlansEn, territoryAnswerEn,
} from "./quote";
import { planNamedInEn, routeHealthEn, territoryNamedInEn } from "./route";
import {
  APPLY_HAND_OVER_EN, ASK_AGE_EN, ASK_DETAILS_EN, ASK_SEX_EN, COMPANY_EN, FORM_DONE_EN, GREETING_EN,
  HAND_OVER_EN, PLAN_BENEFITS_EN, SEE_OTHER_PLANS_EN, SHARE_OF_BILL_EN, STALL_EN, WANTS_IN_EN,
} from "./words";

/**
 * The health brain for a customer writing English on an Expat Page.
 *
 * The Thai brain's order of checks (ihealthy/answer.ts), kept: everything answerable from the
 * engine or a written sentence is answered before a model is paid, and the model never words
 * a premium.
 */

const STALLS = /think (?:about|it over)|later|not now|maybe next|no thanks|get back to you|let me check/i;
const ASKS = /\?|\b(?:what|how|when|which|where|why|does|do|is|can|could)\b/i;
const BUYS = /\bapply\b|sign (?:me )?up|\bbuy\b|purchase|proceed|go ahead|i(?:'| a)m in|let'?s do it|how (?:do|can) i (?:get|start|apply)/i;
const NOT_BUYING = /claim|cancel|refund|renew/i;
const FORM_DONE = /\b(?:done|filled|submitted|completed)\b|sent (?:it|them|the form)/i;
const COMPANY = /which company|who is the insurer|what company|insurance company|is this legit|are you (?:licensed|real)/i;
const GROUP = /my (?:company|employees|staff|team)|for (?:my )?(?:employees|staff)|group (?:insurance|cover|policy)|corporate/i;
const GREETS = /^\s*(?:hi|hello|hey|good (?:morning|afternoon|evening))\b|more information|more info|learn more|get (?:a )?quote|interested|tell me more/i;
const OTHER_PLANS = /other plans?|what else|more plans|another plan/i;
const CHEAPER = /expensive|cheaper|lower (?:price|premium)|discount|too much|over (?:my )?budget|can'?t afford/i;
const FULL_TABLE = /full (?:benefit )?table|all (?:the )?benefits|full details|complete table/i;

function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

function askForMissing(slots: HealthSlots): string {
  if (slots.age === undefined && slots.sex !== undefined) return ASK_AGE_EN;
  if (slots.sex === undefined && slots.age !== undefined) return ASK_SEX_EN;
  return ASK_DETAILS_EN;
}

export async function answerHealthEn(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthAnswer> {
  const asked = lastAsked(history).trim();
  const known: HealthSlots = { ...(previous ?? { product: "ihealthy", intent: "other" }), lang: "en" };
  const quoted = hasHealthQuote(known);

  if (STALLS.test(asked) && !ASKS.test(asked)) return { ...one(STALL_EN), slots: known };
  if (known.formSent && FORM_DONE.test(asked)) return { ...one(FORM_DONE_EN), slots: known };
  if (asked === WANTS_IN_EN || (BUYS.test(asked) && !NOT_BUYING.test(asked))) {
    return { ...one(APPLY_HAND_OVER_EN), slots: { ...known, formSent: true } };
  }
  if (GROUP.test(asked)) return { ...one(HAND_OVER_EN), slots: known };
  if (COMPANY.test(asked)) return { ...one(COMPANY_EN), slots: known };
  const faq = healthFaqAnswerEn(asked);
  if (faq) return { ...one(faq), slots: known };
  if (asksShareOfBill(asked)) return { ...one(SHARE_OF_BILL_EN), slots: known };

  // the advertisement's button, or a hello: a question back, not a description of the contract
  if (GREETS.test(asked) && planNamedInEn(asked) === undefined) {
    return known.age !== undefined && known.sex !== undefined
      ? { ...healthMenuEn(known.age, known.sex), slots: known }
      : { ...one(GREETING_EN), slots: known };
  }

  if (known.age !== undefined && known.sex !== undefined) {
    const who = { ...known, age: known.age, sex: known.sex as Sex };
    if (asksForPicture(asked)) {
      return known.plan
        ? { ...healthQuoteEn({ ...who, plan: known.plan }), slots: known }
        : { ...healthMenuEn(who.age, who.sex), slots: known };
    }
    if (FULL_TABLE.test(asked)) return { ...fullTableLinkEn(who), slots: known };
    if (asked === SEE_OTHER_PLANS_EN || OTHER_PLANS.test(asked)) {
      return { ...otherPlansEn(who.age, who.sex), slots: known };
    }
    if (CHEAPER.test(asked)) return { ...cheaperEn(who.age, who.sex, known.plan), slots: known };
    const wanted = territoryNamedInEn(asked);
    if (wanted && known.plan) return territoryAnswerEn({ ...who, plan: known.plan }, wanted);
  }

  const slots = await routeHealthEn(history, previous ? { ...previous, lang: "en" } : null);

  if (asked === PLAN_BENEFITS_EN || slots.intent === "plan_info") {
    return { ...(await planInfo(history, slots)), slots };
  }
  if (slots.age === undefined || slots.sex === undefined) return { ...one(askForMissing(slots)), slots };
  // a plan is quoted when asked for — named now, changed, or never quoted — as in the Thai brain
  if (slots.plan) {
    const asking = planNamedInEn(asked) !== undefined || slots.plan !== known.plan || !quoted;
    if (asking) {
      return { ...healthQuoteEn({ ...slots, age: slots.age, sex: slots.sex, plan: slots.plan }), slots };
    }
    return { ...(await planInfo(history, slots)), slots };
  }
  if (slots.intent === "quote") return { ...healthMenuEn(slots.age, slots.sex), slots };
  return { ...(await smallTalk(history, slots)), slots };
}

async function planInfo(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${HEALTH_PLAN_INFO_SYSTEM_EN}${healthFactsForEn(slots)}` },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "plan_info_health_en", maxTokens: 400, messages });
  return modelWrote(r, messages);
}

async function smallTalk(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${HEALTH_SMALL_TALK_SYSTEM_EN}${healthFactsForEn(slots)}` },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "small_talk_health_en", maxTokens: 200, messages });
  return modelWrote(r, messages);
}

/** A model's words, with any line carrying a figure it was not shown taken out. */
function modelWrote(r: { text: string; model: string }, shown: ChatMessage[]): Reply {
  const text = keepGivenFigures(r.text.trim(), shown.map((m) => m.content).join("\n"), ASK_DETAILS_EN);
  return { ...spoken(text, ASK_DETAILS_EN), writtenBy: r.model };
}
