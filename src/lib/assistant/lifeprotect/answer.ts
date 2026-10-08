import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { assembleKnowledge } from "@/lib/copilot/knowledge";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { sumAssuredFromPremium } from "@/calc/sa-from-premium";
import { formatBaht } from "@/calc/money";
import type { ModePremium } from "@/calc/mode-premiums";
import type { PayMode } from "@/calc/types";
import { cardPath, valueTablePath, type CardRiders, type PlanCardInput } from "@/lib/card-link";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { lifeProtectChatQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectPriced } from "@/lib/lifeprotect-card";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTable } from "@/lib/lifeprotect-table";
import { faqAnswer } from "./faq";
import {
  cleanRiders, dailyButton, mergeRiders, payerIn, resolveRiders, ridersIn, type RidersWanted,
} from "./riders";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { addressLine } from "../prompts";
import { asksPayTerm, asksValueTable, lifeProtectVariantIn, mergeSlots, PLAN_CODE, routeMessage, type Routed } from "./route";
import {
  aboutCompany, affirms, APPLICATION_FORM, ASK_FOR_TABLE, asksAboutCompany, asksCheaper, baht, type Budget,
  budgetIn, coverIn, FORM_RECEIVED, handOverForm, HEALTH_DECLARATION, keepGivenFigures, one, peopleIn,
  type QuoteFigures, recentTurns, Reply, Said, saysFormDone, spoken, stallReply, stalls, thanksOnly,
  WANTS_IN, wantsToBuy,
} from "../common";

/** The package quoted when the customer has not named one: paying 19 years, the owner's first offer (2026-09-25). */
const FIRST_TERM = "WLF19H";

/** The cheapest instalment of the three: what "แพงไป" is pointed to, and where the smallest contract is measured. */
const CHEAPEST_TERM = "WLF99H";

/**
 * The packages this chat may price. The plan's table also holds the x1.5 product and two
 * health packages; they are real arrangements, sold by hand, and a bot that quoted one of
 * them because its name was close would be quoting something nobody advertised.
 */
const QUOTABLE = new Set(["WLF09H", "WLF19H", "WLF99H"]);

/** One answer, and what the bot should remember about this customer next turn. */
export type Answer = Reply & { slots: Routed };

const ASK_FOR_DETAILS =
  'ขออายุ เพศ กับทุนที่สนใจหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น "ชาย 35 ทุน 1 ล้าน")';

/**
 * What is still needed, named one field at a time.
 *
 * The adverts open the conversation with a button that already says the sum — "สนใจประกันมรดก
 * ทุน 1,000,000" — and a bot that answers it by asking for the sum again reads as one that did
 * not listen, on the first message the campaign paid for. So what is known is repeated back and
 * only the gaps are asked for.
 */
function askForMissing(slots: Routed, table: LifeProtectTable): string {
  const known: string[] = [];
  if (slots.coverWanted !== undefined) {
    known.push(slots.coverWanted === COVER_MEANS_SUM
      ? `ทุน ${slots.coverWanted.toLocaleString("en-US")} บาท`
      : `ครอบครัวได้รับ ${slots.coverWanted.toLocaleString("en-US")} บาท`);
  }
  if (slots.variant) known.push(table.terms.find((t) => t.variant === slots.variant)?.label ?? "");
  const riderNames = ridersNamed(cleanRiders(slots.riders));
  if (riderNames) known.push(riderNames);

  const missing: string[] = [];
  const example: string[] = [];
  if (slots.sex === undefined) { missing.push("เพศ"); example.push("ชาย"); }
  if (slots.age === undefined) { missing.push("อายุ"); example.push("35"); }
  if (slots.coverWanted === undefined) { missing.push("ทุนประกันที่สนใจ"); example.push("ทุน 1 ล้าน"); }
  if (missing.length === 0) return ASK_FOR_DETAILS;

  const ask = `ขอ${missing.join("กับ")}ด้วยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น "${example.join(" ")}")`;
  return known.filter(Boolean).length ? `ได้เลยครับ ${known.filter(Boolean).join(" · ")} 👍\n${ask}` : ask;
}

const HAND_OVER = "เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้ครับ ระหว่างนี้ถามเรื่อง Life Protect x 2 ได้เลย";

