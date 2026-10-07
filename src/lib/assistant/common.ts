import type { ChatMessage } from "@/lib/ai/types";
import { listPlans } from "@/calc/plans/registry";
import { businessDate } from "@/calc/calendar";
import { siteUrl } from "@/lib/site-url";
import { INSURER } from "@/lib/insurer";

/**
 * What a bot on this page is, before it is a bot about any particular plan.
 *
 * The shape of a reply, the words a customer hears when they step back or decide to go ahead,
 * and the questions that are answered the same way whatever is being sold — who insures this,
 * is the price negotiable, is the form filled in. All of it was inside the Life Protect brain
 * because there was only one brain. A second one would otherwise have had to answer the same
 * questions in its own words, and two bots in one inbox that word the same answer differently
 * is a customer noticing they are talking to a machine.
 */

/** One message the bot sends, and the picture that follows it. */
export interface Said {
  text: string;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
  /**
   * The sales page's PDF of the quote on this message, as a path on this site.
   *
   * Remembered, never sent: the dispatcher keeps the latest one so a later "ขอไฟล์ PDF" can
   * be answered with it (pdf.ts). Set beside the card from the same input, so the file
   * prints exactly what the picture shows.
   */
  pdfPath?: string;
  /**
   * The PDF this message hands over, as a path on this site — only on the turn that answers a
   * request for the file. A separate field from `pdfPath` because every channel delivers what
   * is here, and a quote that carried it would send a file nobody asked for.
   */
  file?: string;
  /** the three-plan menu, which a Page may have written in its own words (page-welcome.ts) */
  menu?: boolean;
  /**
   * The first thing a Page says to a customer, which Messenger sends with the Page's welcome
   * pictures ahead of it (page-welcome.ts). Every other channel reads `text` and never looks here.
   */
  opening?: boolean;
}

/** A person does not send one long block; the model's paragraphs go out as separate bubbles. */
export const MAX_BUBBLES = 3;

/**
 * Who stands behind the policy, in the agency's own words rather than a model's.
 *
 * The insurer is a constant because the project holds no other record of it, and because a
 * model asked the question agreed with whichever name the customer proposed. Anything about
 * the people — a licence, whether they can be trusted — is not a fact this code has, so it
 * is handed to someone who does.
 */
export { INSURER };

export const ABOUT_INSURER = `แบบประกันนี้รับประกันโดย ${INSURER} ครับ 🙏`;

export const ABOUT_TRUST = "ถ้าอยากคุยรายละเอียดเพิ่ม ถามในแชทนี้ได้เลยครับ เดี๋ยวแอดมินดูให้";

/**
 * The answer to a question about who stands behind the policy: the insurer, and only the
 * insurer — the owner took the agents' names and licence numbers out of the chat on
 * 2026-09-23. Built from constants and never from a model — asked the same question, a model
 * agreed with whichever company name the customer had guessed.
 *
 * It ends there. It used to close by asking for an age and a sex, which reads as not
 * listening to a customer who has already given both — and the question was answered, so
 * there is nothing to add to it.
 */
export function aboutCompany(question: string): string {
  const tail = asksAboutTrust(question) ? ["", ABOUT_TRUST] : [];
  return [ABOUT_INSURER, ...tail].join("\n");
}

/**
 * The application form the agency sends a customer who has decided. The `ref` names the
 * agent, so the form arrives already knowing who sold it.
 */
export const APPLICATION_FORM = "https://ktaxaform.vercel.app/?ref=sa-9f3a";

export const FORM_NEXT = "กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวแอดมินเช็กข้อมูลแล้วดูแลขั้นตอนต่อให้ครับ";
export const FORM_RECEIVED = "ขอบคุณครับ 🙏 เดี๋ยวแอดมินเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ";

export const WANTS_IN = "สนใจสมัคร";

/** The words a tapped button sends, which are the words the Life Protect brain reads as a request for the table. */
export const ASK_FOR_TABLE = "ขอตารางมูลค่า";

/**
 * Everything an answer is except which plan it was about.
 *
 * The slots are the one part that differs between brains, so each brain adds its own:
 * `type Answer = Reply & { slots: Routed }`.
 */
export interface Reply {
  /**
   * What the bot sends, in the order it sends it.
   *
   * A list rather than one string because a customer pricing a couple — "ผญ 32 ผช33ค่ะ" —
   * is owed a quote each, and two quotes in one bubble is a wall of figures nobody can read
   * back to their partner.
   */
  messages: Said[];
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
  /**
   * The model that worded this reply, when one did — plan questions and small talk.
   *
   * Unset means the words are the engine's own or written out in this code. The website prints
   * a line under every answer saying where it came from, and it printed "เครื่องคิดเบี้ยของระบบ"
   * under free model prose too (review 2026-10-01): a customer reading that line is told the
   * figures in it were computed, which is exactly what a model's figures are not.
   */
  writtenBy?: string;
  /**
   * the customer has said the application form is filled in
   *
   * It rides here beside `priced` for the same reason that one does: the turn that knows it
   * is inside a brain, and the only thing that needs to hear it is the recorder outside both.
   */
  formDone?: boolean;
  /**
   * The figures behind that premium, for the record rather than for the customer.
   *
   * The customer is told these in words, and the words are the one thing the report may not
   * keep. Carried here instead so a quotation can be written down as numbers — and so the
   * lead's "เบี้ยที่เสนอ" is the figure the bot actually said, not one recomputed later from
   * slots that have since moved on.
   */
  quote?: QuoteFigures;
  /**
   * Buttons offered under the last thing sent.
   *
   * A quotation ends with an invitation nobody acts on — it is the last line of twenty, under
   * a picture. The same invitation as a row of buttons is one tap, and a tap arrives as the
   * words themselves, so every title here is a sentence the bot already answers.
   */
  replies?: string[];
}

