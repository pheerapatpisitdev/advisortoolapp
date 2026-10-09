import { bundleAgeRange, bundleModePremiums, describeTier, quoteBundle } from "@/calc/bundles/quote";
import { getBundle } from "@/calc/bundles/registry";
import { cardPath } from "@/lib/quote-card";
import { diseaseCardPath } from "@/lib/card-link";
import { formatBaht } from "@/calc/money";
import {
  aboutCompany, ageAlone, asksAboutCompany, asksDiseaseList, coverIn, FORM_RECEIVED, handOverForm, peopleIn, saysFormDone, saysUnwell, stallReply,
  stalls, thanksOnly, THANKS_REPLY, HEALTH_DECLARATION, WANTS_IN, wantsToBuy, type Reply,
} from "../common";
import { writtenFor, type Channel } from "../channel";
import { CHOOSE_HEALTH, CHOOSE_LIFE } from "../choose";

/**
 * The arrangement this brain sells, by the name the registry holds it under.
 *
 * One bundle rather than a list on purpose: the customer is choosing how much, not which
 * product, and the tier they pick is the whole of that choice.
 */
export const LEGACY_BUNDLE = "LEGACY_FAMILY";

/** A million baht to the family, which is what a tier number means here. */
const PER_TIER = 1_000_000;

/**
 * What this brain remembers between turns.
 *
 * Deliberately three fields. The arrangement fixes the plan, the package, the sum assured on
 * the base contract and the rider that sits on it, so there is nothing left for a customer to
 * decide except who they are and how large a legacy they want.
 */
export interface LegacySlots {
  product: "legacy";
  age?: number;
  sex?: "M" | "F";
  /** the tier, 1–10, which is also the millions the family receives */
  tier?: number;
  /**
   * Whether this arrangement has already introduced itself.
   *
   * Not "is this the first turn": a customer who taps across from another quotation arrives
   * carrying their age and sex, which used to read as a conversation already under way — so
   * they pressed a button naming a plan they had never been told anything about, and were
   * answered with a question. The leaflet belongs to the plan, so the plan records whether it
   * has handed it over.
   */
  told?: true;
  /** the application form has gone; the bot says nothing more in this thread */
  formSent?: true;
}

export type LegacyAnswer = Reply & { slots: LegacySlots };

/**
 * What the customer is told the moment they press the button, before anything is asked.
 *
 * The agency's own words, not a model's. Every line is a term of the contract as the bundle
 * file states it, which is the only kind of claim this system makes about a plan it sells —
 * and the premium is not among them, because no premium is known until an age is.
 */
export const LEGACY_OPENING = [
  "มรดกเพื่อครอบครัว — วงเงินใหญ่ เบี้ยเบาครับ 🛡",
  "• เสียชีวิต ครอบครัวรับ **เต็มวงเงิน** ที่เลือกไว้",
  "• ตรวจเจอ **1 ใน 31 โรคร้ายแรง** รับเงินสดก้อนใหญ่ทันที จ่ายครั้งเดียว",
  "• รับเงินโรคร้ายไปแล้ว **ประกันชีวิตยังอยู่ต่อ** 150,000 บาท ให้ครอบครัว",
  "• เลือกวงเงินได้ **1–10 ล้านบาท** ส่วนโรคร้ายคุ้มครองถึงอายุ 75",
].join("\n");

/** The sum the bot asks for, offered as the three tiers most people land on. */
export const LEGACY_TIERS = ["มรดก 1 ล้าน", "มรดก 3 ล้าน", "มรดก 5 ล้าน"];

const ASK_PERSON = "ขอทราบเพศกับอายุหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น ช 35)";

/**
 * The other arrangement, offered by the name its own brain answers to.
 *
 * A tapped button arrives as this sentence, so it has to be one the dispatcher reads as the
 * life plan — which is the whole mechanism: the customer changes product and keeps their age
 * and sex, and is quoted the comparison without being asked a single thing twice.
 */
const CROSS_SELL = CHOOSE_LIFE;

/**
 * The gap this arrangement leaves, offered to the customer who just bought into it.
 *
 * Nothing here pays a hospital. A critical-illness contract pays a sum once and ends; the
 * room, the doctor and the drugs arrive every time somebody is admitted, and they are
 * somebody else's contract. Saying so after a quotation is not an upsell bolted on, it is
 * the true shape of what the customer has just been shown.
 *
 * After, and never instead. It is not offered among the opening buttons: the advertisement
 * sells the legacies, and a fourth choice from a different half of a person's life is a way
 * of losing a lead that was paid for.
 */
const HEALTH_GAP = "เจอโรคร้ายได้เงินก้อนครั้งเดียว แต่ค่าห้องค่ารักษาที่มาทุกครั้งที่นอนโรงพยาบาล เป็นคนละส่วนกันครับ";
const ASK_TIER = "อยากได้วงเงินมรดกเท่าไหร่ครับ เลือกได้ 1–10 ล้าน";

