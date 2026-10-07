import type { GuideItem } from "@/lib/copilot/guide";
import { pricePlan, readPlanAsk } from "@/lib/copilot/price";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { plbTable } from "@/lib/plb-table";
import { writtenFor, type Channel } from "../channel";
import { CHOOSE_LIFE } from "../choose";
import {
  aboutCompany, ageIn, ASKS_SOMETHING, asksAboutCompany, asksAboutMoney, FORM_RECEIVED, handOverForm, HEALTH_DECLARATION,
  saysFormDone, saysUnwell, sexIn, stallReply, stalls, thanksOnly, THANKS_REPLY, wantsToBuy, type Reply,
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
  /**
   * The last quotation came back with a price. Four slots held is not a quotation held: a sum
   * the engine refused leaves all four, and "ตกลง" after it must not be taken as a yes.
   */
  priced?: true;
  /** the application form has gone, which the report counts and the bot does not repeat */
  formSent?: true;
}

export type PlbAnswer = Reply & {
  slots: PlbSlots;
  guide?: GuideItem[];
  /**
   * A question about the plan this brain has no sentence for, which the dispatcher may put to
   * the library (as it was answered before PLB had a brain). The reply here is the fallback.
   */
  libraryQuestion?: true;
};

/** A quotation is held: it was priced, and everything it was priced on is still held. */
function hasQuote(s: PlbSlots): boolean {
  return s.priced === true && s.age !== undefined && s.sex !== undefined && s.sumAssured !== undefined && s.variant !== undefined;
}

const OTHER_PERSON = "อีกท่านบอกได้เลยครับ เดี๋ยวคิดให้";
const CHANGE_SOMETHING = "ได้เลยครับ ถ้าอยากดูทุนหรือระยะชำระเบี้ยอื่น กดปุ่มหรือพิมพ์บอกได้เลยครับ";
/** a bare "สนใจ": taking up what the quotation offered, which is the form */
const INTERESTED = /^\s*สนใจ(?:ครับ|ค่ะ|คะ|เลย)*\s*$/;
/** the PLB page's own message for someone past the last age it issues at */
const OVER_AGE = /อายุเกิน\s*\d+/;

/**
 * One turn with Protection Life. Rule-only, like iShield and Legacy: every figure is the rate
 * table's, read through the same pricer the page and the website's inbox use, so a premium
 * cannot differ between doors.
 *
 * The checks are in order and the earlier one wins. What a customer says about their health,
 * the insurer, buying, thanks or thinking is answered before anything is priced. Once a
 * quotation is held it is priced again only when the customer changes who, how much or how
 * long: "โอเคครับ" and "สอบถามเงื่อนไขเพิ่มเติมครับ" are not requests for it (Messenger,
 * 2026-10-07).
 */
export function answerPlb(asked: string, previous: PlbSlots | null, channel: Channel = "web"): PlbAnswer {
  const slots: PlbSlots = { ...(previous ?? {}), product: "plb" };
  const said = (text: string) => writtenFor(channel, text);
  const one = (text: string, next: PlbSlots = slots): PlbAnswer => ({ messages: [{ text: said(text) }], slots: next });
  const quoted = hasQuote(slots);
  const question = ASKS_SOMETHING.test(asked) && !asksAboutMoney(asked);

  if (saysUnwell(asked)) {
    return one(asksWaiting(asked) ? `${HEALTH_DECLARATION}\n\n${PLB_WAITING}` : HEALTH_DECLARATION);
  }
  if (asksAboutCompany(asked)) return one(aboutCompany(asked));

  if (wantsToBuy(asked, quoted) || (quoted && INTERESTED.test(asked))) {
    const form = handOverForm(quoted);
    return { ...form, messages: form.messages.map((m) => ({ ...m, text: said(m.text) })), slots: { ...slots, formSent: true } };
  }
  if (slots.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), formDone: true };
  if (thanksOnly(asked)) return one(THANKS_REPLY);
  if (stalls(asked)) return one(stallReply(quoted));

  if (OVER_AGE.test(asked)) {
    const { ageMin, ageMax } = plbTable();
    return {
      ...one(`Protection Life รับอายุ ${ageMin}-${ageMax} ปีครับ ถ้าอายุเกินนั้น Life Protect รับถึงอายุ ${lifeProtectFacts().ageMax} ปี `
        + "เดี๋ยวคิดให้ได้เลย กดปุ่มข้างล่างแล้วบอกเพศกับอายุมาได้เลยครับ"),
      replies: [CHOOSE_LIFE],
    };
  }

  const faq = plbFaqAnswer(asked, slots.variant);

  // what is said now wins; what is not said is kept
  const ask = readPlanAsk(asked, PLB);
  const person = ask.people[0];
  let age = person?.age ?? slots.age;
  let sex = person?.sex ?? slots.sex;
  if (!person) {
    // a bare "35" is not read as an age anywhere else, because on its own it could be a term or a
    // sum; here it is, but only as the whole message and only while no age is held
    const bare = /^\s*(\d{1,2})\s*$/.exec(asked);
    const loneAge = ageIn(asked) ?? (age === undefined && bare ? Number(bare[1]) : undefined);
    if (loneAge !== undefined && (age === undefined || /อายุ/.test(asked))) age = loneAge;
    // a sex said on its own is a change: "ถ้าเป็นผู้หญิงล่ะ" is the same cover for a woman
    const loneSex = sexIn(asked);
    if (loneSex) sex = loneSex;
  }
  const sumAssured = ask.sum ?? slots.sumAssured;
  const variant = ask.variant ?? slots.variant;
  const changed = age !== slots.age || sex !== slots.sex || sumAssured !== slots.sumAssured || variant !== slots.variant;

  const gaps = () => pricePlan(PLB, PLB_LABEL, {
    people: age !== undefined && sex ? [{ age, sex }] : [],
    sum: sumAssured,
    variant,
  });
  const withButtons = (answer: PlbAnswer): PlbAnswer => {
    const guide = gaps().guide;
    return guide?.length ? { ...answer, guide, replies: guide.map((g) => g.label) } : answer;
  };

  // a quotation is held and the customer changed nothing: say what they asked, or say what can be changed
  if (quoted && !changed) {
    if (faq) return withButtons(one(faq));
    const short = withButtons(one(CHANGE_SOMETHING));
    return question ? { ...short, libraryQuestion: true } : short;
  }

  const priced = gaps();
  const answer = pricedAnswer(priced, channel);
  const next: PlbSlots = {
    product: "plb",
    ...(age !== undefined ? { age } : {}),
    ...(sex ? { sex } : {}),
    ...(sumAssured !== undefined ? { sumAssured } : {}),
    ...(variant ? { variant } : {}),
    ...(priced.priced ? { priced: true as const } : {}),
    ...(slots.formSent ? { formSent: true as const } : {}),
  };
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
    // nothing was read from this message and it asks about the plan: the library may know
    ...(!changed && question && !faq ? { libraryQuestion: true as const } : {}),
    slots: next,
  };
}