export async function answerQuestion(history: ChatMessage[], previous: Routed | null): Promise<Answer> {
  const asked = lastAsked(history);
  const known: Routed = previous ?? { intent: "other" };
  // leaving to think it over needs no model and changes nothing the bot knows
  if (stalls(asked)) {
    // and whatever cheaper arrangement was on the table is off it: a "โอเค" days later must
    // not re-price something they walked away from
    const kept: Routed = { ...known, offer: undefined };
    return { ...one(stallReply(hasQuote(kept))), slots: kept };
  }
  // a thank-you skips the router: it would hand back the figures from the turns before, and
  // "ขอบคุณค่ะ" after a quote would be priced again. Only the small-talk model words the reply.
  if (thanksOnly(asked)) return { ...(await answerSmallTalk(history, known)), slots: known };
  // the form is out and they say it is filled in: the agent takes it from here
  if (known.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), formDone: true, slots: known };
  // deciding to buy is answered with the form — unless a cheaper offer is on the table and the
  // word is a bare yes, which takes the offer first and is priced below
  if (wantsToBuy(asked, hasQuote(known)) && !(known.offer && affirms(asked))) {
    return { ...handOverForm(hasQuote(known)), slots: { ...known, offer: undefined, formSent: true } };
  }

  // a child's พีบี waits for a parent, and the answer is a parent: "แม่ 35" is not a new insured,
  // which is what the router would make of it, so it is read before the router is asked
  const parent = waitsForParent(previous) && coverIn(asked) === undefined ? payerIn(asked) : undefined;
  if (previous && parent) {
    const slots: Routed = { ...previous, intent: "quote", riders: mergeRiders(cleanRiders(previous.riders), { payer: parent }) };
    return quoteAnswer(slots);
  }

  // one of the answers the agency writes out by hand every day. A message can both ask for a
  // price and ask one of these — "ญ 37 ลดหย่อนภาษีได้ไหม" — so it is added to the quote
  // rather than replacing it.
  const faq = faqAnswer(asked);
  // what the customer says about riders is read off the message, and only when the message is
  // not one of those answers — "ผู้ชำระเบี้ยต้องแถลงสุขภาพไหม" is about health, not a rider
  const riderAsked = faq ? undefined : ridersIn(asked);
  /**
   * A question about the conditions, from someone who already holds a quotation.
   *
   * "ต้องตรวจสุขภาพหรือไม่ มีระยะเวลารอคอยหรือไม่" was answered with the quotation again, card
   * and all (Messenger, 2026-10-07): "สอบถาม" is a word that asks for a price, and the router
   * hands back the sum from the turn before. With no figure and no money word of its own, the
   * message asks nothing to be priced, so the written answer stands alone.
   */
  if (faq && hasQuote(known) && !ASKS_TO_PRICE_AGAIN.test(asked) && coverIn(asked) === undefined
    && peopleIn(asked).length === 0 && !asksAboutCompany(asked) && !asksPayTerm(asked)
    && !asksValueTable(asked) && !asksCheaper(asked)) {
    return { ...one(faq), slots: known };
  }
  const routed = mergeSlots(previous, await routeMessage(history));
  const slots: Routed = { ...routed, riders: mergeRiders(cleanRiders(previous?.riders), riderAsked) };
  // checked before the routes that speak: a question about the company is answered by the
  // agency's own sentence whatever else the turn was about
  if (asksAboutCompany(asked)) return { ...one(aboutCompany(asked)), slots };
  // a rider asked for is a quote with the rider on it: the card, the table and the price the
  // page would give, whatever the router thought the turn was about
  if (riderAsked) {
    const asking: Routed = { ...slots, intent: "quote" };
    return quoteAnswer(asking);
  }
  if (asksPayTerm(asked)) return { ...answerPayTerm(slots), slots };
  if (asksValueTable(asked)) return { ...answerValueTable(slots), slots };
  if (asksCheaper(asked)) return answerCheaper(slots);

  /**
   * A budget rather than a sum.
   *
   * The two arrive in either order — the money first and the person when asked, or both at
   * once — so a budget carried from an earlier turn is taken up again on the turn that
   * finally names somebody. A sum said outright always wins: a customer who names one has
   * stopped shopping by what they can pay.
   */
  const saidBudget = budgetIn(asked);
  const carried = peopleIn(asked).length > 0 && slots.coverWanted === undefined ? slots.budget : undefined;
  // a quotation priced from a budget stays on it when the customer taps another term or names
  // another person; a sum said outright has already dropped the budget (mergeSlots)
  const stays = slots.budget !== undefined && slots.coverWanted !== undefined
    && (lifeProtectVariantIn(asked) !== undefined || peopleIn(asked).length > 0) ? slots.budget : undefined;
  const budget = saidBudget ?? carried ?? stays;
  if (budget && coverIn(asked) === undefined) return answerFromBudget(slots, budget);
  // a bare "เอา" takes the cheaper arrangement the bot last put on the table
  if (affirms(asked) && slots.offer) {
    const { offer } = slots;
    const taken: Routed = { ...slots, intent: "quote", coverWanted: offer.coverWanted, variant: offer.variant };
    const priced = quoteAnswer(taken);
    // the offer is taken once; a second "ตกลง" is an acknowledgement, not a request for the same quotation again
    const sumTaken = offer.sumAssured;
    return { ...priced, slots: { ...priced.slots, offer: priced.priced ? undefined : offer, ...(priced.priced ? { takenSum: sumTaken } : {}) } };
  }

  if (slots.intent === "quote") {
    const quoted = quoteAnswer(slots);
    if (faq) {
      // the customer's own question is answered before the invitation, which stays the last word
      const at = quoted.messages.findIndex((m) => m.text === BUDGET_INVITE);
      quoted.messages.splice(at >= 0 ? at : quoted.messages.length, 0, { text: faq });
    }
    return quoted;
  }
  if (faq) return { ...one(faq), slots };

  if (slots.intent === "plan_info") return { ...(await answerPlanInfo(history, slots)), slots };
  return { ...(await answerSmallTalk(history, slots)), slots };
}

/** What the customer said this turn. */
function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

/**
 * The multiple this plan pays on death at that age: twice the sum assured before the booster
 * age, once after it.
 */
function coverMultiple(table: LifeProtectTable, age: number): number {
  return age < table.boosterBeforeAge ? 1 + table.booster : 1;
}

/**
 * The one figure a customer means as a sum assured rather than as what the family receives.
 *
 * The adverts teach it: their artwork reads "ทุน 1 ล้าน → ครอบครัวได้ 2 ล้าน", and the
 * button under it says "สนใจประกันมรดก ทุน 1,000,000". Someone who says that number is
 * repeating the advert back, and quoting them half of it would be quoting them half of what
 * they were shown. Every other figure people name is the inheritance they want to leave.
 */
const COVER_MEANS_SUM = 1_000_000;

/**
 * The sum assured that pays what the customer asked for.
 *
 * A customer who says "ทุน 3 ล้าน" means three million reaching the family, and before sixty
 * this plan pays twice the sum assured — so the contract behind that sentence is written at
 * one and a half. Past the booster age there is no doubling left to divide by, and the two
 * numbers are the same. Rounded to a whole thousand, which is the unit the rate table prices in.
 */
function sumForCover(table: LifeProtectTable, age: number, cover: number): number {
  if (cover === COVER_MEANS_SUM) return cover;
  return Math.round(cover / coverMultiple(table, age) / 1000) * 1000;
}

/** The PDF field, only when the sales page can print the quote. */
const withPdf = (pdfPath: string | undefined) => (pdfPath ? { pdfPath } : {});