/**
 * A quotation, as figures.
 *
 * `sumAssured` and `coverWanted` are kept apart by name for the reason the life plan's slots
 * keep them apart: on that contract the family receives twice the sum assured before the
 * booster age, and a report that confuses the two states a cover it never quoted.
 *
 * Money is in baht. The tables price in satang and this divides once, here, so that nothing
 * downstream has to remember which it is holding.
 */
export interface QuoteFigures {
  age: number;
  sex: "M" | "F";
  /** the package quoted: a term variant for the life plan, a plan code for the health one */
  plan: string;
  /** the sum assured, in baht */
  sumAssured: number;
  /** the yearly premium, in baht */
  annual: number;
  /** what the customer asked the family to receive, in baht — the life plan only */
  coverWanted?: number;
  /** where the health plan covers; absent on the life plan, which has no territory */
  territory?: string;
}

/** Satang, as the tables hold it, to baht, as a person says it. */
export function baht(satang: number): number {
  return Math.round(satang) / 100;
}

/** The usual case: the bot says one thing. */
export function one(text: string, card?: string): Reply {
  return { messages: [card ? { text, card } : { text }] };
}

/**
 * A person does not send one long block; the model's paragraphs go out as separate bubbles.
 *
 * The fallback is each brain's own: a health customer told "ขออายุ เพศ กับทุนที่สนใจ" would be
 * asked for something this contract never uses.
 */
export function spoken(text: string, fallback: string): Reply {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return one(fallback);
  if (parts.length <= MAX_BUBBLES) return { messages: parts.map((t) => ({ text: t })) };
  // more than fits: the last bubble carries the rest, so nothing is dropped and none is empty
  const head = parts.slice(0, MAX_BUBBLES - 1);
  const tail = parts.slice(MAX_BUBBLES - 1).join("\n\n");
  return { messages: [...head, tail].map((t) => ({ text: t })) };
}

/**
 * A model's reply, with any baht figure it was not given taken out.
 *
 * The prompts forbid a model to work out a premium, and say so at length; asked whether the
 * premium was level, it still answered 3,790 a month where the engine had quoted 3,861. A rule
 * in a prompt is a request. This is the check behind it (review 2026-10-01).
 *
 * `given` is everything the model was shown — its system prompt with the engine's figures in
 * it, the knowledge, and the turns of the conversation, which hold every quotation already
 * sent and every figure the customer typed. A figure found there is one the model copied, and
 * is left alone: the engine's own numbers must never be the casualty of this.
 *
 * What counts as a figure: any number followed by บาท or ฿, and any number with thousands
 * separators on a line that talks about paying — เบี้ย, ผ่อน, จ่าย, เดือนละ, ปีละ, งวด. Plain
 * small numbers (an age, a paying term, a count of illnesses) are not money and are not read.
 *
 * Only the lines carrying an invented figure go; the rest of the answer stands. When nothing
 * is left, `fallback` is said instead.
 */
const BAHT_FIGURE = /(\d[\d,]*(?:\.\d+)?)\s*(?:บาท|฿)/g;
const GROUPED_FIGURE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?/g;
const PAYING_WORDS = /เบี้ย|ผ่อน|จ่าย|เดือนละ|ปีละ|งวด|รายเดือน|รายปี|ราคา/;
const ANY_NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const asNumber = (figure: string) => Number(figure.replace(/,/g, ""));

/** The baht figures a line states, as numbers. */
function bahtFiguresIn(line: string): number[] {
  const out = [...line.matchAll(BAHT_FIGURE)].map((m) => asNumber(m[1]));
  if (PAYING_WORDS.test(line)) out.push(...[...line.matchAll(GROUPED_FIGURE)].map((m) => asNumber(m[0])));
  return out.filter((n) => Number.isFinite(n));
}

/** The baht figures in a model's text that appear nowhere in what it was given. */
export function inventedFigures(text: string, given: string): number[] {
  const known = new Set([...given.matchAll(ANY_NUMBER)].map((m) => asNumber(m[0])));
  return [...new Set(text.split("\n").flatMap(bahtFiguresIn))].filter((n) => !known.has(n));
}

export function keepGivenFigures(text: string, given: string, fallback: string): string {
  if (inventedFigures(text, given).length === 0) return text;
  const kept = text.split("\n").filter((line) => inventedFigures(line, given).length === 0);
  console.warn("ตัดตัวเลขเบี้ยที่โมเดลคิดเองออก:", inventedFigures(text, given).join(", "));
  const left = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return left || fallback;
}

/**
 * Handing over the form: three bubbles, the link on its own so it is one tap. Someone who
 * asks how to apply before hearing a price is also told the price is a message away — the
 * only time the bot volunteers that, because here it knows nothing has been quoted.
 *
 * `quoted` rather than the slots themselves: what counts as a quote differs between plans
 * (a sum assured on one, a chosen health plan on the other) and neither answer differs.
 */
export function handOverForm(quoted: boolean): Reply {
  const next = quoted ? FORM_NEXT : `${FORM_NEXT} ถ้าอยากทราบเบี้ยก่อน บอกเพศกับอายุมาได้เลยครับ เดี๋ยวคิดให้`;
  return { messages: [{ text: APPLY_STEPS }, { text: APPLICATION_FORM }, { text: next }] };
}

/**
 * How buying works, step by step — the owner's own account of it (2026-09-26), set in order
 * and sent word for word whenever a customer decides to apply or asks what it takes:
 * "ใช้เอกสารอะไรบ้าง", "ต้องทำยังไง", "ซื้อยังไง", สนใจสมัคร, เอาแบบนี้. It used to be one line
 * and the form, which left a customer who asked about documents without an answer.
 */
