import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import { hospitalReply } from "../hospitals";
import { APPLICATION_FORM, keepGivenFigures, one, recentTurns, spoken, type Reply, type Said } from "../common";
import type { HealthAnswer } from "../ihealthy/answer";
import { hasHealthQuote } from "../ihealthy/quote";
import { asksForPicture, asksShareOfBill, type HealthSlots } from "../ihealthy/route";
import { exclusionsLineEn, faqFor, HEALTH } from "./faq";
import { HEALTH_PLAN_INFO_SYSTEM_EN, HEALTH_SMALL_TALK_SYSTEM_EN, healthFactsForEn } from "./prompts";
import {
  cheaperEn, fullTableEn, healthMenuEn, healthQuoteEn, otherPlansEn, territoryAnswerEn,
} from "./quote";
import { personInEn, planNamedInEn, routeHealthEn, territoryNamedInEn } from "./route";
import { COMPANY, premiumByAgeEn, topicAnswer, topicsIn, type Asked } from "./topics";
import { noteAfterAnswer } from "../unanswered";
import {
  APPLY_AGAIN_EN, APPLY_STEPS_EN, ASK_AGE_EN, CHECK_REST_EN, FULL_TABLE_EN, ASK_DETAILS_EN, ASK_SEX_EN, CHECK_PREMIUMS_EN, COMPANY_EN, FORM_DONE_EN, GREETING_EN,
  FORM_NEXT_EN, HAND_OVER_EN, HEALTH_THANKS_EN, PLAN_BENEFITS_EN, PREMIUM_FIRST_EN, SEE_OTHER_PLANS_EN, SHARE_OF_BILL_EN, STALL_EN, WANTS_IN_EN,
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
/**
 * Deciding to apply, said as a decision. Not "can foreigners buy this?", not "can I apply with
 * diabetes?", not "does the waiting period apply?" — the Thai list leaves out ซื้อได้ไหม for
 * the same reason, and a question answered with a hand-over is a question not answered.
 */
const BUYS = /\bi(?:'d| would)? (?:like|want) to (?:apply|buy|sign up|purchase|get (?:it|this|covered))|sign me up|let'?s (?:do it|go ahead|apply)|^\s*(?:ok(?:ay)?,?\s*)?go ahead\b|i'?ll take (?:it|this|the \w+)|^\s*(?:ok(?:ay)?,?\s*)?i(?:'| a)m in\s*[.!]*\s*$|how (?:do|can) i (?:apply|sign up)|^\s*apply(?: now)?\s*[.!]*\s*$|steps? to apply|how to apply|apply(?:ing)? please|application (?:steps|form|process)|send (?:me )?the (?:application )?form/i;
const NOT_BUYING = /claim|cancel|refund|renew/i;
const FORM_DONE = /\b(?:done|filled|submitted|completed)\b|sent (?:it|them|the form)/i;
const GROUP = /my (?:company|employees|staff|team)|for (?:my )?(?:employees|staff)|group (?:insurance|cover|policy)|corporate/i;
const GREETS = /^\s*(?:hi|hello|hey|good (?:morning|afternoon|evening))\b|more information|more info|learn more|get (?:a )?quote|interested|tell me more/i;
const OTHER_PLANS = /other plans?|what else|more plans|another plan/i;
const CHEAPER = /expensive|cheaper|lower (?:price|premium)|discount|too much|over (?:my )?budget|can'?t afford/i;
const FULL_TABLE = /full (?:benefit )?table|benefits? table|all (?:the )?benefits|full details|complete table/i;

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
  // asked last turn which province; the question holds for this message only
  const awaitingProvince = known.hospitalAsked === true;
  delete known.hospitalAsked;
  const quoted = hasHealthQuote(known);

  if (STALLS.test(asked) && !ASKS.test(asked)) return { ...one(STALL_EN), slots: known };
  if (known.formSent && FORM_DONE.test(asked)) return { ...one(FORM_DONE_EN), slots: known };
  // a message carrying a person is a quotation being asked for, as in the Thai `wantsToBuy`
  const buys = BUYS.test(asked) && !NOT_BUYING.test(asked) && personInEn(asked).age === undefined;
  if (asked === WANTS_IN_EN || buys) {
    // the form has gone already: pointed back to it, not sent the same steps again
    if (known.formSent) return { ...one(APPLY_AGAIN_EN), slots: known };
    // the Thai brain's handOverForm, in English: the steps, the form, and what happens next
    const next = quoted ? FORM_NEXT_EN : `${FORM_NEXT_EN} ${PREMIUM_FIRST_EN}`;
    return {
      messages: [{ text: APPLY_STEPS_EN }, { text: APPLICATION_FORM }, { text: next }],
      slots: { ...known, formSent: true },
    };
  }
  /**
   * The advertisement's "Check insurance premiums" button: the premium, or the two things it
   * needs. Answered here, before any model reads it — a model read "other" for a customer
   * already known and rambled instead of showing the table (probe, 2026-10-03). It also
   * leaves the health question: pressing a button is not answering it.
   */
  if (asked.toLowerCase() === CHECK_PREMIUMS_EN.toLowerCase()) {
    const onward = { ...known };
    delete onward.healthAsked;
    return onward.age !== undefined && onward.sex !== undefined
      ? { ...healthMenuEn(onward.age, onward.sex), slots: onward }
      : { ...one(ASK_DETAILS_EN), slots: onward };
  }
  /**
   * The reply to the health answer's question: their condition, treatment and medication.
   * Thanked and left for the agent, once — not met with the same answer asking for it again,
   * which is what the word "diabetes" in it would otherwise get.
   */
  // a message asking several things is answered for each of them (./topics.ts)
  const asks = topicsIn(asked, awaitingProvince);
  const many = asks.topics.length >= 2;

  if (known.healthAsked && !many) {
    const told = HEALTH.test(asked) || !ASKS.test(asked);
    const somethingElse = planNamedInEn(asked) !== undefined || personInEn(asked).age !== undefined;
    const onward = { ...known };
    delete onward.healthAsked;
    if (told && !somethingElse) return { ...one(HEALTH_THANKS_EN), slots: onward };
    delete known.healthAsked;
  }
  if (GROUP.test(asked)) return { ...one(HAND_OVER_EN), slots: known };
  if (many) return manyAnswers(asked, asks, known, awaitingProvince);
  if (COMPANY.test(asked)) return { ...one(COMPANY_EN), slots: known };
  const faq = faqFor(asked);
  if (faq) {
    const said = personInEn(asked);
    const age = said.age ?? known.age;
    const sex = said.sex ?? known.sex;
    if (faq.key === "rises") {
      // today's rates at older ages, once there is a person to price (owner chose ข, 2026-11-23)
      const figures = sex ? premiumByAgeEn({ age, sex, plan: known.plan, asked }) : undefined;
      return figures
        ? { ...one(figures), slots: known }
        : { ...one(`${faq.answer()}\nTell me your age and gender and I'll show you the premium at each age.`), slots: known };
    }
    if (faq.key === "documents") {
      // the list of exclusions is the agent's to send: written down so somebody does
      noteAfterAnswer({ question: asked, route: "brain", product: "ihealthy" });
      if (age !== undefined && sex !== undefined) {
        const sheet = fullTableEn({ ...known, age, sex });
        const [first, ...rest] = sheet.messages;
        return { ...sheet, messages: [{ ...first, text: `${FULL_TABLE_EN}\n${exclusionsLineEn()}` }, ...rest], slots: { ...known, age, sex } };
      }
    }
    const slots: HealthSlots = faq.key === "health" ? { ...known, healthAsked: true }
      : faq.key === "direct" ? { ...known, hospitalAsked: true }
        : known;
    return { ...one(faq.answer()), slots };
  }
  // where cover can be used: Krungthai-AXA's own list, never a model's idea of it
  const hospitals = hospitalReply(asked, "en", awaitingProvince);
  if (hospitals) {
    return { ...one(hospitals.text), slots: hospitals.asksProvince ? { ...known, hospitalAsked: true } : known };
  }
  if (asksShareOfBill(asked)) return { ...one(SHARE_OF_BILL_EN), slots: known };

  // the advertisement's button, or a hello: a question back, not a description of the contract
  // only a bare hello: one that carries a person, a plan or a question is answered for those
  const person = personInEn(asked);
  const bare = person.age === undefined && person.sex === undefined
    && planNamedInEn(asked) === undefined && !ASKS.test(asked);
  if (GREETS.test(asked) && bare) {
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
    if (FULL_TABLE.test(asked)) return { ...fullTableEn(who), slots: known };
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
    // a corrected age or sex re-prices the plan on the table, or hands over when out of range
    const asking = planNamedInEn(asked) !== undefined || slots.plan !== known.plan || !quoted
      || slots.age !== known.age || slots.sex !== known.sex;
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

/** How many subjects are answered in words in one reply; the rest are the agent's. */
const MAX_WORDED = 5;
/** Messenger's limit is 2,000 characters a message; a reply longer than this is sent in two. */
const MAX_TEXT = 1900;
const WHICH_PLAN_EN = "Which plan would you like to look at?";

/**
 * One reply to a message that asks several things (owner, 2026-11-23): each subject answered in
 * the words it gets alone, five at most; the person priced when the message says who they are;
 * the premium at older ages and the benefit table as their own messages, as figures and a file
 * always are; and the questions there is no written answer for left to the agent, said so.
 */
function manyAnswers(asked: string, asks: Asked, known: HealthSlots, awaitingProvince: boolean): HealthAnswer {
  const said = personInEn(asked);
  const age = said.age ?? known.age;
  const sex = said.sex ?? known.sex;
  const slots: HealthSlots = { ...known, ...(age !== undefined ? { age } : {}), ...(sex !== undefined ? { sex } : {}) };
  const items: string[] = [];
  const figures: Said[] = [];
  const left = [...asks.unknown];
  let sheet = false;

  for (const topic of asks.topics) {
    if (topic.key === "rises" && sex !== undefined) {
      const text = premiumByAgeEn({ age, sex, plan: slots.plan, asked: topic.segment });
      if (text) {
        figures.push({ text });
        continue;
      }
    }
    if (topic.key === "documents") {
      noteAfterAnswer({ question: topic.segment, route: "brain", product: "ihealthy" });
      if (age !== undefined && sex !== undefined) {
        sheet = true;
        continue;
      }
    }
    if (items.length >= MAX_WORDED) {
      left.push(topic.segment);
      continue;
    }
    const answer = topicAnswer(topic, awaitingProvince);
    if (!answer) {
      left.push(topic.segment);
      continue;
    }
    // asked what it will cost later, with no person to price: asked who they are
    const ask = topic.key === "rises" && sex === undefined ? " Tell me your age and gender and I'll show you the premium at each age." : "";
    items.push(`${answer.label}\n${answer.text}${ask}`);
    if (answer.asksProvince) slots.hospitalAsked = true;
    if (topic.key === "health") slots.healthAsked = true;
  }
  for (const question of left) noteAfterAnswer({ question, route: "brain", product: "ihealthy" });

  const intro = said.age !== undefined || said.sex !== undefined
    ? "Thanks for the details! Here are your answers 🙏"
    : "Thanks for your questions! Here are the answers 🙏";
  const tail = left.length ? [CHECK_REST_EN] : [];
  const blocks = [intro, ...items, ...tail];
  const messages: Said[] = [];
  let current = "";
  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (current && next.length > MAX_TEXT) {
      messages.push({ text: current });
      current = block;
    } else current = next;
  }
  if (current) messages.push({ text: current });

  let replies: string[] | undefined;
  const known2 = age !== undefined && sex !== undefined;
  const quotedThem = hasHealthQuote(known) && known.age === age && known.sex === sex;
  if (known2 && !quotedThem) {
    const menu = healthMenuEn(age, sex as Sex);
    messages.push(...menu.messages);
    replies = menu.replies;
  }
  messages.push(...figures);
  if (sheet && known2) {
    const table = fullTableEn({ ...slots, age, sex: sex as Sex });
    messages.push(...table.messages.map((m) => ({ ...m, text: `${FULL_TABLE_EN}\n${exclusionsLineEn()}` })));
    replies ??= table.replies;
  }
  const last = messages[messages.length - 1];
  if (replies && known2 && !quotedThem) last.text = `${last.text}\n\n${WHICH_PLAN_EN}`;
  else if (!known2 && !slots.healthAsked) last.text = `${last.text}\n\n${ASK_DETAILS_EN}`;
  return { messages, ...(replies ? { replies } : {}), slots };
}