/**
 * Why an age can be turned away here and not on the plain life plan.
 *
 * The critical-illness contract inside this arrangement is issued from 20 to 65, where the
 * life contract under it runs to 80. Someone outside that cannot be sold this bundle at all —
 * so they are told once, plainly, and pointed at the plan that would take them, rather than
 * being walked through a sum and a payment mode to arrive at a refusal.
 */
function outOfRange(age: number): string | undefined {
  const bundle = getBundle(LEGACY_BUNDLE);
  if (!bundle) return undefined;
  const { min, max } = bundleAgeRange(bundle);
  if (age >= min && age <= max) return undefined;
  return `แบบนี้รับประกันอายุ ${min}–${max} ปีครับ อายุ ${age} สมัครแบบนี้ไม่ได้`
    + " แต่แบบมรดกเบี้ยไม่ทิ้งยังทำได้อยู่ สนใจให้คิดเบี้ยให้ไหมครับ";
}

/**
 * The tier a message names, read from the sum rather than from a tier number.
 *
 * Customers say "3 ล้าน", never "เทียร์ 3", and the tap on a quick reply arrives as the
 * button's own words — "มรดก 3 ล้าน" — which is the same sentence. Both are read by the sum
 * the agency named the tier after, so there is one reader and not two.
 */
export function tierIn(text: string): number | undefined {
  const cover = coverIn(text);
  if (cover === undefined || cover % PER_TIER !== 0) return undefined;
  const tier = cover / PER_TIER;
  return getBundle(LEGACY_BUNDLE)?.tiers.some((t) => t.no === tier) ? tier : undefined;
}

/** Everything the message adds to what was already known. */
function filled(previous: LegacySlots | null, asked: string): LegacySlots {
  const slots: LegacySlots = { product: "legacy", ...previous };
  // an age on its own changes the age of the person already being priced: "ขอเบี้ย อายุ 56"
  // was answered with the 35-year-old of the turn before (LINE, 2026-10-09)
  const lone = ageAlone(asked);
  const person = peopleIn(asked)[0] ?? (slots.sex && lone !== undefined ? { age: lone, sex: slots.sex } : undefined);
  if (person) {
    slots.age = person.age;
    slots.sex = person.sex;
  }
  const tier = tierIn(asked);
  if (tier !== undefined) slots.tier = tier;
  return slots;
}

/**
 * One turn of the legacy conversation, without a model anywhere in it.
 *
 * Nothing here needs one. The arrangement has two unknowns, both of them read by code the
 * bot already trusts to read a customer's message — and the figure at the end is the engine's.
 * A model in this path could only add a rounding of somebody's premium and a bill for it.
 */
export function answerLegacy(
  asked: string, previous: LegacySlots | null, channel: Channel = "web", today: Date = new Date(),
): LegacyAnswer {
  const slots = filled(previous, asked);
  const said = (text: string) => writtenFor(channel, text);
  const priced = previous?.tier !== undefined;

  /**
   * The three things a customer says that are not about this contract's numbers.
   *
   * They were the life plan's alone, and a customer who typed "สมัครยังไง" at either of the
   * new arrangements was answered with the next question about a sum. The words are the same
   * words and the agency's answer is the same answer — a form, and a person to follow it — so
   * they are read here by the same code rather than by a second copy of it.
   *
   * Checked before the slots are acted on, because "สนใจสมัคร" is not a tier and not a saving,
   * and because a customer leaving to think it over must not be asked one more question.
   */
  /**
   * The thirty-one, as a picture, before anything else is worked out.
   *
   * Asked at any point in the conversation and answered the same way: the list does not
   * depend on who is asking or what they have chosen, so it does not wait for an age.
   */
  if (asksDiseaseList(asked)) {
    return {
      messages: [{
        text: said("รายชื่อโรคร้ายแรงทั้ง 31 โรคที่คุ้มครองครับ 🙏 กดที่รูปเพื่อดูเต็ม บันทึกส่งต่อให้ที่บ้านดูได้เลย"),
        card: diseaseCardPath("DCI"),
      }],
      slots,
    };
  }

  // "บริษัทอะไร" was answered with the quote again: the life brain had this check and these
  // two did not. The agency's own sentence, whatever else the conversation is about.
  if (asksAboutCompany(asked)) return { messages: [{ text: said(aboutCompany(asked)) }], slots };

  /**
   * A condition, or a question about a health check, answered before the form is.
   *
   * "ต้องตรวจสุขภาพหรือไม่" was answered with the quotation again (Messenger, 2026-10-07), and
   * "เป็นเบาหวานสมัครได้ไหม" holds the word "สมัคร". Whether someone can be insured is the
   * underwriter's answer, so they are told about the declaration and nothing is sent.
   */
  if (saysUnwell(asked)) return { messages: [{ text: said(HEALTH_DECLARATION) }], slots };

  if (wantsToBuy(asked, priced)) {
    const form = handOverForm(priced);
    // the flag the report counts and the inbox reads as "an agent has this one now"
    return {
      ...form,
      messages: form.messages.map((m) => ({ ...m, text: said(m.text) })),
      slots: { ...slots, formSent: true },
    };
  }
  if (saysFormDone(asked)) {
    return { messages: [{ text: said(FORM_RECEIVED) }], formDone: true, slots };
  }
  // a bare thank-you is not a request: left to the rest it is read as the tier again and priced
  if (thanksOnly(asked)) return { messages: [{ text: said(THANKS_REPLY) }], slots };
  if (stalls(asked)) {
    return { messages: [{ text: said(stallReply(priced)) }], slots };
  }

  /**
   * The question comes before the leaflet.
   *
   * Someone who has just pressed a button will answer one thing, and that willingness was
   * being spent on reading: four lines of contract terms arrived first, and the question they
   * were meant to answer sat underneath them. So the plan asks who it is pricing for, and
   * introduces itself on the turn after — beside the next question, when the customer has
   * already shown they are answering.
   */
  if (slots.age === undefined || !slots.sex) {
    return { messages: [{ text: said(ASK_PERSON) }], slots };
  }

  // the opening is said once per arrangement: not every time something is asked, which
  // would read as a leaflet handed over twice, and not never, which is how a customer who
  // crossed over from the other plan was treated
  const opening = previous?.told ? [] : [{ text: said(LEGACY_OPENING) }];
  slots.told = true;

  const refusal = outOfRange(slots.age);
  if (refusal) return { messages: [{ text: said(refusal) }], slots: { product: "legacy" } };

  if (slots.tier === undefined) {
    return { messages: [...opening, { text: said(ASK_TIER) }], replies: LEGACY_TIERS, slots };
  }

  return quoted(slots as Required<Omit<LegacySlots, "product">> & LegacySlots, said, today);
}

