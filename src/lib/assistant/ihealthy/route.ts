import { chat, parseJsonReply } from "@/lib/ai/client";
import { askShadow, recordShadow } from "../shadow";
import type { ChatMessage } from "@/lib/ai/types";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { ageFromBirthdate, monthsOldIn, peopleIn, recentTurns, sexIn } from "../common";

/**
 * What the bot knows about a customer buying health cover.
 *
 * A different set of fields from the life plan's, not a superset of it: this contract is
 * chosen by plan and territory, where that one is chosen by a sum assured and a paying term.
 * `product` is what tells them apart in a session row that holds either.
 */
export interface HealthSlots {
  product: "ihealthy";
  intent: "quote" | "plan_info" | "other";
  age?: number;
  sex?: "M" | "F";
  /** a plan code the rate table sells, e.g. "GOLD" */
  plan?: string;
  /** a territory label the rate table spells; absent means ประเทศไทย, which is what it opens on */
  territory?: string;
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
  /** the application form has been handed over; "กรอกแล้ว" after this is about that form */
  formSent?: true;
}

/**
 * How the six plans are asked for, in both scripts.
 *
 * Read here rather than left to the model for the same reason the paying term is on the life
 * plan: the plan is the price. A customer who taps Gold and is quoted Silver has been shown a
 * figure ten thousand baht from the one they asked for, and the picture under it would
 * disagree with the words over it.
 *
 * Both scripts because the page sells these under their English names and the company's sheet
 * writes them in Thai — a customer reads one and types the other.
 */
const PLAN_WORDS: [string, RegExp][] = [
  ["PLATINUM", /แพลทินั่ม|แพลตตินั่ม|แพลทินัม|platinum/i],
  ["DIAMOND", /ไดมอนด์|ไดม่อน|diamond/i],
  ["GOLD", /โกลด์|โกล์ด|\bgold\b/i],
  ["SILVER", /ซิลเวอร์|silver/i],
  ["BRONZE", /บรอนซ์|บรอนซ|bronze/i],
  ["SMART", /สมาร์ท|สมาร์ต|\bsmart\b/i],
];

/**
 * The plan behind an annual ceiling said in millions — "เหมาจ่าย 10 ล้าน".
 *
 * This is how the adverts name the plans, and how customers repeat them back: the ceiling is
 * the thing being bought, where "Bronze" is a word they have to translate first. The figures
 * come from the benefit sheet rather than a second list of them, so a plan the company
 * re-prices is read correctly the day the sheet is re-extracted.
 *
 * An amount no plan is written for reads as nothing at all — "ทุน 1 ล้าน" is a sum assured on
 * the life contract, said in the wrong chat, and must not be turned into a health plan.
 */
function planByCeiling(text: string): string | undefined {
  const m = text.match(/(\d+)\s*ล้าน/);
  if (!m) return undefined;
  const baht = Number(m[1]) * 1_000_000;
  return iHealthyFacts().plans.find((p) => p.annualMax === baht)?.code;
}

/**
 * The plan a message asks for, by name or by what it pays in a year. The name wins where a
 * message carries both, because it is the less ambiguous of the two.
 */
export function planNamedIn(text: string): string | undefined {
  return PLAN_WORDS.find(([, re]) => re.test(text))?.[0] ?? planByCeiling(text);
}

/**
 * The territory a message asks for, as the rate table spells it.
 *
 * "ต่างประเทศ" reads as ทั่วโลก rather than as เอเชีย: it is the wider of the two, and a
 * customer quoted the narrower one would find that out at a hospital.
 */
const TERRITORY_WORDS: [string, RegExp][] = [
  ["ทั่วโลก", /ทั่วโลก|ทั้งโลก|ต่างประเทศ|เมืองนอก|worldwide|global/i],
  ["เอเชีย", /เอเชีย|asia/i],
  ["ประเทศไทย", /ในไทย|ในประเทศไทย|เฉพาะไทย|แค่ไทย/i],
];

export function territoryNamedIn(text: string): string | undefined {
  return TERRITORY_WORDS.find(([, re]) => re.test(text))?.[0];
}

/**
 * Asking to carry part of the bill in exchange for a smaller premium. Both arrangements are
 * real and both are sold in Thailand only — and neither is priced in this chat, so the
 * question is answered in words and handed on rather than routed to a quote.
 */
const SHARE_OF_BILL = /รับผิดส่วนแรก|ส่วนแรก|ร่วมจ่าย|มีส่วนร่วม|deductible|co\s*-?\s*pay/i;
export function asksShareOfBill(text: string): boolean {
  return SHARE_OF_BILL.test(text);
}

/** Asking for the whole benefit sheet, which is a web page and not a picture. */
const FULL_TABLE = /ตาราง(?:ผลประโยชน์)?(?:เต็ม|ทั้งหมด|ครบ)|เต็มๆ|ทุกหมวด|ครบทุกหมวด|ผลประโยชน์ทั้งหมด|ดูรายละเอียดทั้งหมด/;
export function asksFullTable(text: string): boolean {
  return FULL_TABLE.test(text);
}