export const APPLY_STEPS = [
  "ขั้นตอนสมัครทำออนไลน์ได้ทั้งหมดเลยครับ 😊",
  "",
  "1️⃣ กรอกฟอร์มออนไลน์ตามลิงก์ด้านล่าง",
  "2️⃣ เตรียมบัตรประชาชนตัวจริงที่ยังไม่หมดอายุ",
  "3️⃣ รอ SMS จากบริษัทเพื่อยืนยันตัวตน (e-KYC) สำหรับการซื้อประกันออนไลน์",
  " • เปิด SMS แล้วกดลิงก์ ทำตามขั้นตอนบนหน้าจอ",
  " • ถ่ายรูปบัตรประชาชน ด้านหน้าและด้านหลัง",
  " • ถ่ายเซลฟี่คู่กับบัตรประชาชน",
  "4️⃣ รอระบบตรวจสอบสักครู่",
  "5️⃣ ชำระเบี้ยผ่านลิงก์ใน SMS ที่บริษัทส่งมา หรือถ้าสะดวกสแกน QR Code เดี๋ยวแอดมินส่งให้ในแชทนี้",
  "",
  "เท่านี้ก็เรียบร้อยครับ 🙏",
].join("\n");

/**
 * Handing a company over: the page, and a person.
 *
 * The owner's decision, and the second one they made about this. The assistant briefly knew
 * the group product well enough to describe it — the risk classes, the six plans, the cover
 * across all of them — and that was taken back out. Group cover is sold to a company across
 * a meeting-room table and they want a person in that conversation, not a chat window.
 *
 * Written out rather than left to a model, which is the part worth keeping. The version that
 * asked a model to send this link was watched doing exactly what a prompt cannot prevent: it
 * had the instruction in front of it, wrote a perfectly sensible answer, and left the link
 * out. Three fixed bubbles cannot leave the link out, cannot invent a premium, and cost
 * nothing to send.
 *
 * The link is on its own bubble so it is one tap, the same as the form above.
 */
export function handOverGroup(): Reply {
  return {
    messages: [
      { text: "ประกันกลุ่มสำหรับองค์กรมีครับ 😊 คิดเบี้ยและออกใบเสนอราคาได้ที่หน้านี้เลย" },
      { text: siteUrl("/group-insurance") },
      { text: "รายละเอียดความคุ้มครองและเงื่อนไขของแบบกลุ่ม แจ้งจำนวนพนักงานกับลักษณะธุรกิจไว้ในแชทนี้ได้เลย เดี๋ยวแอดมินเช็กให้แล้วติดต่อกลับไปครับ" },
    ],
  };
}

/**
 * The invitation taken up a word short.
 *
 * The bot is told to end an answer with พิมพ์ว่า "สนใจสมัคร", and a customer who had just
 * asked about the medical check wrote back "สนใจ" — one word short of the phrase, and plainly
 * the same answer. He got the four buttons again, as though the conversation had not happened.
 *
 * So a bare yes counts as the form, but only where the bot had just offered it: "สนใจ" from
 * someone who has been offered nothing is still someone to ask which plan they came for.
 */
const INVITED_FORM = new RegExp(WANTS_IN);

export function tookUpTheOffer(asked: string, lastSaid: string | undefined): boolean {
  return Boolean(lastSaid && INVITED_FORM.test(lastSaid) && affirms(asked));
}

/**
 * What the bot says when the customer steps back. One line, no question, and — once they
 * have a quotation in hand — the door left open by name: the owner's choice, over silence
 * and over a follow-up.
 */
export function stallReply(quoted: boolean): string {
  return quoted
    ? "ได้เลยครับ ถ้าตัดสินใจแล้วหรืออยากได้ใบเสนออย่างเป็นทางการ ทักมาได้เลยนะครับ"
    : "ได้เลยครับ สะดวกเมื่อไหร่ทักมาได้เลยนะครับ";
}

/**
 * Someone who says they have a condition must not be told they will be accepted, whichever
 * plan they are asking about. It is the first answer both FAQ lists check for, for that reason.
 */
export const HEALTH_QUESTION =
  /โรคประจำตัว|มีโรค|เป็นโรค|ป่วยเป็น|เบาหวาน|ความดัน|ไทรอยด์|หอบ|ภูมิแพ้|มะเร็ง|หัวใจ|ผ่าตัด|ตรวจสุขภาพ|แถลงสุขภาพ|สุขภาพไม่ดี|กินยา|รักษาตัว/i;

export const HEALTH_DECLARATION =
  "มีโรคประจำตัวยื่นขอทำประกันได้ครับ แต่ต้องแถลงข้อมูลสุขภาพตามจริงในใบคำขอ "
  + "แล้วบริษัทจะพิจารณาเป็นรายบุคคล — อาจรับตามปกติ มีเบี้ยเพิ่ม หรือมีข้อยกเว้นเฉพาะโรค\n"
  + "ผลพิจารณาผมตอบแทนบริษัทไม่ได้ครับ เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้ 🙏\n"
  + "และไม่ต้องส่งรายละเอียดสุขภาพหรือผลตรวจมาในแชทนะครับ";

/**
 * The last few turns, always beginning with something the customer said. Cutting a
 * conversation to a fixed length can land on an assistant turn, and providers differ on
 * whether they accept a reply with nothing to reply to — one refuses outright. Starting on
 * a user turn keeps every provider in the failover chain usable.
 */
export function recentTurns(history: ChatMessage[], count: number): ChatMessage[] {
  const recent = history.slice(-count);
  const first = recent.findIndex((m) => m.role === "user");
  return first < 0 ? [] : recent.slice(first);
}