/** The arrangement priced, as a sentence and a picture of the same figures. */
function quoted(
  slots: LegacySlots & { age: number; sex: "M" | "F"; tier: number },
  said: (text: string) => string,
  today: Date,
): LegacyAnswer {
  const bundle = getBundle(LEGACY_BUNDLE);
  const result = bundle && quoteBundle(bundle, slots.tier, { ...slots, mode: "annual" }, today);
  if (!bundle || !result || result.totalAnnual === 0) {
    return {
      messages: [{ text: said("ขออภัยครับ วงเงินนี้กับอายุนี้จัดให้ไม่ได้ ลองเลือกวงเงินอื่นดูไหมครับ") }],
      replies: LEGACY_TIERS,
      slots: { ...slots, tier: undefined },
    };
  }

  const modes = bundleModePremiums(bundle, slots.tier, { age: slots.age, sex: slots.sex }, today) ?? [];
  /**
   * The monthly figure is offered only when it may actually be paid monthly.
   *
   * The plan holds a floor on what a monthly instalment may be, and quoting one under it is
   * quoting a payment the insurer will not accept — which the customer finds out at the
   * counter rather than here.
   */
  const monthly = modes.find((m) => m.mode === "monthly" && !m.belowMinimum);
  const name = describeTier(bundle, slots.tier) ?? `มรดก ${slots.tier} ล้าน`;

  /**
   * "ปีแรก" is not a hedge and is not optional.
   *
   * The critical-illness contract is priced on the age attained each year, so the figure the
   * customer is reading is the first year's and every later one is larger. A premium said
   * without that word is a promise the second renewal notice breaks.
   */
  const lines = [
    `${name} สำหรับ${slots.sex === "M" ? "ชาย" : "หญิง"}อายุ ${slots.age} ปี`,
    `เบี้ย**ปีแรก** ${formatBaht(result.totalAnnual)} บาท/ปี`
      + (monthly ? ` หรือ ${formatBaht(monthly.total)} บาท/เดือน` : ""),
    "เบี้ยส่วนโรคร้ายคิดตามอายุจริง ปีถัดไปจะขยับขึ้นตามอายุครับ",
  ];

  /**
   * What to offer after a premium, said by the brain that knows what follows from it.
   *
   * Left to the page, a quotation here was followed by "ขอตารางมูลค่า" — the life plan's own
   * next question, and a dead end on an arrangement whose premium is spent rather than saved.
   * What actually follows is a larger legacy, or the other way of leaving one: the customer's
   * age and sex are already known, so the comparison costs them nothing to ask for.
   */
  const after = [
    WANTS_IN,
    CHOOSE_HEALTH,
    ...LEGACY_TIERS.filter((t) => tierIn(t) !== slots.tier).slice(0, 2),
    CROSS_SELL,
  ];

  return {
    replies: after,
    messages: [
      {
        text: said(lines.join("\n")),
        card: cardPath({ kind: "bundle", bundleCode: LEGACY_BUNDLE, tier: slots.tier, age: slots.age, sex: slots.sex, mode: "annual" }),
      },
      // its own bubble, and after the card: a person says the price, then adds the thought
      { text: said(HEALTH_GAP) },
    ],
    priced: true,
    slots,
  };
}