/** One insured, priced — or a sentence saying why this one has no price. */
function quoteFor(
  table: LifeProtectTable, variant: string, who: { age: number; sex: "M" | "F" }, coverWanted: number,
  offer?: Routed["offer"],
  takenSum?: number,
  wanted?: RidersWanted,
  /** the instalment the customer said their budget in: it leads the quote, and is recorded on the card */
  headline?: PayMode,
): Said & { figures?: QuoteFigures; table?: string } {
  const { age, sex } = who;
  if (age < table.ageMin || age > table.ageMax) {
    return { text: `อายุ ${age} ปี แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };
  }

  const sumAssured = sumBehind(table, age, coverWanted, variant, offer, takenSum);
  // the floor is a rule of the plan, not a field of the page's slim table — and it is stated
  // back in the customer's own terms, which are what the family receives
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min;
  if (sumAssured < floor) {
    const smallest = floor * coverMultiple(table, age);
    return { text: `แบบนี้เริ่มต้นที่ครอบครัวได้รับ ${smallest.toLocaleString("en-US")} บาทครับ บอกจำนวนที่สนใจมาใหม่ได้เลย` };
  }

  const term = termAt(table, variant);
  const modes = lifeProtectModes(table, term, { sex, age, sumAssured });
  if (!modes) return { text: `อายุ ${age} ปี แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };

  // the riders asked for, priced on this insured: the page's own price, from the page's own
  // function, or the reason there is none — a rider is never priced by guesswork
  let riders: CardRiders | undefined;
  let refused: string | undefined;
  if (wanted) {
    const resolved = resolveRiders(table, who, wanted);
    if (resolved.kind === "payer") return { text: askForParent(resolved) };
    if (resolved.kind === "unsold") refused = resolved.text;
    else riders = resolved.riders;
  }
  const input: PlanCardInput = {
    kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured, ...(headline ? { mode: headline } : {}),
    ...(riders ? { riders } : {}),
  };
  const priced = riders ? lifeProtectPriced(input, new Date()) : undefined;
  if (riders && !priced?.paid) refused = `สัญญาเพิ่มเติมนี้ผมคิดเบี้ยในแชทไม่ได้ครับ ${HAND_OVER}`;
  const withRiders = riders && priced?.paid ? { riders, priced } : undefined;

  const paid = withRiders ? withRiders.priced.paid! : modes;
  const annual = paid.find((m) => m.mode === "annual");
  const text = lifeProtectChatQuoteText({
    sumAssured,
    termLabel: term.label,
    age,
    sex,
    // the first instalment is the headline: a customer who named a monthly budget reads monthly first
    modes: headline ? [...paid.filter((m) => m.mode === headline), ...paid.filter((m) => m.mode !== headline)] : paid,
    death: deathBenefitOf(table, age, sumAssured),
    coverToAge: table.coverToAge,
    ...(withRiders
      ? {
          riders: {
            ...(withRiders.priced.split ? { split: withRiders.priced.split } : {}),
            lines: [
              ...(withRiders.riders.medical !== undefined
                ? [`🏥 นอนโรงพยาบาลได้เงินวันละ ${withRiders.riders.medical.toLocaleString("en-US")} บาท (MEB)`]
                : []),
              ...(withRiders.priced.priceNote ? [withRiders.priced.priceNote] : []),
            ],
            footNotes: withRiders.priced.footNotes,
          },
        }
      : {}),
  });
  const card = withRiders ? input : { ...input, riders: undefined };
  return {
    text: refused ? `${text}\n\n${refused}` : text,
    card: cardPath(card),
    table: valueTablePath(card, { characters: true }),
    // the quote PDF carries no riders yet: one that disagrees with the card is worse than none
    ...(withRiders ? {} : withPdf(quotePdfPath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }))),
    ...(annual ? { figures: { age, sex, plan: variant, sumAssured, annual: baht(annual.total), coverWanted } } : {}),
  };
}

/** A child's พีบี is priced off the parent who pays it, so the parent is asked for. */
function askForParent(r: { payerMin: number; payerMax: number }): string {
  return "พีบีของเด็กคิดเบี้ยตามอายุกับเพศของผู้ปกครองที่เป็นผู้ชำระเบี้ยครับ"
    + ` ขอหน่อยนะครับ (ผู้ปกครองอายุ ${r.payerMin}-${r.payerMax} ปี เช่น "แม่ 35") เดี๋ยวคิดให้เลย`;
}

/** What the customer asked for, in a few words, for the sentence that asks for the rest. */
function ridersNamed(wanted: RidersWanted | undefined): string | undefined {
  if (!wanted) return undefined;
  const names = [
    ...(wanted.waiver ? [wanted.waiver.option === "BEYOND" ? "สัญญาเพิ่มเติม Beyond" : "สัญญาเพิ่มเติม"] : []),
    ...(wanted.medical !== undefined ? ["ค่าชดเชยรายวัน (นอน รพ.)"] : []),
  ];
  return names.length ? names.join(" + ") : undefined;
}

/**
 * A child's พีบี is waiting for the parent, so the next message that gives one is the answer.
 * Judged from what was said, not remembered separately: whoever was last priced still needs one.
 */
function waitsForParent(previous: Routed | null): boolean {
  const wanted = cleanRiders(previous?.riders);
  const who = previous?.people?.[0]
    ?? (previous?.age !== undefined && previous.sex ? { age: previous.age, sex: previous.sex } : undefined);
  return Boolean(wanted?.waiver && who && resolveRiders(lifeProtectTable(), who, wanted).kind === "payer");
}

/**
 * The buttons that go with a quote carrying riders: the other flavour, the daily money when it
 * is not on yet, and the way out. Each is worded so that the reader of the next message takes
 * it back as what it says (riders.ts), or the button would do nothing.
 */
function riderReplies(table: LifeProtectTable, who: { age: number; sex: "M" | "F" }, wanted: RidersWanted | undefined): string[] {
  if (!wanted) return [];
  const resolved = resolveRiders(table, who, wanted);
  if (resolved.kind === "payer") return [];
  if (resolved.kind === "unsold") return [...(resolved.replies ?? []), NO_RIDERS];
  const { waiver, medical } = resolved.riders;
  const daily = medical === undefined ? resolveRiders(table, who, { medical: "any" }) : undefined;
  return [
    ...(waiver ? [waiver.option === "FIT" ? "เปลี่ยนเป็น Beyond" : "เปลี่ยนเป็นฟิต"] : []),
    ...(daily?.kind === "ok" && daily.riders.medical !== undefined ? [dailyButton(daily.riders.medical)] : []),
    NO_RIDERS,
  ];
}

const NO_RIDERS = "ไม่เอาสัญญาเพิ่มเติม";

/**
 * The sum assured behind the cover the customer named, on the arrangement in front of them.
 *
 * The offer carries its own sum, because its cover may be the one figure read as a sum
 * assured. Shared by the quotation and the value table so that the table can never be drawn
 * for a different contract than the price the customer was just given.
 */