/**
 * Asking which company stands behind the policy — by name, by "ของบริษัทอะไร", or by
 * proposing a rival and waiting to be agreed with.
 *
 * Answered from a constant rather than by a model. Nothing in this project records the
 * insurer: asked "กรุงไทยแอกซ่าใช่ไหม", the model said "ใช่ครับ", which was agreement with
 * whatever name the customer happened to type, about the company that would be insuring
 * their life. A rival's name is matched too, so that guess is corrected rather than confirmed.
 *
 * The short forms count as the same question. Customers drop the noun — "ของอะไรครับ",
 * "ประกันของใครคะ", "เจ้าไหน" — and mean exactly which company. Left out, those reached the
 * model, which has no business naming one. "ที่ไหน" is deliberately absent: "ซื้อได้ที่ไหน"
 * asks where to buy, not who sells.
 *
 * The words between "บริษัท" and "อะไร" are the part that had to be loosened. A customer on
 * the advertisement wrote "บริษัท ประกัน ของ อะไร" and the pattern, which wanted the two
 * words touching, did not know it: the question went to the model, which is told never to
 * name an insurer, and he was answered "เป็นระบบช่วยตอบของเพจครับ" — told what the bot was
 * when he had asked who would be insuring his life. The gap is spelled out word by word
 * rather than left as "anything at all", because "บริษัทจะตรวจสุขภาพไหม" is a question about
 * underwriting and must not be answered with a company's name.
 *
 * "บ." is บริษัท as people type it on a phone: "ขอโทษค่ะ บ.ชื่ออะไรคะ" came off the
 * advertisement and was not heard. Some drop the point ("บไหน", "บ ไหน") or write the long
 * abbreviations ("บจก.ไหน", "บมจ.ไหน"). A bare บ counts only where it starts a word, because
 * "แบบไหน" ends in บ too and asks which plan, not which company.
 */
const INSURER_FILLER = String.raw`(?:\s*(?:ประกัน(?:ชีวิต)?|ของ|นี้|นั้น|อัน|ชื่อ))*\s*`;
const INSURER_QUESTION = new RegExp(
  String.raw`(?:บริษัท|บ(?:จก|มจ)?\.|(?<![\u0E00-\u0E7F])บ(?:จก|มจ)?)${INSURER_FILLER}(?:อะไร|ไหน|ไร)`
  + String.raw`|ของ\s*บริษัท|ของ\s*อะไร|ของ\s*ใคร|เจ้า\s*ไหน|ของ\s*ค่าย|ค่าย\s*ไหน`
  + String.raw`|ผู้รับประกัน|รับประกันโดย|แบรนด์`
  + String.raw`|กรุงไทย|แอกซ่า|axa|เมืองไทย|เอไอเอ|\baia\b|ไทยประกัน|พรูเด็นเชียล|prudential`
  + String.raw`|allianz|อลิอันซ์|\bfwd\b|โตเกียว|กรุงเทพประกัน|ไทยพาณิชย์|\bscb\b`,
  "i",
);

/**
 * Asking about the people rather than the company: a licence, a brokerage, whether any of
 * them can be trusted. The insurer can be named from a constant; none of this can, so it
 * goes to a person.
 */
const TRUST_QUESTION = /ใบอนุญาต|นายหน้า|ตัวแทนของ|เชื่อถือ|มั่นคง|โกง|หลอก|จดทะเบียน|ตัวจริง/i;

/**
 * The money a customer says they have, rather than the cover they want.
 *
 * "ผมมีเดือนละ 1000 สามารถทำประกันแบบไหนได้บ้างครับ" — a real message, answered with a
 * quotation for a million baht of cover at nearly three times the figure he had just named.
 * The rate table runs both ways, so the sum a budget buys is arithmetic and not a guess.
 *
 * A period word is required — เดือนละ, ต่อปี — because a bare number in this conversation is
 * an age or a sum far more often than it is a budget, and reading it wrong prices something
 * nobody asked for. "1 แสน ต่อปี" is a hundred thousand a year, not one.
 */
export interface Budget {
  baht: number;
  per: "month" | "year";
}

const A_MONTH = String.raw`เดือนละ|ต่อเดือน|รายเดือน|/\s*เดือน|ต่อ\s*เดือน`;
const A_YEAR = String.raw`ปีละ|ต่อปี|รายปี|/\s*ปี|ต่อ\s*ปี`;
const AMOUNT = String.raw`([\d,]+(?:\.\d+)?)\s*(ล้าน|แสน|หมื่น|พัน)?`;
const BUDGET_BEFORE = new RegExp(String.raw`(?:${A_MONTH}|${A_YEAR})\s*${AMOUNT}`);
const BUDGET_AFTER = new RegExp(String.raw`${AMOUNT}\s*(?:บาท)?\s*(?:${A_MONTH}|${A_YEAR})`);
const SAYS_MONTH = new RegExp(A_MONTH);
const SCALE: Record<string, number> = { ล้าน: 1_000_000, แสน: 100_000, หมื่น: 10_000, พัน: 1_000 };

/** The smallest and largest instalment worth reading as one rather than as something else. */
const SMALLEST_BUDGET = 300;
const LARGEST_BUDGET = 2_000_000;

export function budgetIn(text: string): Budget | undefined {
  const m = BUDGET_BEFORE.exec(text) ?? BUDGET_AFTER.exec(text);
  if (!m) return undefined;
  const baht = Number(m[1].replace(/,/g, "")) * (m[2] ? SCALE[m[2]] : 1);
  if (!Number.isFinite(baht) || baht < SMALLEST_BUDGET || baht > LARGEST_BUDGET) return undefined;
  return { baht: Math.round(baht), per: SAYS_MONTH.test(text) ? "month" : "year" };
}

