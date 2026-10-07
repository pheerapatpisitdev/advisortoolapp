import { TAX_RELIEF } from "../common";

/**
 * What the agency writes out by hand about Protection Life, as fixed sentences: these are
 * claims about a contract, so no model words them.
 *
 * The waiting period is not answered. The owner has said Life Protect covers from the moment
 * the policy is approved; he has not said the same of this plan, and a guess would be a
 * claim about a contract nobody confirmed. The customer is told it is being checked, which is
 * true — change this one line when the owner confirms the fact.
 */
export const PLB_WAITING =
  "ระยะเวลารอคอยของแบบ Protection Life ผมยังไม่มีข้อมูลที่ยืนยันได้ครับ ไม่อยากตอบเดา "
  + "เดี๋ยวแอดมินเช็กกับบริษัทแล้วกลับมาตอบในแชทนี้นะครับ";

const WAITING = /รอคอย|ระยะรอ/;

/** Whether a message asks about a waiting period. */
export function asksWaiting(text: string): boolean {
  return WAITING.test(text);
}

const NO_MONEY_BACK =
  "Protection Life เป็นความคุ้มครองล้วนครับ คุ้มครองเท่ากับระยะที่จ่ายเบี้ย "
  + "อยู่ครบแล้วสัญญาสิ้นสุด ไม่มีเงินคืนและไม่มีมูลค่าเวนคืนครับ";

const COVERS =
  "คุ้มครองเท่ากับที่จ่ายเบี้ยครับ เลือกจ่าย 5, 10, 12 หรือ 15 ปี ก็คุ้มครองเท่านั้นปี "
  + "เช่น ชาย 35 ชำระ 10 ปี คุ้มครองถึงอายุ 45";

/**
 * Tax relief by the term, because here the term is how long the cover lasts: the Revenue
 * Department's rule needs a policy of ten years or more, so the agency's sentence is given
 * only for the ten-, twelve- and fifteen-year terms. For the five-year term, or while the term
 * is still open, the customer is told it is being checked rather than told yes.
 */
const TAX_TERMS = new Set(["PLB10", "PLB12", "PLB15"]);
const TAX_CHECK =
  "ลดหย่อนภาษีได้หรือไม่ ขึ้นกับระยะเวลาคุ้มครองของกรมธรรม์ตามหลักเกณฑ์กรมสรรพากรครับ "
  + "ผมไม่อยากตอบเดา เดี๋ยวแอดมินเช็กให้ว่าแบบที่สนใจใช้ได้ไหม แล้วกลับมาตอบในแชทนี้นะครับ";

const FAQ: { match: RegExp; answer: string | ((variant?: string) => string) }[] = [
  { match: /เงินคืน|ได้คืน|เวนคืน|ครบสัญญา|สิ้นสุด|คืนเงิน/, answer: NO_MONEY_BACK },
  { match: /ลดหย่อน|ภาษี|\btax\b/i, answer: (variant) => (variant && TAX_TERMS.has(variant) ? TAX_RELIEF : TAX_CHECK) },
  { match: WAITING, answer: PLB_WAITING },
  { match: /คุ้มครอง(?:กี่ปี|ถึงอายุ|นานแค่ไหน|นานไหม)/, answer: COVERS },
];

/** The written answer for a message, or undefined when it asks none of these; `variant` is the term held. */
export function plbFaqAnswer(text: string, variant?: string): string | undefined {
  const answer = FAQ.find((e) => e.match.test(text))?.answer;
  return typeof answer === "function" ? answer(variant) : answer;
}
