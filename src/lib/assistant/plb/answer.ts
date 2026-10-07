import type { GuideItem } from "@/lib/copilot/guide";
import { pricePlan, readPlanAsk } from "@/lib/copilot/price";
import { writtenFor, type Channel } from "../channel";
import {
  aboutCompany, ageIn, asksAboutCompany, FORM_RECEIVED, handOverForm, HEALTH_DECLARATION, saysFormDone, saysUnwell,
  sexIn, stallReply, stalls, thanksOnly, THANKS_REPLY, wantsToBuy, type Reply,
} from "../common";
import { pricedAnswer } from "../priced";
import { asksWaiting, plbFaqAnswer, PLB_WAITING } from "./faq";

/** The plan code in the registry, and the name a customer reads on the card. */
export const PLB = "PLB";
export const PLB_LABEL = "Protection Life (PLB)";

/**
 * What this brain remembers between turns: who, how much, how long.
 *
 * The sum is what the family receives — this plan has no booster, so the two are one figure.
 * The term is a registry variant ("PLB10"); the cover runs exactly as long as it is paid.
 */
export interface PlbSlots {
  product: "plb";
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;
  variant?: string;
  /** the application form has gone, which the report counts and the bot does not repeat */
  formSent?: true;
}

export type PlbAnswer = Reply & { slots: PlbSlots; guide?: GuideItem[] };

/** Everything a quotation needs is held. */
function hasQuote(s: PlbSlots): boolean {
  return s.age !== undefined && s.sex !== undefined && s.sumAssured !== undefined && s.variant !== undefined;
}

/** A figure or a word for money: what makes a written question also a request to price. */
const ASKS_TO_PRICE = /\d|เบี้ย|ราคา|เท่าไ|ทุน/;

const OTHER_PERSON = "อีกท่านบอกได้เลยครับ เดี๋ยวคิดให้";

/**
 * One turn with Protection Life. Rule-only, like iShield and Legacy: every figure is the rate
 * table's, read through the same pricer the page and the website's inbox use, so a premium
 * cannot differ between doors.
 *
 * The checks are in order and the earlier one wins. What a customer says about their health,
 * the insurer, buying, thanks or thinking is answered before anything is priced, and a written
 * question from someone already quoted is answered alone — "สอบถามเงื่อนไข…" must not bring the
 * quotation back (Messenger, 2026-10-07).
 */
export function answerPlb(asked: string, previous: PlbSlots | null, channel: Channel = "web"): PlbAnswer {
  const slots: PlbSlots = { ...(previous ?? {}), product: "plb" };
  const said = (text: string) => writtenFor(channel, text);
  const one = (text: string, next: PlbSlots = slots): PlbAnswer => ({ messages: [{ text: said(text) }], slots: next });
  const quoted = hasQuote(slots);

  if (saysUnwell(asked)) {
    return one(asksWaiting(asked) ? `${HEALTH_DECLARATION}\n\n${PLB_WAITING}` : HEALTH_DECLARATION);
  }
  if (asksAboutCompany(asked)) return one(aboutCompany(asked));

  if (wantsToBuy(asked, quoted)) {
    const form = handOverForm(quoted);
    return { ...form, messages: form.messages.map((m) => ({ ...m, text: said(m.text) })), slots: { ...slots, formSent: true } };
  }
  if (slots.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), formDone: true };
  if (thanksOnly(asked)) return one(THANKS_REPLY);
  if (stalls(asked)) return one(stallReply(quoted));

  const faq = plbFaqAnswer(asked);
  if (faq && quoted && !ASKS_TO_PRICE.test(asked)) return one(faq);

  // what is said now wins; what is not said is kept
  const ask = readPlanAsk(asked, PLB);
  const person = ask.people[0];
  let age = person?.age ?? slots.age;
  let sex = person?.sex ?? slots.sex;
  if (!person) {
    // a lone age or sex answers the question it was asked; an age already held is replaced
    // only by one the customer wrote as an age
    // a bare "35" is not read as an age anywhere else, because on its own it could be a term or a
    // sum; here it is, but only as the whole message and only while no age is held
    const bare = /^\s*(\d{1,2})\s*$/.exec(asked);
    const loneAge = ageIn(asked) ?? (age === undefined && bare ? Number(bare[1]) : undefined);
    if (loneAge !== undefined && (age === undefined || /อายุ/.test(asked))) age = loneAge;
    const loneSex = sexIn(asked);
    if (loneSex && sex === undefined) sex = loneSex;
  }
  const sumAssured = ask.sum ?? slots.sumAssured;
  const variant = ask.variant ?? slots.variant;
  const next: PlbSlots = {
    product: "plb",
    ...(age !== undefined ? { age } : {}),
    ...(sex ? { sex } : {}),
    ...(sumAssured !== undefined ? { sumAssured } : {}),
    ...(variant ? { variant } : {}),
    ...(slots.formSent ? { formSent: true as const } : {}),
  };

  const priced = pricePlan(PLB, PLB_LABEL, {
    people: age !== undefined && sex ? [{ age, sex }] : [],
    sum: sumAssured,
    variant,
  });
  const answer = pricedAnswer(priced, channel);
  const messages = [
    // a written question that came with the figures is answered after the quotation
    ...(faq && !priced.priced ? [{ text: said(faq) }] : []),
    ...answer.messages,
    ...(faq && priced.priced ? [{ text: said(faq) }] : []),
    ...(priced.priced && ask.people.length > 1 ? [{ text: said(OTHER_PERSON) }] : []),
  ];
  const guide = answer.guide;
  return {
    messages,
    priced: answer.priced,
    ...(guide?.length ? { guide, replies: guide.map((g) => g.label) } : {}),
    slots: next,
  };
}
