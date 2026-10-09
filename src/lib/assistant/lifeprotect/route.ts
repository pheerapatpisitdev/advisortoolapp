import type { Budget } from "../common";
import { chat, parseJsonReply } from "@/lib/ai/client";
import { askShadow, recordShadow } from "../shadow";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { ageAlone, ageFromBirthdate, monthsOldIn, coverIn, peopleIn, recentTurns, sexIn } from "../common";
import type { RidersWanted } from "./riders";

/**
 * Re-exported where they have always been named from: these read a person out of a message,
 * which is neither plan's business, but every caller of this module already knows them here.
 */
export { ageFromBirthdate, peopleIn, recentTurns };

export type Intent = "quote" | "plan_info" | "other";

/** The plan this assistant sells. The adverts point at it and nothing else. */
export const PLAN_CODE = "LIFEPROTECT";

export interface Routed {
  intent: Intent;
  /**
   * Which brain these slots belong to. Optional because rows written before the health brain
   * existed have none, and those can only have been this plan's.
   */
  product?: "lifeprotect";
  /** a package of the plan, e.g. "WLF19H"; the answer decides whether it is one it may quote */
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  /**
   * Everyone the message named, in the order it named them.
   *
   * "ผญ 32 ผช33ค่ะ" is one message asking for two quotes — a couple pricing themselves
   * together, which is the larger sale. The first of them also fills `age` and `sex`, so a
   * conversation about one person is unchanged.
   */
  people?: { age: number; sex: "M" | "F" }[];
  /**
   * What the customer wants the family to receive, in baht — not the sum assured.
   *
   * "ทุน 3 ล้าน" in a customer's message means three million to the family, which on this
   * plan is a sum assured of one and a half before the booster age. Reading it as the sum
   * assured doubles both the cover and the premium, so the two are kept apart by name.
   */
  coverWanted?: number;
  mode?: "annual" | "semi" | "monthly";
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
  /**
   * A cheaper arrangement the bot has put on the table and not yet priced in full.
   *
   * Carried by sum assured as well as by cover, because the halved cover can land on the one
   * figure that is read as a sum assured — a customer who then says "1 ล้าน" would otherwise
   * be quoted the arrangement they just called too expensive.
   */
  offer?: { coverWanted: number; sumAssured: number; variant: string };
  /** the sum assured behind a taken offer, so a follow-up on the same cover keeps it */
  takenSum?: number;
  /** the application form has been handed over; "กรอกแล้ว" after this is about that form */
  formSent?: true;
  /**
   * What the customer said they can pay, when they said that instead of a sum.
   *
   * Kept because the two halves of the answer arrive in different turns: "ผมมีเดือนละ 1000"
   * first, the age and the sex when they are asked for. Dropped the moment a sum is named,
   * which is a customer who has stopped shopping by budget.
   */
  budget?: Budget;
  /**
   * The customer has been invited to name a budget, once, after their first quotation. Carried
   * so the invitation is not repeated under every price that follows.
   */
  budgetAsked?: true;
  /**
   * This turn checks a figure ("…เหลือ 1,500,000 ใช่ไหม"); the sum in it is not a request to
   * price one, and the cover already known stands. Read off this turn only and never carried.
   */
  checking?: true;
  /**
   * The riders asked for so far, read off the customer's own words (./riders), never by the
   * model. Carried, as the page carries them: a new sum is priced with the same riders until
   * the customer says they do not want them.
   */
  riders?: RidersWanted;
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกันชีวิต อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้เอเจนซี่ขายแบบเดียวคือ "Life Protect x 2" (ไลฟ์ โพรเทค+ 100 แบบจ่ายสองเท่าเมื่อเสียชีวิตก่อนอายุ 60)

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน ต้องคำนวณเป็นตัวเลข
- "plan_info" = ถามว่าคุ้มครองอะไร เสียชีวิตแล้วได้เท่าไหร่ รับอายุเท่าไหร่ ทุนขั้นต่ำ จ่ายกี่ปี เวนคืนได้เท่าไหร่
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- coverWanted จำนวนเงินที่ลูกค้าอยากให้ครอบครัวได้รับเมื่อเสียชีวิต เป็นบาท ("ทุน 1 ล้าน" = 1000000, "ทุน 5 แสน" = 500000)
- variant เป็น "WLF09H" (จ่าย 9 ปี) "WLF19H" (จ่าย 19 ปี) หรือ "WLF99H" (จ่ายถึงอายุ 99)
- mode เป็น "annual" (รายปี) "semi" (ราย 6 เดือน) หรือ "monthly" (รายเดือน)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;

/** Reads the conversation and returns what the customer is asking for. Cheap model, strict JSON. */
export async function routeMessage(history: ChatMessage[]): Promise<Routed> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  // the judge runs beside the model for now and decides nothing; see ../shadow
  const shadow = askShadow("lifeprotect", history);
  const r = await chat({ tier: "small", task: "route", messages, maxTokens: 300, json: true });
  /**
   * A reply that will not parse costs the model's reading of the turn, not the code's.
   *
   * It used to return a bare "other" and throw away everything `clean` reads for itself — the
   * people, the ages, the birth year, the term. A customer answered the bot's own question
   * with "ญ40 ช49", the model's reply came back unusable, and a couple who had just asked for
   * two premiums were told to wait for something nobody was going to send.
   */
  const parsed = parseJsonReply<Routed>(r.text);
  const out = clean(parsed ?? { intent: "other" }, history);
  await recordShadow("lifeprotect", shadow, parsed?.intent ?? "other", out.intent);
  return out;
}