function sumBehind(
  table: LifeProtectTable, age: number, coverWanted: number, variant: string,
  offer?: Routed["offer"], takenSum?: number,
): number {
  return offer && offer.coverWanted === coverWanted && offer.variant === variant
    ? offer.sumAssured
    : takenSum ?? sumForCover(table, age, coverWanted);
}

/**
 * The buttons under a quotation: whichever terms this quote did not take, and the way on.
 * Titles are kept under twenty characters, which is all Messenger shows of one. No button for
 * the table, because every quotation is followed by its pictures already.
 */
function quoteReplies(table: LifeProtectTable, quoted: string, riders: string[] = []): string[] {
  return [
    ...table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== quoted).map((t) => t.label),
    ...riders,
    WANTS_IN,
  ];
}

/**
 * What the chart-and-table picture is, said over it when it follows a quotation. A couple has
 * two of them, so each says whose it is.
 */
function tableWords(table: LifeProtectTable, whose?: { age: number; sex: "M" | "F" }): string {
  const owner = whose ? `ของ${whose.sex === "M" ? "ชาย" : "หญิง"} อายุ ${whose.age} ` : "";
  return `กราฟและตารางมูลค่าทุกปี${owner}ให้ดูด้วยครับ — เบี้ยสะสม เงินเวนคืน และความคุ้มครองของแต่ละปี`
    + ` ตั้งแต่ปีแรกจนครบสัญญาอายุ ${table.coverToAge} ปี`;
}
/** Not "เอาแบบลดทุน": ลดทุน is one of the words that mean "too expensive", and the title
 * would come back as a fresh objection rather than as an acceptance. */
const TAKES_OFFER = "เอาแบบนี้";

/**
 * The contract year by year, as a picture.
 *
 * Only ever the arrangement already on the table: the table is drawn from the same sum the
 * quotation was, so the two cannot tell the customer different things. Without a price
 * behind it there is nothing to tabulate, so the bot asks for what it is missing instead.
 */
function answerValueTable(slots: Routed): Reply {
  const table = lifeProtectTable();
  const { age, sex, coverWanted } = slots;
  if (age === undefined || sex === undefined || coverWanted === undefined) {
    return one(askForMissing(slots, table));
  }
  if (table.expired) return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ${HAND_OVER}`);

  const variant = QUOTABLE.has(slots.variant ?? "") ? slots.variant! : FIRST_TERM;
  const sumAssured = sumBehind(table, age, coverWanted, variant, slots.offer, slots.takenSum);
  const term = termAt(table, variant);
  return {
    messages: [{
      // the picture opens with the chart since it moved off the quote card (owner, 2026-10-06)
      text: `ส่งกราฟและตารางมูลค่าทุกปีให้ดูครับ ตั้งแต่ปีแรกจนครบสัญญาอายุ ${table.coverToAge} ปี — มีทั้งเบี้ยสะสม เงินเวนคืน และความคุ้มครองของแต่ละปี (แบบ${term.label})`,
      card: valueTablePath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }, { characters: true }),
    }],
    priced: true,
    replies: [
      ...table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== variant).map((t) => t.label),
      WANTS_IN,
    ],
  };
}

/**
 * The quote, or a sentence saying why there is none — one message per insured.
 *
 * A couple asking together gets a quote each, in the order they named themselves, because
 * each of them is buying their own contract at their own age.
 */
function quoteAnswer(slots: Routed): Answer {
  const reply = answerQuote(slots);
  const invited = reply.messages.some((m) => m.text === BUDGET_INVITE);
  return { ...reply, slots: invited ? { ...slots, budgetAsked: true } : slots };
}

function answerQuote(slots: Routed): Reply {
  if (slots.variant && !QUOTABLE.has(slots.variant)) {
    return one(`ในแชทนี้ผมคิดให้ได้เฉพาะแบบ Life Protect x 2 ครับ สำหรับแบบอื่น ${HAND_OVER}`);
  }

  const table = lifeProtectTable();
  const { age, sex, coverWanted } = slots;
  const people = slots.people ?? (age !== undefined && sex !== undefined ? [{ age, sex }] : []);
  if (people.length === 0 || coverWanted === undefined) return one(askForMissing(slots, table));

  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ${HAND_OVER}`);
  }

  // naming the cover a cheaper offer put on the table takes that offer, term and all: the
  // offer is priced to-99, and quoting its sum on the first term would change the price
  const onOffer = slots.offer && slots.offer.coverWanted === coverWanted ? slots.offer.variant : undefined;
  const variant = slots.variant ?? onOffer ?? FIRST_TERM;
  const wanted = cleanRiders(slots.riders);
  const messages = people.map((who) => quoteFor(table, variant, who, coverWanted, slots.offer, slots.takenSum, wanted));

  // the offer of the other terms belongs once, under the last price on the screen
  const last = messages.map((m) => Boolean(m.card)).lastIndexOf(true);
  if (last >= 0) messages[last].text += `\n${otherTerms(table, variant)}`;

  // a couple priced together is two quotations and one record; the last is the one the
  // buttons sit under, so it is the one the lead is opened against
  const figures = last >= 0 ? messages[last].figures : undefined;
  /**
   * Every quotation is followed by the chart and the year-by-year table of the same
   * arrangement, as the page shows them under its price — the chart moved off the card onto
   * that picture (owner, 2026-10-06). A couple's two quotations come first, so each reads as
   * the price it is, and then the two tables, each saying whose it is (owner, 2026-10-06:
   * "ส่งการ์ดให้ลูกค้า ให้ส่งตารางมูลค่าตามไปด้วย", after a couple was sent cards alone).
   */
  const couple = people.length > 1;
  const tables = messages.flatMap(({ card, table: tablePath }, i) =>
    card && tablePath ? [{ text: tableWords(table, couple ? people[i] : undefined), card: tablePath }] : []);
  // once, after the first price and its table: the way into pricing by what the customer can
  // pay. Not to a couple (whose money is it?) and not to a customer who has named a budget.
  const invite = last >= 0 && !couple && !slots.budgetAsked && !slots.budget ? [{ text: BUDGET_INVITE }] : [];
  return {
    messages: [
      ...messages.map(({ text, card, pdfPath }) => ({ text, ...(card ? { card } : {}), ...withPdf(pdfPath) })),
      ...tables,
      ...invite,
    ],
    priced: last >= 0,
    ...(figures ? { quote: figures } : {}),
    ...(last >= 0 ? { replies: quoteReplies(table, variant, riderReplies(table, people[0], wanted)) } : {}),
  };
}