/**
 * The premium is too much. Answered by pointing at what is actually cheaper — the pay-to-99
 * term, a smaller cover — rather than by the shorter terms the bot offered on its first
 * attempt, which cost more a year, not less.
 */
const TOO_EXPENSIVE = /แพง|ถูกกว่า|ถูกลง|ลดได้|ลดหน่อย|ลดทุน|ส่วนลด|ต่อราคา|โปรโมชั่น|มีโปร|เกินงบ|งบไม่ถึง|ไม่มีตังค์|ไม่มีเงิน/;

/** Whether a message is saying the price is too high. */
export function asksCheaper(text: string): boolean {
  return TOO_EXPENSIVE.test(text);
}

/** A short yes, with nothing else in it — taking whatever was last offered. */
const AFFIRMS = /^\s*(?:เอา|ตกลง|โอเค|โอเช|ok|okay|ได้|สนใจ|ครับ|ค่ะ|คะ|ขอ)(?:เลย|ครับ|ค่ะ|คะ|แบบนี้|อันนี้|แบบลดทุน|แบบนั้น|นี้)*\s*(?:ครับ|ค่ะ|คะ)?\s*$/i;

/** Whether a message is a bare acceptance of what the bot last put on the table. */
export function affirms(text: string): boolean {
  return text.length <= 30 && !/\d/.test(text) && AFFIRMS.test(text);
}

/**
 * Stepping back — "เดี๋ยวคิดดูก่อน", "ขอปรึกษาแฟนก่อน", "ไว้จะติดต่อกลับ". Not a question, not
 * a refusal: a person who has what they came for and is leaving to think.
 */
const STALLS = /คิดดูก่อน|ขอคิดดู|คิดก่อน|ไว้ก่อน|ไว้ค่อย|ติดต่อกลับ|เดี๋ยวติดต่อ|ทักกลับ|ขอปรึกษา|ปรึกษาก่อน|ปรึกษาที่บ้าน|ยังไม่ตัดสินใจ|ขอเวลา|เดี๋ยวมาใหม่|ขอดูก่อน/;
/** A stall that is really a question stays a question. */
const ASKS = /\?|ไหม|มั้ย|ยังไง|อย่างไร|อะไร|เท่าไ|กี่|ไหน|เมื่อไ/;

/** Whether the customer is leaving to think it over. */
export function stalls(text: string): boolean {
  return STALLS.test(text) && !ASKS.test(text);
}

/**
 * Deciding to buy — "เอาแผนนี้", "สมัครยังไง", "ต้องทำยังไงต่อ", "ใช้เอกสารอะไรบ้าง". The one
 * message the whole campaign is for, and the one a model was wording on its own: it asked for
 * a name and a phone number the privacy page says are never asked for, and once promised to
 * "เตรียมเอกสาร". The agency's answer is a form, so the answer is written out and the words
 * that mean it are listed here.
 */
const BUYS =
  /สมัคร|ทำ(?:ยังไง|อย่างไร|ไง)|ขั้นตอน|ต้องทำอะไร|เอา(?:แผน|แบบ|แผ่น|อัน|ตัว)นี้|ตกลงทำ|สนใจทำ|ทำเลย|เอาเลย|เริ่ม(?:ยังไง|อย่างไร|ได้เลย)|เตรียม(?:อะไร|เอกสาร)|ใช้เอกสาร|เอกสารอะไร|ซื้อ(?:ยังไง|ได้ที่ไหน|ได้เลย|เลย)|ดำเนินการ/;
/** "ทำยังไง" about a claim, a cancellation or a surrender is a service question, not a purchase */
const NOT_BUYING = /เคลม|ยกเลิก|เวนคืน|กู้|ต่ออายุ|เปลี่ยนแปลง/;
/** a bare ตกลง or เอา — a decision once a premium is on the table, and only then */
const COMMITS = /^\s*(?:ตกลง|เอา)(?:\s*(?:ครับ|ค่ะ|คะ|เลย|นะ))*\s*$/;

/**
 * Whether the customer is asking to go ahead. `quoted` says a premium has been given, which
 * is what lets a one-word ตกลง count; a one-word โอเค never does — it is an acknowledgement.
 */
export function wantsToBuy(text: string, quoted: boolean): boolean {
  if (asksCheaper(text) || NOT_BUYING.test(text) || peopleIn(text).length > 0) return false;
  return BUYS.test(text) || (quoted && COMMITS.test(text));
}

/** Whether the customer says the form has been filled in and sent. */
const FORM_DONE = /กรอก(?:แล้ว|เสร็จ|เรียบร้อย)|ส่ง(?:ฟอร์ม|ข้อมูล)?แล้ว|เรียบร้อยแล้ว|ทำแล้ว/;
export function saysFormDone(text: string): boolean {
  return FORM_DONE.test(text);
}

/** Whether a message is asking who stands behind the policy. */
export function asksAboutCompany(text: string): boolean {
  return INSURER_QUESTION.test(text) || TRUST_QUESTION.test(text);
}

/** Whether that question is one only a person should answer. */
export function asksAboutTrust(text: string): boolean {
  return TRUST_QUESTION.test(text);
}

/**
 * A sex and an age standing next to each other, in either order and in any of the forms
 * customers actually use: "ผญ 32", "42 ญ", "ชายอายุ 35", "เพศหญิง อายุ 36".
 *
 * Read here rather than asked of the model, because the model returns one person and a
 * message often names two. Two of six conversations from the campaign's first day were a
 * couple in one line.
 *
 * An age is a number on its own, never the tail of a bigger one. "ทุน 1,000,000 ญ อายุ 40"
 * was read as a girl of nought — the last "00" of the sum sat beside the ญ — and the real
 * forty after it was never looked at: the legacy plan refused her for her age, and the life
 * plan would have priced a newborn. A comma or a point counts as part of a number only when
 * a digit follows it, so "ชาย 35, หญิง 30" is still two people.
 */