/**
 * How ไลฟ์ โพรเทค+ names its payment terms, in the customer's words and in the workbook's.
 *
 * The plan sells six packages: three terms under two products that differ only in how much
 * they pay on early death. That is two decisions the model has to make from prose, and it
 * was making neither — a customer arriving from /lifeprotect having chosen "จ่าย 19 ปี" was
 * quoted the pay-to-99 term instead, at nearly half the premium the page had just shown.
 * A price that changes between the page and the chat is the one thing neither will forgive,
 * so both halves are read off the text here rather than left to the model.
 *
 * A term counts only where the customer is paying — "จ่าย 19 ปี", "ชำระเบี้ย 19 ปี" — never
 * from a bare number of years, because "อายุ 19 ปี" is an insured, not a term.
 */
const LIFEPROTECT_TERMS: [string, RegExp][] = [
  ["99", /(?:ถึง|ครบ)\s*อายุ\s*99|จนอายุ\s*99|to\s*99/i],
  ["19", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*19\s*ปี|19\s*ปีจบ/i],
  ["09", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*9\s*ปี|(?:^|[^\d])9\s*ปีจบ/i],
];

/** The x1.5 product; anything else on this plan is the x2 one the adverts point at. */
const LIFEPROTECT_HALF = /\+\s*50|x\s*1\.5|โพรเทค\s*\+?\s*50/i;

/**
 * The package a message asks for, when it names a payment term. Undefined when no term is
 * named, which leaves the choice to the model and then to the answer's own default.
 *
 * An x1.5 term is returned as itself rather than quietly turned into its x2 sibling: the
 * answer turns that request down in words, and it can only do that if it can see it.
 */
export function lifeProtectVariantIn(text: string): string | undefined {
  const term = LIFEPROTECT_TERMS.find(([, re]) => re.test(text))?.[0];
  if (!term) return undefined;
  return `WLF${term}${LIFEPROTECT_HALF.test(text) ? "L" : "H"}`;
}