/**
 * How long the premium runs, in one line, for whichever term is on the table.
 *
 * Answered from the plan's own terms rather than by re-sending the quotation: someone who
 * asks how many years they pay for has the figures already and wants the one fact that was
 * not among them.
 */
function answerPayTerm(slots: Routed): Reply {
  const table = lifeProtectTable();
  const quotable = table.terms.filter((t) => QUOTABLE.has(t.variant));
  const term = slots.variant ? quotable.find((t) => t.variant === slots.variant) : undefined;

  if (!term) {
    return one(
      `แบบนี้เลือกระยะเวลาชำระเบี้ยได้ 3 แบบครับ — ${quotable.map((t) => t.label).join(" · ")}\n`
      + `ทุกแบบคุ้มครองถึงอายุ ${table.coverToAge} เหมือนกัน สนใจแบบไหนบอกได้เลยครับ`,
    );
  }

  const rest = quotable.filter((t) => t.variant !== term.variant).map((t) => t.label).join(" หรือ ");
  return one(term.payTerm !== undefined
    ? `แบบที่คิดให้อยู่นี้ ${term.label} ครับ จ่ายครบ ${term.payTerm} ปีแล้วไม่ต้องจ่ายอีก `
      + `แต่ยังคุ้มครองถึงอายุ ${table.coverToAge}\nถ้าอยากดูแบบ${rest} บอกได้เลยครับ`
    : `แบบที่คิดให้อยู่นี้ ${term.label} ครับ คือชำระเบี้ยไปจนถึงอายุ ${table.coverToAge}\n`
      + `ถ้าอยากให้จ่ายจบเร็วกว่านี้ มีแบบ${rest} บอกได้เลยครับ`);
}

/**
 * Sums are met in the steps the page's slider takes, so the sum a budget buys is one the page
 * can open and the PDF can print.
 */
const BUDGET_STEP = 50_000;

/** What a budget buys on one term: the sum, its instalment, and whether the plan's monthly floor lifted it. */
interface BudgetFit {
  sum: number;
  priced: ModePremium;
  /** the instalment is over the budget, because the smallest monthly instalment the company takes is */
  over: boolean;
}

/**
 * The biggest sum a budget buys on one term, or undefined when it does not reach the smallest
 * contract the plan sells.
 *
 * Worked backwards from the instalment by the engine, then rounded down to a step and priced
 * forwards again: the figure given back is what that sum costs, never what the customer said
 * they would pay. If the rounded sum is still over (a rate with a satang's rounding), it steps
 * down. The plan's minimum sum is a hard floor: a budget under it is told so, not lifted to it.
 * The one thing allowed over the budget is the company's own monthly floor, and it is said.
 */
function fitBudget(
  table: LifeProtectTable, variant: string, who: { sex: "M" | "F"; age: number }, budget: Budget,
): BudgetFit | undefined {
  const plan = getPlan(PLAN_CODE)!;
  const { min, max } = baseSumAssuredLimits(plan.rules, variant);
  const mode = budget.per === "month" ? "monthly" : "annual";
  const instalment = (sumAssured: number) =>
    lifeProtectModes(table, termAt(table, variant), { ...who, sumAssured })?.find((m) => m.mode === mode);

  const raw = sumAssuredFromPremium(plan.rates, { variant, ...who, mode, targetPremium: budget.baht });
  if (raw === undefined) return undefined;
  let sum = Math.min(Math.floor(raw / BUDGET_STEP) * BUDGET_STEP, max ?? Infinity);
  let priced = instalment(sum);
  while (sum >= min && priced && priced.total > budget.baht * 100) { sum -= BUDGET_STEP; priced = instalment(sum); }
  if (sum < min || !priced) return undefined;
  if (!priced.belowMinimum) return { sum, priced, over: false };

  // under the company's monthly floor: the next step up is the smallest that can be sold
  const up = instalment(sum + BUDGET_STEP);
  return up && !up.belowMinimum && sum + BUDGET_STEP <= (max ?? Infinity)
    ? { sum: sum + BUDGET_STEP, priced: up, over: true }
    : undefined;
}

/** Said once, after the first quotation and its table: the way into pricing by what the customer can pay. */
export const BUDGET_INVITE = "หากลูกค้ามีงบต่อเดือนหรือต่อปี สามารถบอกมาเพื่อให้คำนวณทุนประกันได้เลยค่ะ";

/**
 * What a stated budget actually buys, as a quotation.
 *
 * A man wrote "ผมมีเดือนละ 1000 สามารถทำประกันแบบไหนได้บ้างครับ" and was sent a quotation for
 * a million baht of cover at 2,781 a month — the figure he had named was read as nothing at
 * all. The rate table runs both ways, so this is arithmetic (fitBudget).
 *
 * The answer is the quotation the customer would have had by naming the sum: the card, the
 * year-by-year table and the PDF, on the term already in play (paying 19 years when none is).
 * The other terms follow in a line each, because the same money buys three times the cover on
 * the longest one, and that comparison is the decision. A tap on another term, or another
 * person named, is answered from the same budget.
 */