const SEX_WORD = "ผู้หญิง|ผู้ชาย|ผญ|ผช|หญิง|ชาย|ญ|ช";
const NOT_AFTER_A_NUMBER = String.raw`(?<!\d|\d[,.])`;
// nor the count of a sum said in words: "หญิง 1 ล้าน อายุ 40" is not a one-year-old
const NOT_BEFORE_A_NUMBER = String.raw`(?!\d|[,.]\d|\s*(?:ล้าน|แสน|หมื่น|พัน|บาท))`;
/**
 * An age counted in months — "ลูกชาย อายุ 8 เดือน", "หญิง 10 เดือน".
 *
 * Read as months and turned into the age a rate table means, which is whole years: under a
 * year is age 0, eighteen months is 1. It was read as years — the baby of eight months was
 * priced as a child of eight (review 2026-10-01), a different premium on every plan.
 *
 * Not "เดือนละ", which is an instalment ("ชาย 35 เดือนละ 3,000" is a man of thirty-five
 * paying 3,000 a month), nor "เดือนนี้/หน้า/ที่แล้ว/ก่อน", which are dates. Only after an
 * age said with a sex or the word อายุ in front of it: "ราย 6 เดือน" and "6 เดือนเท่าไหร่"
 * are the half-yearly instalment, and a number standing alone before เดือน is left alone.
 */
const MONTHS = String.raw`\s*(เดือน)(?!ละ|นี้|หน้า|ที่|ก่อน)`;
const PERSON_RE = new RegExp(
  `(${SEX_WORD})\\s*(?:เพศ\\s*)?(?:อายุ\\s*)?(\\d{1,2})${NOT_BEFORE_A_NUMBER}(?:${MONTHS})?`
  + `|${NOT_AFTER_A_NUMBER}(\\d{1,2})${NOT_BEFORE_A_NUMBER}\\s*(?:ปี)?\\s*(?:เพศ\\s*)?(${SEX_WORD})`,
  "g",
);

/** A number said as an age, in years: months come down to the whole years they make. */
function yearsOf(n: number, inMonths: boolean): number {
  return inMonths ? Math.floor(n / 12) : n;
}

/**
 * A sex said with no age beside it — "เกิด 14/12/2523 ผู้หญิง", where the age is a date, or
 * "ญ ทุน 1,000,000 อายุ 40", where the sum stands between them.
 *
 * A lone ญ or ช counts only standing on its own: inside a word it is a letter of that word.
 * A message that says both is about two people, and names neither sex for certain — and
 * "ลูกชาย" is somebody else's sex, not the sender's.
 */
const SEX_ALONE = /(?<!ลูก|น้อง|พี่|หลาน|เพื่อน)(?:(ผู้หญิง|หญิง|ผญ|(?<![\u0E01-\u0E5B])ญ(?![\u0E01-\u0E5B]))|(ผู้ชาย|ชาย|ผช|(?<![\u0E01-\u0E5B])ช(?![\u0E01-\u0E5B])))/g;

export function sexIn(text: string): "M" | "F" | undefined {
  const said = new Set([...text.matchAll(SEX_ALONE)].map((m) => (m[1] ? "F" : "M")));
  return said.size === 1 ? [...said][0] as "M" | "F" : undefined;
}

/**
 * The cover a message names, in baht — "ทุน1ล้าน", "ขอ 2 ล้าน", "ทุน 500,000", "5 แสน".
 *
 * A backstop for the model, not a replacement: it is consulted only when the model read no
 * amount at all. A family of three wrote "ช 23 ญ 25 ช 53 ทุน1ล้าน", the model missed the sum
 * for want of a space, and the bot asked for what it had been given — twice.
 *
 * Nothing without ล้าน, แสน or the word ทุน in front of it counts, so an age, a year of birth
 * and a payment term are all left alone.
 */
const COVER_WORDS = /(\d+(?:\.\d+)?)\s*(ล้าน|แสน)|ทุน(?:ประกัน)?\s*([\d,]{6,})/;
const SMALLEST_COVER = 10_000;
const LARGEST_COVER = 100_000_000;

/**
 * A sum with no word in front of it — "ญ 40 1,000,000" — read only beside a person.
 *
 * On its own a bare number is too many things: iShield reads "100000" as a monthly saving,
 * and a budget or a pension is written the same way. Next to a sex and an age in one line it
 * is the third thing a quotation asks for, typed in whatever order the customer thought of it.
 * Round thousands of at least a hundred thousand only, and never with a period after it.
 */
const BARE_SUM = /(?<![\d,.])([1-9]\d{0,2}(?:,\d{3}){2,}|[1-9]\d{2,5}000)(?![\d,.])(?!\s*(?:บาท|฿)?\s*(?:ต่อ|\/|ละ|ราย))/;
const SMALLEST_BARE_SUM = 100_000;

export function coverIn(text: string): number | undefined {
  const m = text.match(COVER_WORDS);
  if (!m) return bareSumBeside(text);
  const baht = m[1]
    ? Number(m[1]) * (m[2] === "ล้าน" ? 1_000_000 : 100_000)
    : Number(m[3].replace(/,/g, ""));
  if (!Number.isFinite(baht) || baht < SMALLEST_COVER || baht > LARGEST_COVER) return undefined;
  return Math.round(baht);
}

