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

const FAQ: { match: RegExp; answer: string }[] = [
  { match: /เงินคืน|ได้คืน|เวนคืน|ครบสัญญา|สิ้นสุด|คืนเงิน/, answer: NO_MONEY_BACK },
  { match: /ลดหย่อน|ภาษี|\btax\b/i, answer: TAX_RELIEF },
  { match: WAITING, answer: PLB_WAITING },
  { match: /คุ้มครอง(?:กี่ปี|ถึงอายุ|นานแค่ไหน|นานไหม)/, answer: COVERS },
];

/** The written answer for a message, or undefined when it asks none of these. */
export function plbFaqAnswer(text: string): string | undefined {
  return FAQ.find((e) => e.match.test(text))?.answer;
}