function answerFromBudget(slots: Routed, budget: Budget): Answer {
  const kept: Routed = { ...slots, budget, offer: undefined };
  const table = lifeProtectTable();
  const { age, sex } = kept;
  const per = budget.per === "month" ? "เดือน" : "ปี";
  const money = (n: number) => n.toLocaleString("en-US");

  if (age === undefined || sex === undefined) {
    return {
      ...one(`ได้เลยครับ งบ${per}ละ ${money(budget.baht)} บาท 👍\n`
        + 'ขอเพศกับอายุด้วยครับ เดี๋ยวคิดให้ว่าได้ทุนเท่าไหร่ (เช่น "ชาย 38")'),
      slots: kept,
    };
  }
  if (table.expired || age < table.ageMin || age > table.ageMax) return { ...one(HAND_OVER), slots: kept };

  const who = { sex, age };
  const multiple = coverMultiple(table, age);
  const mode: PayMode = budget.per === "month" ? "monthly" : "annual";
  const variant = QUOTABLE.has(slots.variant ?? "") ? slots.variant! : FIRST_TERM;
  const fits = [FIRST_TERM, "WLF09H", "WLF99H"].flatMap((v) => {
    const fit = fitBudget(table, v, who, budget);
    return fit ? [{ variant: v, label: termAt(table, v).label, fit }] : [];
  });
  const chosen = fits.find((f) => f.variant === variant);

  if (!chosen) {
    /**
     * The money does not reach the smallest contract on this term. Said plainly, with the
     * figure it would take — a customer told only "ไม่ได้ครับ" has nothing to decide with — and
     * never quoted at a sum the budget does not buy.
     */
    const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min;
    const least = lifeProtectModes(table, termAt(table, variant), { ...who, sumAssured: floor })?.find((m) => m.mode === mode);
    return {
      ...one(least
        ? `งบ${per}ละ ${money(budget.baht)} บาท ยังไม่ถึงทุนขั้นต่ำของแบบนี้ครับ 🙏\n`
          + `ทุนต่ำสุดคือ ${money(floor)} บาท แบบ${termAt(table, variant).label} เบี้ย ${formatBaht(least.total)} บาท/${per}\n`
          + "ถ้าสนใจแบบนี้ บอกได้เลยครับ หรือถ้าอยากดูแบบที่เบี้ยเริ่มต้นต่ำกว่า เช่น ประกันสุขภาพ ก็บอกได้เลยครับ"
        : HAND_OVER),
      slots: kept,
    };
  }

  const wanted = cleanRiders(slots.riders);
  const cover = chosen.fit.sum * multiple;
  const quoted = quoteFor(table, variant, who, cover, undefined, chosen.fit.sum, wanted, mode);
  const others = fits.filter((f) => f.variant !== variant);
  const comparison = others.length
    ? [
      "งบเท่ากัน แบบอื่นได้ทุนประมาณนี้ครับ",
      ...others.map((f) => `• ${f.label} — ทุน ${money(f.fit.sum)} บาท (ครอบครัวได้รับ ${money(f.fit.sum * multiple)})`
        + ` เบี้ย ${formatBaht(f.fit.priced.total)} บาท/${per}`),
      "จ่ายยาวกว่าได้ทุนมากกว่า — สนใจแบบไหน บอกได้เลยครับ",
    ].join("\n")
    : undefined;
  const notes = [
    ...(chosen.fit.over
      ? [`(แบบชำระรายเดือนขั้นต่ำ ${money(table.minMonthly)} บาท/เดือน เบี้ยจึงเกินงบมานิดหน่อยครับ)`]
      : []),
    ...(wanted ? ["งบนี้คิดเฉพาะแบบหลักครับ เบี้ยสัญญาเพิ่มเติมบวกเพิ่มจากนี้"] : []),
  ];
  const intro = [
    `งบ${per}ละ ${money(budget.baht)} บาท ${sex === "M" ? "ชาย" : "หญิง"}อายุ ${age} ปี `
    + `ทำทุนได้สูงสุด ${money(chosen.fit.sum)} บาท แบบ${chosen.label} ครับ 💰`,
    ...notes,
  ].join("\n");

  const slotsOut: Routed = { ...kept, variant, coverWanted: cover, takenSum: chosen.fit.sum };
  return {
    messages: [
      { text: intro },
      {
        text: quoted.text,
        ...(quoted.card ? { card: quoted.card } : {}),
        ...withPdf(quoted.pdfPath),
      },
      ...(quoted.card && quoted.table ? [{ text: tableWords(table), card: quoted.table }] : []),
      // last, so the PDF offer that follows a quotation is still the last word
      ...(comparison ? [{ text: comparison }] : []),
    ],
    priced: Boolean(quoted.card),
    ...(quoted.figures ? { quote: quoted.figures } : {}),
    ...(quoted.card ? { replies: quoteReplies(table, variant, riderReplies(table, who, wanted)) } : {}),
    slots: slotsOut,
  };
}

/**
 * "แพงไป" — answered with what is actually cheaper.
 *
 * The bot's first instinct was to offer the nine- and nineteen-year terms, which cost more a
 * year, not less. Two things genuinely lower the premium on this plan: paying to ninety-nine,
 * which is the cheapest term by the year, and a smaller cover, which lowers it in
 * proportion. Both are stated with the engine's figures, and the smaller cover is left on the
 * table so a bare "เอา" can take it.
 */