function bareSumBeside(text: string): number | undefined {
  if (budgetIn(text) || peopleIn(text).length === 0) return undefined;
  const m = BARE_SUM.exec(text);
  if (!m) return undefined;
  const baht = Number(m[1].replace(/,/g, ""));
  return baht >= SMALLEST_BARE_SUM && baht <= LARGEST_COVER ? baht : undefined;
}

/**
 * A plan's own name, with whatever model number belongs to it.
 *
 * Built from the registry rather than written out, so a plan added next year is covered on
 * the day it is added and not on the day somebody is quoted as a two-year-old. The Thai
 * spellings are here as well, because a customer types those and the registry only holds the
 * English.
 *
 * The numeric tail is the part that matters: "Life Protect" is harmless and "Life Protect
 * x 1.5 / x 2" is not, so the pattern takes the name and then as many `x 2`, `80/6`, `1.5`
 * pieces as follow it. Nothing standing on its own is touched — a sum, an age and a paying
 * term are all still read.
 */
const PLAN_TAIL = String.raw`(?:\s*(?:x\s*)?\d{1,3}(?:\.\d)?(?:\s*/\s*(?:x\s*)?\d{1,3}(?:\.\d)?)?)*`;
const THAI_PLAN_NAMES = [
  String.raw`ไลฟ์\s*(?:โพรเทค|โปรเทค)`,
  String.raw`ไอ\s*สมาร์ท`,
  String.raw`ไลฟ์\s*(?:เทรเชอร์|ทรีเชอร์|เทรชเชอร์)`,
  String.raw`ไอ\s*ชิลด์`,
  String.raw`โพรเทคชั่น\s*ไลฟ์`,
  String.raw`ไอเฮลท์ตี้(?:\s*อัลตร้า)?`,
];