/**
 * A sum and what it doubles to, said together: "ทุน 2,500,000 เพิ่มเป็น 5,000,000".
 *
 * It is the quotation's own headline read back — "ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000" — and
 * it settles what a lone figure cannot: the first number is the sum assured and the second is
 * what the family receives. Read alone, "ทุน 2,500,000" is taken as the family's figure and
 * halved, so a customer who wrote both was quoted 1,250,000 rising to 2,500,000.
 *
 * Returned as the family's figure, because that is what `coverWanted` holds. Only a pair
 * where the second is twice the first counts: that is the doubling this plan pays, and any
 * other pair is not a statement of it. After จาก it is a change of sum being asked for, and
 * is left to the reading it had before.
 */
const AMOUNT_WORD = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(ล้าน|แสน)?\s*(?:บาท)?`;
// "จาก 1 ล้าน เพิ่มเป็น 2 ล้าน" is a request to raise the sum, not a statement of one
const BOOSTED = new RegExp(
  `(?<![\\d,.]|จาก\\s*)${AMOUNT_WORD}\\s*(?:เพิ่ม(?:ขึ้น)?\\s*เป็น|กลายเป็น|x\\s*2\\s*=|→|->)\\s*(?:ได้\\s*)?${AMOUNT_WORD}`, "i",
);

function amountOf(digits: string, scale: string | undefined): number {
  const n = Number(digits.replace(/,/g, ""));
  // rounded, so "1.1 ล้าน" is 1,100,000 and not a float a hair above it
  return Math.round(n * (scale === "ล้าน" ? 1_000_000 : scale === "แสน" ? 100_000 : 1));
}

export function boostedCoverIn(text: string): number | undefined {
  const m = BOOSTED.exec(text);
  if (!m) return undefined;
  const sum = amountOf(m[1], m[2]);
  const family = amountOf(m[3], m[4]);
  if (!Number.isFinite(sum) || sum < 10_000 || family !== sum * 2) return undefined;
  return family;
}

/**
 * How people ask what the plan pays out — nearly always as a multiple of the sum, because
 * that is how the adverts word it. "ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม" is the campaign's
 * own headline being checked, and it is answered from the rate tables, so it must not be
 * left in the small-talk route where the model would answer it out of its own head.
 */
const DEATH_BENEFIT_QUESTION =
  /กี่เท่า|\d+(?:\.\d+)?\s*เท่า|สองเท่า|คูณ\s*(?:สอง|2)|\bx\s*2\b|ครอบครัวได้|ได้(?:รับ)?\s*เท่า(?:ไหร่|ไร)|(?:เสียชีวิต|ตาย)\s*(?:หลัง|ก่อน|เกิน|ตอน)\s*(?:อายุ\s*)?\d+|(?:หลัง|ก่อน|เกิน)\s*อายุ\s*\d+|(?:ทุน|คุ้มครอง)\s*(?:จะ)?\s*(?:เหลือ|ลด)/i;

/** Whether a message is asking what the plan pays on death. */
export function asksAboutDeathBenefit(text: string): boolean {
  return DEATH_BENEFIT_QUESTION.test(text);
}

/**
 * A customer checking a figure — "หลังอายุ 60 แล้ว ทุนเหลือ 1,500,000 ใช่ไหม", from someone
 * quoted 3,000,000 — rather than naming a sum to be priced. The answer is yes or no from the
 * cover already on the table; read as a new sum, it was quoted "ทุน 750,000 เพิ่มเป็น
 * 1,500,000" instead (chat 2026-10-06).
 */
const CONFIRMS = /ใช่\s*(?:ไหม|มั้ย|มั๊ย|หรือเปล่า|รึเปล่า|ป่าว)|จริง\s*(?:ไหม|มั้ย|หรือเปล่า|รึเปล่า)|หรือเปล่า|รึเปล่า/;
const NAMES_PREMIUM = /เบี้ย|ราคา/;

function checksDeathBenefit(text: string): boolean {
  return asksAboutDeathBenefit(text) && CONFIRMS.test(text) && !NAMES_PREMIUM.test(text);
}

/**
 * How someone asks for a price. It exists because the adverts ask for them on the
 * customer's behalf: every click-to-Messenger ad opens with buttons reading
 * "สนใจประกันมรดก ทุน 1,000,000", and the model called the identical phrasing plan_info on
 * one button and quote on the next two. That is the first message of nearly every
 * conversation the campaign pays for, so it is settled here rather than left to a coin flip.
 */
const ASKS_FOR_PRICE =
  /สนใจ|ขอ\s*เบี้ย|เบี้ย\s*เท่า|ราคา|คิดเบี้ย|เช็[กค]\s*เบี้ย|ทำทุน|อยากทำ|รายละเอียด|ขอทราบ|สอบถาม/i;

/** Whether a message asks for a premium on a sum it names. */
export function asksForPrice(text: string): boolean {
  return ASKS_FOR_PRICE.test(text) && !asksAboutDeathBenefit(text);
}

/**
 * Asking how long the premium has to be paid — "ต้องจ่ายถึงกี่ปี" — rather than asking what a
 * named term costs. The difference matters: the first wants one line, and was answered with
 * the whole quotation again, card and all, one message after the customer had received it.
 *
 * A message that names a term is the second kind and is left to the quote.
 */
const PAY_TERM_QUESTION =
  /(?:จ่าย|ส่ง|ชำระ)[^0-9]{0,12}(?:กี่ปี|นานไหม|นานแค่ไหน|นานเท่าไ|ถึงเมื่อไ|เมื่อไหร่|อีกกี่)|กี่ปี(?:ถึง)?(?:จะ)?(?:หมด|ครบ|จบ)/;

/** Whether a message is asking how long the premium runs for. */
export function asksPayTerm(text: string): boolean {
  return PAY_TERM_QUESTION.test(text) && lifeProtectVariantIn(text) === undefined;
}

/**
 * Asking for the contract year by year — "ขอตารางมูลค่า", "มูลค่าเวนคืนแต่ละปีเท่าไหร่".
 *
 * The quotation already carries four milestone ages, which answers whether the policy is
 * worth anything but not what it is worth in the year they retire. Someone asking for the
 * table wants all of it, and all of it is a picture rather than a paragraph.
 */
const VALUE_TABLE =
  /ตาราง\s*(?:มูลค่า|เวนคืน|เงินสด|ผลประโยชน์|ผลตอบแทน|กรมธรรม์)|ขอตาราง|(?:มูลค่า|เวนคืน|เงินสด|ได้คืน)[^\n]{0,12}(?:ทุกปี|แต่ละปี|รายปี|ปีต่อปี)/;

/** Whether the customer is asking for the year-by-year table. */
export function asksValueTable(text: string): boolean {
  return VALUE_TABLE.test(text);
}

/** Anything the model returns is checked here, so an invented package never reaches the engine. */
function clean(raw: Routed, history: ChatMessage[]): Routed {
  const out: Routed = { intent: ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other" };
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (out.intent === "other" && asksAboutDeathBenefit(last)) out.intent = "plan_info";
  const checking = checksDeathBenefit(last);
  if (checking) { out.intent = "plan_info"; out.checking = true; }

  // the term written in the message wins over the model's: it is what the customer chose,
  // and on a visitor from /lifeprotect it is what is on their screen
  const named = lifeProtectVariantIn(last);
  const variant = named ?? raw.variant;
  if (variant && variant in getPlan(PLAN_CODE)!.variantLabels) out.variant = variant;

  // everyone the message itself names, which the model cannot be relied on to count
  const namedPeople = peopleIn(last);
  if (namedPeople.length > 1) out.people = namedPeople;

  // a birthdate in the message beats whatever age the model worked out from it
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (namedPeople.length) out.age = namedPeople[0].age;
  // "อายุ 8 เดือน" is a baby of nought, however the model counted it (review 2026-10-01)
  else if (monthsOldIn(last) !== undefined) out.age = monthsOldIn(last);
  // "ขอเบี้ย อายุ 56", "56": an age said alone is read here, not left to the model
  else if (ageAlone(last) !== undefined) out.age = ageAlone(last);
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);

  // a birthdate leaves the sex standing alone, with no age beside it for `peopleIn` to pair
  const sexBesideDate = born !== undefined ? sexIn(last) : undefined;
  if (namedPeople.length) out.sex = namedPeople[0].sex;
  else if (sexBesideDate) out.sex = sexBesideDate;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  // "ทุน 2,500,000 เพิ่มเป็น 5,000,000" names both halves, and says outright which is which
  const boosted = boostedCoverIn(last);
  // a figure being checked is not a cover being asked for: the one already quoted stands
  if (checking) out.coverWanted = undefined;
  else if (boosted !== undefined) out.coverWanted = boosted;
  else if (typeof raw.coverWanted === "number" && raw.coverWanted > 0) out.coverWanted = Math.trunc(raw.coverWanted);
  // the model first, the message itself when the model read no amount at all
  else out.coverWanted = coverIn(last);
  if (raw.mode === "annual" || raw.mode === "semi" || raw.mode === "monthly") out.mode = raw.mode;
  // a sum the customer named, in a message asking for a price, is a request for a price
  if (out.intent !== "quote" && out.coverWanted !== undefined && asksForPrice(last)) out.intent = "quote";
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: "อายุ 35 ชาย" then "แล้วทุน 2 ล้านล่ะ" should still know
 * the age and sex. The newer turn always wins.
 */
export function mergeSlots(previous: Routed | null, current: Routed): Routed {
  // a first turn has nothing to carry, but it can still complete a quotation: "ทุน 1,000,000
  // ญ อายุ 40" as the opening line names all three and was answered with a paragraph whenever
  // the model called it anything but a quote — so it goes through the same rule below
  if (!previous) return mergeSlots({ intent: "other" }, current);
  const merged: Routed = { ...current };
  /**
   * Someone filling in what the quote was waiting for is still asking for the quote.
   *
   * The bot asks for a sex and an age; the customer sends "เกิด 14/12/2523 ผู้หญิง", which
   * names no price and reads to the model like a plan question. It was answered with a
   * paragraph and no premium, one message after the bot had promised one.
   *
   * The rule used to need the previous turn to have been a quote as well, which held only
   * while there was one plan to ask about. A family of three now taps a button first — the
   * model calls that turn a question about the plan — and their "ทุน1ล้าน" the turn after was
   * read as nothing in particular. So a turn that completes the three things a quotation
   * needs is a request for one, whatever the model called it.
   */
  const supplied = current.age !== undefined || current.sex !== undefined
    || current.coverWanted !== undefined || (current.people?.length ?? 0) > 0;
  // a turn that names its own people replaces the earlier ones rather than adding to them
  if (merged.people === undefined && current.age === undefined && current.sex === undefined) {
    merged.people = previous.people;
  }
  if (merged.variant === undefined) merged.variant = previous.variant;
  if (merged.coverWanted === undefined) merged.coverWanted = previous.coverWanted;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.mode === undefined) merged.mode = previous.mode;
  if (merged.offer === undefined) merged.offer = previous.offer;
  if (merged.takenSum === undefined && merged.coverWanted === previous.coverWanted) merged.takenSum = previous.takenSum;
  if (merged.formSent === undefined) merged.formSent = previous.formSent;
  if (merged.budgetAsked === undefined) merged.budgetAsked = previous.budgetAsked;
  // a sum named outright ends the shopping by budget; until then it is carried — and it is
  // carried past a quotation that was priced from it, so a tap on another term or a word about
  // another person is answered from the same money
  merged.budget = current.coverWanted === undefined ? previous.budget : undefined;

  // decided last, because it asks what is known once everything has been carried over: a turn
  // that completes the three things a quotation needs is a request for one
  const complete = ((merged.people?.length ?? 0) > 0 || (merged.age !== undefined && merged.sex !== undefined))
    && merged.coverWanted !== undefined;
  if (supplied && !current.checking && (previous.intent === "quote" || complete)) merged.intent = "quote";
  return merged;
}