function answerCheaper(slots: Routed): Answer {
  const table = lifeProtectTable();
  const { age, sex, coverWanted } = slots;
  if (age === undefined || sex === undefined || coverWanted === undefined) {
    return { ...one(`บอกอายุ เพศ กับทุนที่สนใจมาก่อนครับ เดี๋ยวคิดให้ดูว่าแบบไหนเบาที่สุด`), slots };
  }
  if (table.expired || age < table.ageMin || age > table.ageMax) return { ...one(HAND_OVER), slots };

  // the same formatting the quotation uses, so one instalment never shows as two figures
  const baht = formatBaht;
  const monthly = (variant: string, sum: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured: sum })?.find((m) => m.mode === "monthly");
  const variant = slots.variant ?? FIRST_TERM;
  const sumNow = slots.offer && slots.offer.coverWanted === coverWanted
    ? slots.offer.sumAssured
    : slots.takenSum ?? sumForCover(table, age, coverWanted);
  const lines: string[] = [];

  // the term: to-99 is the cheapest by the year, and worth naming if they are not on it
  if (variant !== CHEAPEST_TERM) {
    const m = monthly(CHEAPEST_TERM, sumNow);
    if (m) lines.push(`ถ้าเปลี่ยนเป็นแบบจ่ายถึงอายุ 99 ทุนเท่าเดิม เบี้ยจะเหลือประมาณ ${baht(m.total)} บาท/เดือนครับ (แบบนี้เบี้ยต่อปีถูกที่สุด)`);
  } else {
    lines.push("แบบจ่ายถึงอายุ 99 ที่คิดให้อยู่นี้ เป็นแบบที่เบี้ยต่อปีถูกที่สุดแล้วครับ");
  }

  // the cover: halve the sum, and keep the arrangement so "เอา" can take it
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, CHEAPEST_TERM).min;
  const half = Math.round(sumNow / 2 / 1000) * 1000;
  let offer = slots.offer;
  if (half >= floor) {
    const m = monthly(CHEAPEST_TERM, half);
    const coverHalf = half * coverMultiple(table, age);
    if (m) {
      lines.push(
        `หรือถ้าลดทุนลงครึ่งหนึ่ง เป็นทุน ${half.toLocaleString("en-US")} บาท (ครอบครัวได้รับ ${coverHalf.toLocaleString("en-US")}) `
        + `เบี้ยจะประมาณ ${baht(m.total)} บาท/เดือนครับ`,
      );
      offer = { coverWanted: coverHalf, sumAssured: half, variant: CHEAPEST_TERM };
    }
  } else {
    lines.push(`ทุนตอนนี้อยู่ที่ขั้นต่ำของแบบนี้แล้วครับ ลดลงกว่านี้ไม่ได้`);
  }

  const offered = Boolean(offer && offer !== slots.offer);
  lines.push(offered
    ? 'สนใจแบบลดทุน พิมพ์ว่า "เอา" ได้เลยครับ เดี๋ยวส่งใบเสนอให้ หรือบอกทุนที่อยากได้มาใหม่ก็ได้'
    : "บอกทุนที่อยากได้มาใหม่ได้เลยครับ เดี๋ยวคิดให้");

  // the objection is the moment the table earns its place: it is the answer to "what do I
  // get back". And taking the smaller arrangement should be a tap, not a sentence to type.
  return {
    messages: [{ text: lines.join("\n") }],
    slots: { ...slots, offer },
    replies: [...(offered ? [TAKES_OFFER] : []), ASK_FOR_TABLE],
  };
}

/** a figure, or a word for money: what makes a conditions question also a request to price */
const ASKS_TO_PRICE_AGAIN = /\d|เบี้ย|ราคา|เท่าไ|กี่บาท|ทุน/;

/** Whether this customer has been given a premium: the three things a quote needs are known. */
function hasQuote(slots: Routed): boolean {
  return slots.age !== undefined && slots.sex !== undefined && slots.coverWanted !== undefined;
}

/** The terms this quote did not take, offered by name so the customer can ask for one. */
function otherTerms(table: LifeProtectTable, quoted: string): string {
  // the owner's wording: the first term named as saving ("ออม 9 ปี"), the rest as paying
  const rest = table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== quoted)
    .map((t, i) => (i === 0 ? t.label.replace(/^จ่าย/, "ออม") : t.label));
  return `ถ้าอยากดูแบบ${rest.join(" หรือ ")} คุ้มครองถึง ${table.coverToAge} ปี หรือตารางมูลค่าทุกปี บอกได้เลย เดี๋ยวคิดให้ฮะ`;
}

/**
 * What is already known about this customer, written out for the model.
 *
 * Without it the answer ends "แจ้งเพศ อายุ และทุนประกันที่สนใจมาได้เลย ผมจะคำนวณให้ทันที"
 * to someone who gave all three and was sent a premium three messages ago — the same not
 * listening that asking for the amount twice was, one step further along.
 */
function knownSoFar(slots: Routed, table: LifeProtectTable): string {
  const bits: string[] = [];
  if (slots.sex) bits.push(slots.sex === "M" ? "ชาย" : "หญิง");
  if (slots.age !== undefined) bits.push(`อายุ ${slots.age} ปี`);
  if (slots.coverWanted !== undefined) {
    bits.push(slots.coverWanted === COVER_MEANS_SUM
      ? `ทุน ${slots.coverWanted.toLocaleString("en-US")} บาท`
      : `ครอบครัวได้รับ ${slots.coverWanted.toLocaleString("en-US")} บาท`);
  }
  const term = slots.variant ? table.terms.find((t) => t.variant === slots.variant) : undefined;
  if (term) bits.push(term.label);
  if (bits.length === 0) return "";

  const quoted = quotedFigures(slots, table);
  return `\n\nข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว: ${bits.join(" · ")}\n`
    + "ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก\n"
    // a couple was priced together, and one sex would be the wrong word for half of them
    + addressLine(slots.people && slots.people.length > 1 ? undefined : slots.sex)
    + familyReceives(slots, table)
    + (quoted
      ? `เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ ${quoted}\n`
        + "ถ้าจะพูดถึงตัวเลขเบี้ย ให้ใช้ตัวเลขชุดนี้เท่านั้น คัดลอกมาตรงๆ ห้ามคำนวณเอง ห้ามประมาณ ห้ามปัดเศษ\n"
        + "ถ้าลูกค้าอยากได้เบี้ยของอายุ ทุน หรือแบบชำระอื่น ห้ามตอบเป็นตัวเลข ให้บอกว่าเดี๋ยวคิดให้ แล้วให้เขาบอกมา"
      : "ถ้าลูกค้าอยากได้เบี้ย ให้ขอเฉพาะข้อมูลที่ยังขาด ห้ามตอบตัวเลขเบี้ยเอง");
}

/**
 * What this customer's family receives on death, before the booster age and after, worked out
 * by the engine. "หลังอายุ 60 แล้ว ทุนเหลือ 1,500,000 ใช่ไหม" is answered from these two
 * figures; left to halve the cover itself, the model has the plan's rule but not this sum.
 */
function familyReceives(slots: Routed, table: LifeProtectTable): string {
  const { age, coverWanted } = slots;
  if (age === undefined || coverWanted === undefined) return "";
  const sum = sumBehind(table, age, coverWanted, slots.variant ?? FIRST_TERM, slots.offer, slots.takenSum);
  const baht = (n: number) => n.toLocaleString("en-US");
  const from = `ตั้งแต่อายุ ${table.boosterBeforeAge} ปีขึ้นไปได้รับ ${baht(sum)} บาท`;
  return (age < table.boosterBeforeAge
    ? `เสียชีวิตก่อนอายุ ${table.boosterBeforeAge} ครอบครัวได้รับ ${baht(sum * coverMultiple(table, age))} บาท · ${from}`
    : `เสียชีวิต${from}`) + "\n";
}