let planNames: RegExp | undefined;
function planNamePattern(): RegExp {
  if (!planNames) {
    const fromRegistry = listPlans().map(({ name }) => {
      // the registry's own name, with its model number turned back into a pattern so that
      // "Life Protect x 2" is recognised as well as the full "x 1.5 / x 2"
      const word = name.replace(/[\d.\s/()x]+$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return word.replace(/\s+/g, String.raw`\s*`);
    });
    planNames = new RegExp(`(?:${[...fromRegistry, ...THAI_PLAN_NAMES].join("|")})${PLAN_TAIL}`, "gi");
  }
  return planNames;
}

/**
 * An age with nobody attached to it — "อายุ 68 ปีครับ", "68 ปีครับ".
 *
 * `peopleIn` wants a sex beside the number, which is the right rule for pricing: the rate
 * table has two columns. But a customer who writes only their age has still told the bot
 * something, and it was being thrown away — a man of sixty-eight wrote "อายุ68 ปีครับ", was
 * shown four arrangements including two no company would issue him, and said so.
 *
 * "ถึงอายุ" is excluded: "คุ้มครองถึงอายุ 99 ไหม" is a question about the contract, and reading
 * ninety-nine as the customer's age would answer somebody who does not exist.
 */
const AGE_ALONE = new RegExp(String.raw`(?<!ถึง\s?)อายุ\s*(\d{1,2})(?!\d)(?:${MONTHS})?|^\s*(\d{1,2})\s*ปี`);

export function ageIn(text: string): number | undefined {
  return ageSaid(text)?.age ?? ageFromBirthdate(text);
}

/** `ageIn`, and whether the customer counted it in months. */
function ageSaid(text: string): { age: number; inMonths: boolean } | undefined {
  const m = AGE_ALONE.exec(text);
  if (!m) return undefined;
  const inMonths = Boolean(m[2]);
  const age = yearsOf(Number(m[1] ?? m[3]), inMonths);
  return Number.isInteger(age) && age >= 0 && age <= 99 ? { age, inMonths } : undefined;
}

/**
 * The age of a baby whose age the message gives in months, in whole years; undefined when
 * the message gives no age in months.
 *
 * For the routers that take the model's reading of the age when `peopleIn` pairs nobody: a
 * model reads "อายุ 8 เดือน" as eight as readily as the pattern once did, and this is the
 * message's own word against it.
 */
export function monthsOldIn(text: string): number | undefined {
  const said = text.replace(planNamePattern(), " ");
  for (const m of said.matchAll(PERSON_RE)) {
    if (m[3]) return yearsOf(Number(m[2]), true);
  }
  const alone = ageSaid(said);
  return alone?.inMonths ? alone.age : undefined;
}

/**
 * Everyone a message names, in the order it names them.
 *
 * The plan's name comes out first. Product names carry numbers and this reader pairs a number
 * with the sex word beside it in either order, so "Life Protect x 1.5 / x 2 ชาย 35" was read
 * as a two-year-old and the quotation was refused for an age the plan does not write.
 *
 * It is done here and not at the call sites. It was tried at a call site once — `price.ts`,
 * for the plans with no Messenger brain — and the two plans that have brains went on reading
 * their own names as customers for weeks, as did the dispatcher. There is no caller that
 * wants a model number read as somebody's age, so there is no reason for any of them to have
 * to remember.
 */
export function peopleIn(text: string): { age: number; sex: "M" | "F" }[] {
  // a date of birth is not "20 ชาย": its day would be read as an age
  const said = text.replace(planNamePattern(), " ").replace(new RegExp(BIRTHDATE_RE, "g"), " ");
  const out: { age: number; sex: "M" | "F" }[] = [];
  for (const m of said.matchAll(PERSON_RE)) {
    const word = m[1] ?? m[5] ?? "";
    const age = yearsOf(Number(m[2] ?? m[4]), Boolean(m[3]));
    if (!Number.isInteger(age) || age < 0 || age > 99) continue;
    const sex = word.includes("ญ") ? "F" : "M";
    // the same person written twice is still one person
    if (!out.some((p) => p.age === age && p.sex === sex)) out.push({ age, sex });
  }
  if (out.length) return out;

  // nobody paired, but one sex and one age in the same line are one person, whatever stands
  // between them: "ญ ทุน 1,000,000 อายุ 40", "อายุ 40 ทุน 1 ล้าน ผู้หญิง"
  const sex = sexIn(said);
  const age = ageIn(said) ?? ageFromBirthdate(text);
  return sex && age !== undefined ? [{ age, sex }] : [];
}

/**
 * The age a date of birth in the message works out to, or undefined when it names none.
 *
 * Customers answer "อายุเท่าไหร่" with a birthdate as readily as with a number — "เกิด
 * 14/12/2523 ผู้หญิง" — and the model read that one as 43 when it is 45. Two years is a
 * different premium. An age is arithmetic on a calendar, so it is done here.
 */
export function ageFromBirthdate(text: string, today: Date = new Date()): number | undefined {
  const g = BIRTHDATE_RE.exec(text)?.groups;
  if (!g) return ageFromBirthYear(text, today);
  const day = Number(g.d ?? g.d2);
  const month = g.m ? Number(g.m) : THAI_MONTHS.findIndex((names) => names.includes(g.name.replace(/\.$/, ""))) + 1;
  const named = Number(g.y ?? g.y2);
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  // a year in the 2500s is พ.ศ.; anything else is read as ค.ศ.
  const year = named >= 2400 ? named - 543 : named;
  const now = bangkokToday(today);
  const passed = now.month > month || (now.month === month && now.day >= day);
  const age = now.year - year - (passed ? 0 : 1);
  return age >= 0 && age <= 99 ? age : undefined;
}

/** The month names a customer writes a date with, in calendar order: spelled out, then abbreviated. */
const THAI_MONTHS = [
  ["มกราคม", "ม.ค"], ["กุมภาพันธ์", "ก.พ"], ["มีนาคม", "มี.ค"], ["เมษายน", "เม.ย"],
  ["พฤษภาคม", "พ.ค"], ["มิถุนายน", "มิ.ย"], ["กรกฎาคม", "ก.ค"], ["สิงหาคม", "ส.ค"],
  ["กันยายน", "ก.ย"], ["ตุลาคม", "ต.ค"], ["พฤศจิกายน", "พ.ย"], ["ธันวาคม", "ธ.ค"],
];

/**
 * A full date of birth: "20/6/2543", "20-06-2000", "20 มิถุนายน 2543" or "20 มิ.ย. 2543".
 *
 * Without a flag, so `exec` has no state to carry; `new RegExp(BIRTHDATE_RE, "g")` where every
 * date in a message is wanted.
 */
const BIRTHDATE_RE = new RegExp(
  String.raw`(?<d>\d{1,2})\s*[/\-.]\s*(?<m>\d{1,2})\s*[/\-.]\s*(?<y>\d{4})(?!\d)`
  + String.raw`|(?<d2>\d{1,2})\s*(?:เดือน\s*)?(?<name>${THAI_MONTHS.flat().map((n) => n.replace(/\./g, String.raw`\.`) + String.raw`\.?`).join("|")})\s*(?:พ\.?\s*ศ\.?|ค\.?\s*ศ\.?|ปี)?\s*(?<y2>\d{4})(?!\d)`,
);

/**
 * Today's date where the customer is, as numbers.
 *
 * `getFullYear`/`getMonth`/`getDate` answer in the server's own zone, and the server runs on
 * UTC — seven hours behind Bangkok. Between midnight and seven in the morning a customer
 * whose birthday it is was a year younger than they are, and on New Year's night everyone
 * born in a given year was (review 2026-10-01). The rate tables' expiry is read on the
 * Bangkok calendar for the same reason (`calc/calendar.ts`), so the age is too.
 */
function bangkokToday(today: Date): { year: number; month: number; day: number } {
  const [year, month, day] = businessDate(today).split("-").map(Number);
  return { year, month, day };
}

/**
 * The age behind a birth year with no day or month — "เกิด2522 เพศญ".
 *
 * It cannot say whether this year's birthday has passed, which is why it was once left to
 * the model. The model answered 47 with 45, to a customer waiting on a premium, so the
 * arithmetic is done here instead and read the way it is said aloud in Thai: this year's
 * พ.ศ. less the year named. Someone whose birthday is still to come is a year out, and the
 * quotation prints the age it used, so they can say so.
 *
 * The year must follow the word เกิด. Every other four-digit number in these conversations
 * is money.
 */
function ageFromBirthYear(text: string, today: Date): number | undefined {
  const m = text.match(/เกิด\s*(?:ปี\s*)?(?:พ\s*\.?\s*ศ\s*\.?\s*)?(\d{4})(?!\d)/);
  if (!m) return undefined;
  const named = Number(m[1]);
  const year = named >= 2400 ? named - 543 : named;
  const age = bangkokToday(today).year - year;
  return age >= 0 && age <= 99 ? age : undefined;
}


/**
 * A customer asking to see the illnesses, rather than how many there are.
 *
 * "กี่โรค" is answered in a sentence and always was. "ขอดูรายชื่อโรค" is seventy diagnoses,
 * which is a wall of text on a phone and cannot be forwarded to whoever else in the house has
 * to agree — so it is answered with the picture instead, drawn from the same list the
 * assistant reads from, and it costs no model call at all.
 */
export function asksDiseaseList(text: string): boolean {
  return /รายชื่อ|ชื่อโรค|โรคอะไร|โรคไหน|มีโรคอะไรบ้าง|ครอบคลุมโรค|คุ้มครองโรคอะไร|ดูโรค|ลิสต์โรค/i.test(text);
}