/**
 * Asking for the picture — which exists, and which the bot sends unprompted.
 *
 * Separate from the sheet above, and necessary because of what happened without it. The
 * full-sheet pattern wants เต็ม, ทั้งหมด or ครบ after ตาราง, so "มีรูปตารางไหม" matched
 * nothing and the turn went to the model. The model knows what the plans cost; it does not
 * know this system draws pictures, so it said there were none — the agency's own chat denying
 * it has the thing it sends to customers every day.
 *
 * A picture word is required rather than a bare ตาราง, because ตาราง on its own is as likely
 * to mean the benefit sheet, which is a page with twenty-three categories on it and not
 * something the smaller picture can stand in for.
 */
const WANTS_PICTURE = /รูป|ภาพ|การ์ด|แคป|infographic|image|picture/i;
export function asksForPicture(text: string): boolean {
  return WANTS_PICTURE.test(text);
}

/** Asking what else there is besides the ones already on the table. */
const OTHER_PLANS = /แผนอื่น|แบบอื่น|อันอื่น|มีอีกไหม|ตัวอื่น|ที่เหลือ/;
export function asksOtherPlans(text: string): boolean {
  return OTHER_PLANS.test(text);
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกัน อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้กำลังคุยเรื่อง "ประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า" (iHealthy Ultra) สัญญาเพิ่มเติมค่ารักษาพยาบาลแบบเหมาจ่าย

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน อยากรู้ราคา เลือกแผน
- "plan_info" = ถามว่าคุ้มครองอะไร ค่าห้องเท่าไหร่ OPD ได้ไหม รอคอยกี่วัน ต่ออายุถึงอายุเท่าไหร่ แผนไหนต่างกันยังไง
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;

/** Reads the conversation and returns what the customer is asking for. Cheap model, strict JSON. */
export async function routeHealth(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthSlots> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  // the judge runs beside the model for now and decides nothing; see ../shadow
  const shadow = askShadow("ihealthy", history);
  const r = await chat({ tier: "small", task: "route_health", messages, maxTokens: 250, json: true });
  const parsed = parseJsonReply<Partial<HealthSlots>>(r.text) ?? {};
  const cleaned = clean(parsed, history);
  await recordShadow("ihealthy", shadow, cleaned.intent === parsed.intent ? cleaned.intent : (parsed.intent ?? "other"), cleaned.intent);
  return merge(previous, cleaned);
}

/** Anything the model returns is checked here, so an invented plan never reaches the engine. */
function clean(raw: Partial<HealthSlots>, history: ChatMessage[]): HealthSlots {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const out: HealthSlots = {
    product: "ihealthy",
    intent: raw.intent && ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other",
  };

  /**
   * The plan and the territory are read off the message and never taken from the model.
   *
   * Not "the message wins where it says something" — the model does not get a vote at all.
   * An ice breaker settled Bronze from "เหมาจ่าย 10 ล้าน"; the next turn was "ญ 34", which
   * names no plan, and the model handed back Smart. It won, and a customer who had asked for
   * ten million was quoted three. What the message does not name, `merge` carries over from
   * the turn that did name it — which is the customer's own last answer, not a guess.
   */
  const plan = planNamedIn(last);
  if (plan) out.plan = plan;

  const territory = territoryNamedIn(last);
  if (territory) out.territory = territory;

  // a birthdate in the message beats whatever age the model worked out from it, and a sex and
  // an age standing next to each other beat both
  const named = peopleIn(last);
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (named.length) out.age = named[0].age;
  // "อายุ 8 เดือน" is a baby of nought, however the model counted it (review 2026-10-01)
  else if (monthsOldIn(last) !== undefined) out.age = monthsOldIn(last);
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);

  // a birthdate leaves the sex standing alone, with no age beside it for `peopleIn` to pair
  const sexBesideDate = born !== undefined ? sexIn(last) : undefined;
  if (named.length) out.sex = named[0].sex;
  else if (sexBesideDate) out.sex = sexBesideDate;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;

  // a message that names a plan is asking what it costs, whatever the model called it
  if (out.plan !== undefined && out.intent === "other") out.intent = "quote";
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: someone who gave an age and a sex and then taps a plan is
 * still the same customer. The newer turn always wins.
 */
function merge(previous: HealthSlots | null, current: HealthSlots): HealthSlots {
  if (!previous) return current;
  const merged: HealthSlots = { ...current };
  // filling in what the quote was waiting for is still asking for the quote
  if (previous.intent === "quote"
      && (current.age !== undefined || current.sex !== undefined || current.plan !== undefined)) {
    merged.intent = "quote";
  }
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.plan === undefined) merged.plan = previous.plan;
  if (merged.territory === undefined) merged.territory = previous.territory;
  if (merged.formSent === undefined) merged.formSent = previous.formSent;
  return merged;
}