/**
 * The premium this customer has already been sent, as the engine computed it.
 *
 * It is put in front of the model because withholding it did not stop the model reaching for
 * one: asked whether the premium was level, it answered 3,790 a month where the quotation it
 * had sent five messages earlier said 3,861. A figure it can copy is a figure it cannot
 * invent. Undefined when nothing has been priced yet, and the prompt then forbids figures
 * outright.
 */
function quotedFigures(slots: Routed, table: LifeProtectTable): string | undefined {
  const { age, sex, coverWanted } = slots;
  if (age === undefined || sex === undefined || coverWanted === undefined || table.expired) return undefined;
  const variant = slots.variant ?? FIRST_TERM;
  if (!QUOTABLE.has(variant)) return undefined;
  if (age < table.ageMin || age > table.ageMax) return undefined;

  const sumAssured = sumForCover(table, age, coverWanted);
  if (sumAssured < baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min) return undefined;
  const modes = lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured });
  if (!modes) return undefined;

  const baht = formatBaht;
  const by = (mode: string) => modes.find((m) => m.mode === mode);
  // the last row of the surrender schedule is what the policy pays for staying to the end —
  // asked "ถ้าไม่ตายจนครบสัญญาได้อะไร", the model had called it the sum assured, which it is
  // not for every term
  const cash = cashAt(termAt(table, variant), sex, age, sumAssured, table.ageMin);
  const end = cash[cash.length - 1];
  return [
    by("monthly") ? `รายเดือน ${baht(by("monthly")!.total)} บาท` : "",
    by("semi") ? `ราย 6 เดือน ${baht(by("semi")!.total)} บาท` : "",
    by("annual") ? `รายปี ${baht(by("annual")!.total)} บาท` : "",
    end ? `อยู่ครบสัญญาถึงอายุ ${end.age} รับเงินคืน ${end.amount.toLocaleString("en-US")} บาท` : "",
  ].filter(Boolean).join(" · ");
}

async function answerPlanInfo(history: ChatMessage[], slots: Routed): Promise<Reply> {
  /**
   * This plan's own sheet first, then the whole library.
   *
   * The sheet says what this conversation is about and is worded for it; the library is
   * every plan's rules, the illness lists and the agent's own notes. Both, because a
   * customer in a Life Protect conversation still asks "DCI คุ้มครองกี่โรค", and until this
   * was here the bot could not say — while the website could, out of the same files.
   */
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${PLAN_INFO_SYSTEM}\n\nข้อมูลแบบประกัน\n${planInfoText()}${knownSoFar(slots, lifeProtectTable())}`
        + `\n\n---\n\n${await assembleKnowledge(asked, { lifeProtect: true })}`,
    },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "plan_info", maxTokens: 400, messages });
  return modelWrote(r, messages, slots);
}

/**
 * A model's words, as a reply: checked for figures it was not given, and signed with its name.
 *
 * The check is `keepGivenFigures` — a premium the model worked out for itself is taken out,
 * and if that leaves nothing, the engine's own figures for this customer are said instead, or
 * the question for what is still missing. The name is so the website does not print "the
 * system's premium calculator" under prose a model wrote (review 2026-10-01).
 */
function modelWrote(r: { text: string; model: string }, shown: ChatMessage[], slots: Routed): Reply {
  const quoted = quotedFigures(slots, lifeProtectTable());
  const fallback = quoted
    ? `เบี้ยที่คิดให้ไว้คือ ${quoted} ครับ ถ้าอยากดูทุน อายุ หรือแบบชำระอื่น บอกได้เลย เดี๋ยวคิดให้`
    : ASK_FOR_DETAILS;
  const text = keepGivenFigures(r.text.trim(), shown.map((m) => m.content).join("\n"), fallback);
  return { ...spoken(text || ASK_FOR_DETAILS, ASK_FOR_DETAILS), writtenBy: r.model };
}

/**
 * Small talk is told what is known too. "เดี๋ยวคิดดูก่อนนะคะ", from someone quoted a minute
 * earlier, was answered with a request for their age, sex and amount.
 */
async function answerSmallTalk(history: ChatMessage[], slots: Routed): Promise<Reply> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${SMALL_TALK_SYSTEM}${knownSoFar(slots, lifeProtectTable())}` },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "small_talk", maxTokens: 200, messages });
  return modelWrote(r, messages, slots);
}

/**
 * What the plan is, in the engine's own figures. Built from the facts the sales page renders,
 * so a change to the rate tables reaches the chat without anyone retyping a number — and so
 * the model has no reason to reach for one of its own.
 */
function planInfoText(): string {
  const f = lifeProtectFacts();
  const table = lifeProtectTable();
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, CHEAPEST_TERM).min;
  return [
    "ชื่อแบบ: Life Protect x 2",
    `รับประกันอายุ ${f.ageMin}-${f.ageMax} ปี คุ้มครองถึงอายุ ${f.coverToAge} ปี`,
    `ทุนประกันขั้นต่ำ ${floor.toLocaleString("en-US")} บาท`,
    `เสียชีวิตก่อนอายุ ${f.boosterBeforeAge} ปี ครอบครัวได้รับ 2 เท่าของทุน ตั้งแต่อายุ ${f.boosterBeforeAge} ปีขึ้นไปได้รับ 1 เท่าของทุน`,
    `แบบการชำระเบี้ยมีให้เลือก ${table.terms.filter((t) => QUOTABLE.has(t.variant)).map((t) => t.label).join(" / ")}`,
    "เบี้ยคงที่ตลอดระยะเวลาชำระ และมีมูลค่าเวนคืนสะสม",
    `อยู่ครบสัญญาถึงอายุ ${f.coverToAge} ได้รับเงินคืนเท่ากับมูลค่าเงินสดสะสม ณ อายุนั้น (ตัวเลขต่างกันตามทุน อายุ และแบบชำระ อยู่ในใบเสนอราคาของแต่ละคน ไม่ใช่ทุนประกันเสมอไป)`,
    "ไม่มีตัวเลขเบี้ยของใครอยู่ในนี้ ถ้าลูกค้าอยากรู้เบี้ย ให้ขอเพศ อายุ และทุน แล้วระบบจะคิดให้เอง",
  ].join("\n");
}
