import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { assembleKnowledge } from "@/lib/copilot/knowledge";
import type { Sex } from "@/calc/types";
import { planLabel } from "@/lib/ihealthy-facts";
import { queryFrom } from "@/lib/ihealthy-link";
import { plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { siteUrl } from "@/lib/site-url";
import {
  WANTS_IN, aboutCompany, affirms, asksAboutCompany, asksCheaper, handOverForm, keepGivenFigures, one,
  recentTurns, saysFormDone, spoken, stallReply, stalls, wantsToBuy, type Reply,
} from "../common";
import { CHOOSE_HEALTH } from "../choose";
import { healthFaqAnswer } from "./faq";
import { hospitalReply } from "../hospitals";
import { healthMenu, otherPlansReply } from "./menu";
import { HEALTH_PLAN_INFO_SYSTEM, HEALTH_SMALL_TALK_SYSTEM, healthFactsFor } from "./prompts";
import {
  HEALTH_HAND_OVER, SEE_OTHER_PLANS, THIS_PLAN_BENEFITS, arrangementFor, hasHealthQuote, healthQuote,
} from "./quote";
import {
  asksForPicture, asksFullTable, asksOtherPlans, asksShareOfBill, planNamedIn, routeHealth, territoryNamedIn,
  type HealthSlots,
} from "./route";

/** One answer from the health brain, and what it should remember next turn. */
export type HealthAnswer = Reply & { slots: HealthSlots };

const ASK_FOR_DETAILS = 'ขออายุกับเพศหน่อยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "หญิง 35")';

/**
 * What is still needed, named one field at a time. A bot that asks again for something the
 * customer has already given reads as one that did not listen.
 */
function askForMissing(slots: HealthSlots): string {
  const missing: string[] = [];
  if (slots.age === undefined) missing.push("อายุ");
  if (slots.sex === undefined) missing.push("เพศ");
  if (missing.length !== 1) return ASK_FOR_DETAILS;
  const example = missing[0] === "อายุ" ? "35" : "หญิง";
  return `ขอ${missing[0]}ด้วยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "${example}")`;
}

/**
 * The two arrangements that lower the premium by moving part of the bill to the customer.
 *
 * Described and not priced: both are sold in Thailand only and neither is quoted in this chat,
 * so the honest answer names them and hands the figure to someone who will work it out.
 */
const SHARE_OF_BILL_ANSWER =
  "มีทั้งแบบมีความรับผิดส่วนแรกและแบบร่วมจ่ายครับ เบี้ยถูกลงพอสมควร แลกกับที่เราออกค่ารักษาส่วนแรกเอง\n"
  + `สองแบบนี้บริษัทขายเฉพาะประเทศไทยครับ ส่วนตัวเลข ${HEALTH_HAND_OVER}`;

/** What the customer said this turn. */
function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

/**
 * The health brain.
 *
 * Everything answerable from the engine or from a written sentence is answered before a model
 * is paid for anything, and the model is never asked to word a premium — the order of the
 * checks below is the whole of that guarantee.
 */
export async function answerHealth(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthAnswer> {
  const asked = lastAsked(history);
  const known: HealthSlots = { ...(previous ?? { product: "ihealthy", intent: "other" }) };
  // asked last turn which province; the question holds for this message only
  const awaitingProvince = known.hospitalAsked === true;
  delete known.hospitalAsked;
  const quoted = hasHealthQuote(known);

  // leaving to think it over needs no model and changes nothing the bot knows
  if (stalls(asked)) return { ...one(stallReply(quoted)), slots: known };
  // the form is out and they say it is filled in: the agent takes it from here
  if (known.formSent && saysFormDone(asked)) {
    return { ...one("ขอบคุณครับ 🙏 เดี๋ยวแอดมินเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ"), slots: known };
  }
  if (wantsToBuy(asked, quoted) && !affirms(asked)) {
    return { ...handOverForm(quoted), slots: { ...known, formSent: true } };
  }
  // a question about the company is answered by the agency's own sentence, whatever else the
  // turn was about
  if (asksAboutCompany(asked)) return { ...one(aboutCompany(asked)), slots: known };
  // one of the answers the agency writes out by hand: the declaration, the tax relief, the
  // rising premium, the waiting periods
  const faq = healthFaqAnswer(asked);
  if (faq) return { ...one(faq), slots: known };
  // which hospitals: Krungthai-AXA's own list (../hospitals), answered in its fixed words
  const hospitals = hospitalReply(asked, "th", awaitingProvince);
  if (hospitals) {
    return { ...one(hospitals.text), slots: hospitals.asksProvince ? { ...known, hospitalAsked: true } : known };
  }
  if (asksShareOfBill(asked)) return { ...one(SHARE_OF_BILL_ANSWER), slots: known };

  /**
   * The customer tapped the button that got them here, and it says nothing but the product's
   * name. Left to the model it reads as a request for a description of the contract, and the
   * first thing the advert paid for is three bubbles about renewal ages where a question was
   * wanted. It is a button title like the others, so it is answered like the others.
   */
  if (asked === CHOOSE_HEALTH) {
    return known.age !== undefined && known.sex !== undefined
      ? { ...healthMenu(known.age, known.sex), slots: known }
      : { ...one(askForMissing(known)), slots: known };
  }

  if (known.age !== undefined && known.sex !== undefined) {
    const who = { ...known, age: known.age, sex: known.sex };
    /**
     * A picture asked for by name, before the sheet is considered.
     *
     * Where a plan is already on the table the quotation is redrawn, because that is the
     * picture that conversation is about; otherwise it is the plans side by side. Either way
     * the answer is a picture, which is what was asked for — and never the model, which does
     * not know these exist and has said so to a customer.
     */
    if (asksForPicture(asked)) {
      return known.plan
        ? { ...healthQuote({ ...who, plan: known.plan }), slots: known }
        : { ...healthMenu(who.age, who.sex), slots: known };
    }
    if (asksFullTable(asked)) return { ...fullTableLink(who), slots: known };
    if (asksOtherPlans(asked) || asked === SEE_OTHER_PLANS) {
      return { ...otherPlansReply(who.age, who.sex), slots: known };
    }
    if (asksCheaper(asked)) return { ...cheaper(who.age, who.sex, known.plan), slots: known };
    // a territory named while a plan is on the table either re-prices it or is turned down
    const wanted = territoryNamedIn(asked);
    if (wanted && known.plan) return territoryAnswer({ ...who, plan: known.plan }, wanted);
  }

  const slots = await routeHealth(history, previous);

  if (asked === THIS_PLAN_BENEFITS || slots.intent === "plan_info") {
    return { ...(await planInfo(history, slots)), slots };
  }
  if (slots.age === undefined || slots.sex === undefined) {
    return { ...one(askForMissing(slots)), slots };
  }
  /**
   * A plan is quoted when the customer has asked to be: they named one this turn, they picked
   * a different one, or they have not been quoted at all yet.
   *
   * Not merely because a plan is in the slots. The model is handed the conversation and hands
   * the plan back with it, so "OPD ได้ไหม" three messages after a quotation came back as the
   * whole quotation again, card and all — the same thing the life brain did when asked how
   * long the premium ran.
   */
  if (slots.plan) {
    const asking = planNamedIn(asked) !== undefined
      || slots.plan !== known.plan
      || !hasHealthQuote(known);
    if (asking) {
      return { ...healthQuote({ ...slots, age: slots.age, sex: slots.sex, plan: slots.plan }), slots };
    }
    return { ...(await planInfo(history, slots)), slots };
  }
  if (slots.intent === "quote") return { ...healthMenu(slots.age, slots.sex), slots };
  return { ...(await smallTalk(history, slots)), slots };
}

/**
 * The plan one step down, named rather than priced again.
 *
 * The cheapest plan has nothing under it, and saying so is better than offering the same plan
 * back — what is left after that is the two ways of sharing the bill, which is what this says
 * instead.
 */
function cheaper(age: number, sex: Sex, plan?: string): Reply {
  if (!plan) return healthMenu(age, sex);
  const table = iHealthyTable();
  const sellable = plansFor(table, age).map((p) => p.code);
  const below = sellable.slice(0, sellable.indexOf(plan));
  if (below.length === 0) {
    return one(`แผน ${planLabel(plan)} เป็นแผนที่เบี้ยถูกที่สุดของสัญญานี้แล้วครับ\n${SHARE_OF_BILL_ANSWER}`);
  }
  const next = below[below.length - 1];
  return {
    ...one(`ถ้าอยากให้เบาลง มีแผน ${planLabel(next)} ครับ วงเงินน้อยกว่าแต่เบี้ยถูกกว่า อยากดูราคาไหมครับ`),
    replies: [planLabel(next), SEE_OTHER_PLANS],
  };
}

/** A territory re-prices the plan, or is turned down by name with the plans that do sell it. */
function territoryAnswer(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, wanted: string,
): HealthAnswer {
  const table = iHealthyTable();
  if (territoriesFor(table, slots.plan, slots.age).includes(wanted)) {
    const next = { ...slots, territory: wanted };
    return { ...healthQuote(next), slots: next };
  }
  const sold = plansFor(table, slots.age)
    .map((p) => p.code)
    .filter((code) => territoriesFor(table, code, slots.age).includes(wanted));
  if (sold.length === 0) {
    return { ...one(`อาณาเขต${wanted} สัญญานี้ไม่มีให้เลือกครับ ${HEALTH_HAND_OVER}`), slots };
  }
  return {
    ...one(`อาณาเขต${wanted} บริษัทเขียนไว้เฉพาะแผน ${sold.map(planLabel).join(" กับแผน ")} ครับ อยากดูราคาแผนไหนบอกได้เลย`),
    replies: sold.map(planLabel),
    slots,
  };
}

/**
 * The whole benefit sheet runs to twenty-eight categories; a picture of it is a document. The
 * page already draws it, so the customer is sent there with their own arrangement filled in.
 */
function fullTableLink(slots: HealthSlots & { age: number; sex: Sex }): Reply {
  const table = iHealthyTable();
  const sellable = plansFor(table, slots.age).map((p) => p.code);
  const plan = slots.plan && sellable.includes(slots.plan) ? slots.plan : sellable[sellable.length - 1];
  const query = queryFrom(table, arrangementFor({
    age: slots.age, sex: slots.sex, plan, territory: slots.territory,
  }));
  return {
    messages: [
      { text: "ตารางผลประโยชน์เต็มทุกหมวดอยู่ในหน้านี้ครับ เปิดมาจะกรอกอายุกับแผนไว้ให้แล้ว" },
      { text: siteUrl(`/ihealthy-ultra?${query}`) },
    ],
    replies: [SEE_OTHER_PLANS, WANTS_IN],
  };
}

async function planInfo(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  // the health sheet for the contract in hand, and the library for everything else — see the
  // note on the life brain's own plan_info for why both travel
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${HEALTH_PLAN_INFO_SYSTEM}${healthFactsFor(slots)}\n\n---\n\n${await assembleKnowledge(asked)}`,
    },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "plan_info_health", maxTokens: 400, messages });
  return modelWrote(r, messages);
}

async function smallTalk(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${HEALTH_SMALL_TALK_SYSTEM}${healthFactsFor(slots)}` },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "small_talk_health", maxTokens: 200, messages });
  return modelWrote(r, messages);
}

/**
 * A model's words, checked for baht figures it was not shown and signed with its name — see
 * the life brain's `modelWrote`, and `keepGivenFigures` (review 2026-10-01).
 */
function modelWrote(r: { text: string; model: string }, shown: ChatMessage[]): Reply {
  const text = keepGivenFigures(r.text.trim(), shown.map((m) => m.content).join("\n"), ASK_FOR_DETAILS);
  return { ...spoken(text, ASK_FOR_DETAILS), writtenBy: r.model };
}
