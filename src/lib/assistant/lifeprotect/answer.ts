import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { assembleKnowledge } from "@/lib/copilot/knowledge";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { sumAssuredFromPremium } from "@/calc/sa-from-premium";
import { formatBaht } from "@/calc/money";
import { cardPath, valueTablePath } from "@/lib/card-link";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { lifeProtectChatQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTable } from "@/lib/lifeprotect-table";
import { faqAnswer } from "./faq";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { asksPayTerm, asksValueTable, mergeSlots, PLAN_CODE, routeMessage, type Routed } from "./route";
import {
  aboutCompany, affirms, APPLICATION_FORM, asksAboutCompany, asksCheaper, baht, type Budget,
  budgetIn, coverIn, FORM_RECEIVED, handOverForm, HEALTH_DECLARATION, keepGivenFigures, one, peopleIn,
  type QuoteFigures, recentTurns, Reply, Said, saysFormDone, spoken, stallReply, stalls,
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
  // the form is out and they say it is filled in: the agent takes it from here
  if (known.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), formDone: true, slots: known };
  // deciding to buy is answered with the form — unless a cheaper offer is on the table and the
  // word is a bare yes, which takes the offer first and is priced below
  if (wantsToBuy(asked, hasQuote(known)) && !(known.offer && affirms(asked))) {
    return { ...handOverForm(hasQuote(known)), slots: { ...known, offer: undefined, formSent: true } };
  }

  const slots = mergeSlots(previous, await routeMessage(history));
  // checked before the routes that speak: a question about the company is answered by the
  // agency's own sentence whatever else the turn was about
  if (asksAboutCompany(asked)) return { ...one(aboutCompany(asked)), slots };
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
  const budget = saidBudget ?? carried;
  if (budget && coverIn(asked) === undefined) return answerFromBudget(slots, budget);
  // a bare "เอา" takes the cheaper arrangement the bot last put on the table
  if (affirms(asked) && slots.offer) {
    const { offer } = slots;
    const taken: Routed = { ...slots, intent: "quote", coverWanted: offer.coverWanted, variant: offer.variant };
    const priced = answerQuote(taken);
    // the offer is taken once; a second "ตกลง" is an acknowledgement, not a request for the same quotation again
    const sumTaken = offer.sumAssured;
    return { ...priced, slots: { ...taken, offer: priced.priced ? undefined : offer, ...(priced.priced ? { takenSum: sumTaken } : {}) } };
  }

  // one of the answers the agency writes out by hand every day. A message can both ask for a
  // price and ask one of these — "ญ 37 ลดหย่อนภาษีได้ไหม" — so it is added to the quote
  // rather than replacing it.
  const faq = faqAnswer(asked);
  if (slots.intent === "quote") {
    const quoted = answerQuote(slots);
    if (faq) quoted.messages.push({ text: faq });
    return { ...quoted, slots };
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

  const annual = modes.find((m) => m.mode === "annual");
  return {
    text: lifeProtectChatQuoteText({
      sumAssured,
      termLabel: term.label,
      age,
      sex,
      modes,
      death: deathBenefitOf(table, age, sumAssured),
      coverToAge: table.coverToAge,
    }),
    card: cardPath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }),
    table: valueTablePath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }),
    ...withPdf(quotePdfPath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured })),
    ...(annual ? { figures: { age, sex, plan: variant, sumAssured, annual: baht(annual.total), coverWanted } } : {}),
  };
}

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
 * The buttons under a quotation: the table, whichever terms this quote did not take, and the
 * way on. Titles are kept under twenty characters, which is all Messenger shows of one.
 */
function quoteReplies(table: LifeProtectTable, quoted: string, offerTable = true): string[] {
  return [
    // not when the table was just sent with the quote
    ...(offerTable ? [ASK_FOR_TABLE] : []),
    ...table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== quoted).map((t) => t.label),
    WANTS_IN,
  ];
}

/** The words a tapped button sends, which are the words the bot reads. */
const ASK_FOR_TABLE = "ขอตารางมูลค่า";

