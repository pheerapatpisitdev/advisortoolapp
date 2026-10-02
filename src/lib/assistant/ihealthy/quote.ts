import type { Sex } from "@/calc/types";
import { iHealthyQuoteText } from "@/lib/ihealthy-cta";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { IHEALTHY_OPENING, type IHealthyInitial } from "@/lib/ihealthy-choice";
import { cardPath, queryFrom } from "@/lib/ihealthy-link";
import { quotePdfPath } from "@/lib/quote-pdf/link";
import { deathBenefitOf, iHealthyPricing, plansFor, shownAt, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { WANTS_IN, baht, one, type QuoteFigures, type Reply } from "../common";
import type { HealthSlots } from "./route";

/** What the bot says when only a person can answer. */
export const HEALTH_HAND_OVER =
  "เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้ครับ ระหว่างนี้ถามเรื่องไอเฮลท์ตี้ อัลตร้าได้เลย";

/** The words a tapped button sends, which are the words the bot reads back. */
export const SEE_OTHER_PLANS = "ดูแผนอื่น";
export const THIS_PLAN_BENEFITS = "ผลประโยชน์แผนนี้";

/**
 * The arrangement a quote is priced on.
 *
 * Everything but the age, the sex, the plan and the territory is the page's own opening: the
 * base contract, the sum it is written for, full cover, and the daily-cash rider the agency
 * attaches as standard. A chat is not the place to choose a life contract to hang health cover
 * on, and a page and a chat that opened on different ones would quote the same customer two
 * different totals.
 */
export function arrangementFor(slots: {
  age: number; sex: Sex; plan: string; territory?: string;
}): IHealthyInitial {
  return {
    ...IHEALTHY_OPENING,
    age: slots.age,
    sex: slots.sex,
    plan: slots.plan,
    territory: slots.territory ?? IHEALTHY_OPENING.territory,
  };
}

/** The buttons under a quotation. Titles stay under twenty characters, which is all Messenger shows. */
const QUOTE_REPLIES = [SEE_OTHER_PLANS, THIS_PLAN_BENEFITS, WANTS_IN];

/**
 * One plan quoted: the sales page's own words, its own picture, and every reason there is no
 * price said in the customer's terms rather than as a silence.
 *
 * The arrangement is rebuilt from the engine for both the text and the card, so the figures in
 * the message and the figures in the picture are one calculation rather than two that agree.
 *
 * The age is checked here and not left to the card: `initialFrom` pulls an age onto the rider's
 * range rather than refusing it, so a link for a five-year-old would quietly draw a six-year-old.
 */
export function healthQuote(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, today: Date = new Date(),
): Reply {
  const table = iHealthyTable(today);
  const { age, sex } = slots;

  if (age < table.ageMin || age > table.ageMax) {
    return one(`ไอเฮลท์ตี้ อัลตร้า รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ อายุ ${age} ปีอยู่นอกช่วงนี้ ${HEALTH_HAND_OVER}`);
  }
  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ${HEALTH_HAND_OVER}`);
  }

  const sellable = plansFor(table, age);
  const chosen = sellable.find((p) => p.code === slots.plan);
  if (!chosen) {
    const names = sellable.map((p) => planLabel(p.code)).join(" · ");
    return {
      ...one(`อายุ ${age} ปี บริษัทเขียนแผนนี้ไว้ให้เลือก ${names} ครับ สนใจแผนไหนบอกได้เลย`),
      replies: sellable.map((p) => planLabel(p.code)),
    };
  }

  // a territory the plan is not written for is not quoted in it; the caller has already told
  // the customer, and quoting Thailand under a heading that said เอเชีย would be worse
  const territories = territoriesFor(table, chosen.code, age);
  const territory = slots.territory && territories.includes(slots.territory)
    ? slots.territory
    : IHEALTHY_OPENING.territory;

  const v = arrangementFor({ age, sex, plan: chosen.code, territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan: v.plan, territory: v.territory, coverage: v.coverage,
  });
  const facts = iHealthyFacts();
  const text = iHealthyQuoteText({
    arrangement: {
      planName: planLabel(chosen.code),
      annualMax: chosen.annualMax,
      deductible: chosen.deductible,
      territory: v.territory,
      coverage: v.coverage,
    },
    copayPercent: facts.copayPercent,
    age,
    sex,
    baseLabel: table.bases.find((b) => b.variant === v.base)?.label ?? v.base,
    sumAssured: v.sumAssured,
    death: deathBenefitOf(table, v.base, age, v.sumAssured),
    mode: v.mode,
    minMonthly: table.minMonthly,
    shown: shownAt(priced, v.mode),
  });

  // no text means no price may be shown; the card would only say the same thing in a picture
  if (!text) {
    return one(`ตอนนี้ยังคิดราคาแผนนี้ให้ไม่ได้ครับ ${HEALTH_HAND_OVER}`);
  }

  const annual = priced?.total.find((m) => m.mode === "annual");
  return {
    messages: [{
      text,
      card: `${cardPath(table, v)}&fit=phone`,
      // the same arrangement the card draws, so the file and the picture are one quotation
      pdfPath: quotePdfPath({ kind: "ihealthy", query: queryFrom(table, v) }),
    }],
    priced: true,
    ...(annual
      ? {
          quote: {
            age, sex, plan: chosen.code, sumAssured: v.sumAssured,
            annual: baht(annual.total), territory: v.territory,
          } satisfies QuoteFigures,
        }
      : {}),
    replies: QUOTE_REPLIES,
  };
}

/** Whether this customer has been quoted: the three things a price needs. */
export function hasHealthQuote(slots: HealthSlots): boolean {
  return slots.age !== undefined && slots.sex !== undefined && slots.plan !== undefined;
}