/** What the chart-and-table picture is, said over it when it follows a quotation. */
function tableWords(table: LifeProtectTable): string {
  return `กราฟและตารางมูลค่าทุกปีให้ดูด้วยครับ — เบี้ยสะสม เงินเวนคืน และความคุ้มครองของแต่ละปี`
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
      card: valueTablePath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }),
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
  const messages = people.map((who) => quoteFor(table, variant, who, coverWanted, slots.offer, slots.takenSum));

  // the offer of the other terms belongs once, under the last price on the screen
  const last = messages.map((m) => Boolean(m.card)).lastIndexOf(true);
  if (last >= 0) messages[last].text += `\n${otherTerms(table, variant)}`;

  // a couple priced together is two quotations and one record; the last is the one the
  // buttons sit under, so it is the one the lead is opened against
  const figures = last >= 0 ? messages[last].figures : undefined;
  /**
   * One insured gets the chart and the year-by-year table straight after the card, as the
   * page shows them under its price — the chart moved off the card onto that picture
   * (owner, 2026-10-06). A couple already has two cards on the screen, so theirs stays a
   * button away rather than making four pictures of one answer.
   */
  const withTable = people.length === 1;
  return {
    messages: messages.flatMap(({ text, card, pdfPath, table: tablePath }) => [
      { text, ...(card ? { card } : {}), ...withPdf(pdfPath) },
      ...(withTable && card && tablePath ? [{ text: tableWords(table), card: tablePath }] : []),
    ]),
    priced: last >= 0,
    ...(figures ? { quote: figures } : {}),
    ...(last >= 0 ? { replies: quoteReplies(table, variant, !withTable) } : {}),
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
 * "แพงไป" — answered with what is actually cheaper.
 *
 * The bot's first instinct was to offer the nine- and nineteen-year terms, which cost more a
 * year, not less. Two things genuinely lower the premium on this plan: paying to ninety-nine,
 * which is the cheapest term by the year, and a smaller cover, which lowers it in
 * proportion. Both are stated with the engine's figures, and the smaller cover is left on the
 * table so a bare "เอา" can take it.
 */
/** Sums are quoted in tidy steps, because an agent writing an application writes a tidy sum. */
const SUM_STEP = 10_000;

/**
 * What a stated budget actually buys, on each of the three ways of paying for it.
 *
 * A man wrote "ผมมีเดือนละ 1000 สามารถทำประกันแบบไหนได้บ้างครับ" and was sent a quotation for
 * a million baht of cover at 2,781 a month — the figure he had named was read as nothing at
 * all. The rate table runs both ways, so this is arithmetic: the sum is worked backwards from
 * the instalment, rounded down to a tidy figure so the premium quoted back is inside his
 * budget rather than a little over it, and then priced forwards again so the number he is
 * given is what that sum really costs.
 *
 * All three terms, because the answer to "แบบไหนได้บ้าง" is the comparison: the same money
 * buys three times the cover on the longest term, and that is the whole of the decision.
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

  const rates = getPlan(PLAN_CODE)!.rates;
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, CHEAPEST_TERM).min;
  const mode = budget.per === "month" ? "monthly" : "annual";
  const multiple = coverMultiple(table, age);

  const instalment = (variant: string, sumAssured: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured })?.find((m) => m.mode === mode);

  const lines: string[] = [];
  let overBudget = false;
  // paying 19 years leads, as it does in the quotation (the owner, 2026-09-25)
  for (const variant of [FIRST_TERM, "WLF09H", "WLF99H"]) {
    const raw = sumAssuredFromPremium(rates, { variant, sex, age, mode, targetPremium: budget.baht });
    if (raw === undefined) continue;
    // rounded down, so what is quoted back fits inside the money they said they had
    let sum = Math.floor(raw / SUM_STEP) * SUM_STEP;
    let priced = instalment(variant, sum);
    /**
     * Rounding down can take the instalment under the smallest one the plan accepts — a
     * budget of exactly a thousand a month lands there, since a thousand is the floor. The
     * step back up is the only arrangement that can actually be sold, so it is the one quoted,
     * and the customer is told it is over the figure they named rather than left to notice.
     */
    if (priced?.belowMinimum) {
      const up = instalment(variant, sum + SUM_STEP);
      if (up && !up.belowMinimum) { sum += SUM_STEP; priced = up; overBudget = true; } else priced = undefined;
    }
    if (!priced || sum < floor) continue;
    const label = table.terms.find((t) => t.variant === variant)?.label ?? variant;
    lines.push(`• ${label} — ทุน ${money(sum)} บาท (ครอบครัวได้รับ ${money(sum * multiple)})`
      + ` เบี้ย ${formatBaht(priced.total)} บาท/${per}`);
  }

  if (!lines.length) {
    /**
     * The money does not reach the smallest contract sold. Said plainly, with the figure it
     * would take — a customer told only "ไม่ได้ครับ" has nothing to decide with.
     */
    const least = instalment(CHEAPEST_TERM, floor);
    const term = table.terms.find((t) => t.variant === CHEAPEST_TERM)?.label ?? "";
    return {
      ...one(least
        ? `งบ${per}ละ ${money(budget.baht)} บาท ยังไม่ถึงทุนขั้นต่ำของแบบนี้ครับ 🙏\n`
          + `ทุนต่ำสุดคือ ${money(floor)} บาท แบบ${term} เบี้ย ${formatBaht(least.total)} บาท/${per}\n`
          + "ถ้าสนใจแบบนี้ หรืออยากดูประกันสุขภาพที่เบี้ยเริ่มต้นต่ำกว่า บอกได้เลยครับ"
        : HAND_OVER),
      slots: kept,
    };
  }

  return {
    ...one([
      `งบ${per}ละ ${money(budget.baht)} บาท ${sex === "M" ? "ชาย" : "หญิง"}อายุ ${age} ปี ได้ทุนประมาณนี้ครับ 💰`,
      ...lines,
      ...(overBudget && budget.per === "month"
        ? [`(แบบชำระรายเดือนขั้นต่ำ ${money(table.minMonthly)} บาท/เดือน เบี้ยจึงเกินงบมานิดหน่อยครับ)`]
        : []),
      "งบเท่ากัน จ่ายยาวกว่าได้ทุนมากกว่า — สนใจแบบไหน บอกได้เลยครับ เดี๋ยวส่งใบเสนอให้",
    ].join("\n")),
    slots: kept,
  };
}

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
  const sumNow = slots.offer && slots.offer.coverWanted === coverWanted ? slots.offer.sumAssured : sumForCover(table, age, coverWanted);
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
    + (quoted
      ? `เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ ${quoted}\n`
        + "ถ้าจะพูดถึงตัวเลขเบี้ย ให้ใช้ตัวเลขชุดนี้เท่านั้น คัดลอกมาตรงๆ ห้ามคำนวณเอง ห้ามประมาณ ห้ามปัดเศษ\n"
        + "ถ้าลูกค้าอยากได้เบี้ยของอายุ ทุน หรือแบบชำระอื่น ห้ามตอบเป็นตัวเลข ให้บอกว่าเดี๋ยวคิดให้ แล้วให้เขาบอกมา"
      : "ถ้าลูกค้าอยากได้เบี้ย ให้ขอเฉพาะข้อมูลที่ยังขาด ห้ามตอบตัวเลขเบี้ยเอง");
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
