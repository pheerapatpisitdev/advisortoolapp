import { HEALTH_DECLARATION, HEALTH_QUESTION, TAX_RELIEF } from "../common";

/**
 * The five answers the agent types by hand every day, taken from the campaign's own inbox.
 *
 * Constants matched by pattern and returned before any model is asked, for the same reason
 * the insurer's name is: these are claims about a contract, and the page is held to them. The
 * wording is the agency's own except where an absolute would have been wrong — a life policy
 * does carry standard exclusions, and whether a particular person can be insured is the
 * underwriter's answer and not this code's.
 */

export interface FaqEntry {
  key: string;
  match: RegExp;
  /** a sentence, or one built from the message when it may be asking two things at once */
  answer: string | ((text: string) => string);
}

/** A condition the customer says they have, as against asking whether a check-up is needed. */
const CONDITION = /โรคประจำตัว|มีโรค|เป็นโรค|ป่วยเป็น|เบาหวาน|ความดัน|ไทรอยด์|หอบ|ภูมิแพ้|มะเร็ง|หัวใจ|ผ่าตัด|กินยา|รักษาตัว|สุขภาพไม่ดี/;
const ASKS_CHECKUP = /ตรวจสุขภาพ|ต้องตรวจ|ตรวจร่างกาย/;
const ASKS_WAITING = /รอคอย|ระยะรอ/;

/**
 * Whether a health check is needed, and whether there is a waiting period.
 *
 * The first is the sales page's own answer (components/lifeprotect/Sections.tsx) with the
 * company's Q&A item 9 — the plan is underwritten in the ordinary way — so the chat and the
 * page say the same thing. The second is not in the company's Q&A: the owner's answer is that the
 * cover starts as soon as the policy is approved, so there is no waiting period to wait out
 * (2026-10-07). The waiting periods on file belong to the health and critical-illness contracts.
 *
 * Not for someone who says they have a condition: that is the declaration's, below, which must
 * never be read as a promise to accept.
 */
const CHECKUP_ANSWER =
  "ต้องตรวจสุขภาพหรือไม่ ขึ้นกับอายุ ทุน และประวัติสุขภาพครับ บริษัทพิจารณารับประกันแบบปกติ "
  + "เบี้ยที่คิดให้เป็นเบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณา\n"
  + "ถ้าอยากรู้ว่ากรณีของคุณต้องตรวจไหม เดี๋ยวแอดมินเช็กให้ก่อนสมัครได้เลยครับ";
const WAITING_ANSWER = "คุ้มครองทันทีหลังกรมธรรม์อนุมัติครับ ไม่ต้องรอระยะรอคอย";

/**
 * Order matters: health is first because a message that mentions a condition and asks a
 * price is, above everything else, a message that must not be told it will be accepted.
 */
export const FAQ: FaqEntry[] = [
  {
    key: "conditions",
    match: /ตรวจสุขภาพ|ต้องตรวจ|ตรวจร่างกาย|รอคอย|ระยะรอ/,
    answer: (text) => [
      ASKS_CHECKUP.test(text) ? CHECKUP_ANSWER : "",
      ASKS_WAITING.test(text) ? WAITING_ANSWER : "",
    ].filter(Boolean).join("\n\n"),
  },
  {
    key: "health",
    match: HEALTH_QUESTION,
    answer: HEALTH_DECLARATION,
  },
  {
    key: "tax",
    match: /ลดหย่อน|ภาษี|\btax\b/i,
    answer: TAX_RELIEF,
  },
  {
    key: "all_causes",
    match: /ทุกกรณี|ทุกสาเหตุ|กรณีไหนบ้าง|ตายแบบไหน|เสียชีวิตแบบไหน|อุบัติเหตุ|ป่วยตาย|คุ้มครองอะไรบ้าง|ข้อยกเว้น/i,
    answer:
      "คุ้มครองการเสียชีวิตทุกกรณีครับ ทั้งเจ็บป่วยและอุบัติเหตุ ตลอด 24 ชั่วโมง ทั่วโลก\n"
      + "มีเพียงข้อยกเว้นมาตรฐานที่ระบุไว้ในกรมธรรม์ เช่น ฆ่าตัวตายภายใน 1 ปีแรก "
      + "หรือถูกผู้รับประโยชน์ฆ่า",
  },
  {
    key: "monthly",
    match: /รายเดือน|จ่ายยังไง|ชำระยังไง|ผ่อน|ตัดบัตร|หักบัญชี|เป็นงวด|งวดแรก/i,
    answer:
      "จ่ายรายเดือนได้ครับ งวดแรกชำระ 2 งวด แล้วระบบจะตัดอัตโนมัติอีกครั้งในงวดที่ 3\n"
      + "จะเลือกจ่ายราย 6 เดือน หรือรายปีก็ได้เหมือนกันครับ",
  },
  {
    key: "long_pay",
    match: /ถึง\s*99|จนถึง\s*99|ส่งยาว|จ่ายยาว|ส่งไม่ไหว|จ่ายไม่ไหว|หาเงินที่ไหน|แก่แล้ว|อายุเยอะ|ส่งกี่ปี|จ่ายกี่ปี|ชำระกี่ปี/i,
    answer:
      "เบี้ยของแบบนี้คงที่ตลอดระยะเวลาชำระครับ ไม่ปรับขึ้นตามอายุ ตอนอายุมากก็จ่ายเท่าเดิมกับวันที่เริ่ม\n"
      + "ถ้าไม่อยากผูกยาว มีแบบจ่ายสั้นให้เลือก จ่าย 9 ปี หรือ 19 ปี แล้วคุ้มครองต่อถึงอายุ 99 เหมือนกันครับ\n"
      + 'อยากให้คิดเบี้ยแบบสั้นให้ดูด้วยไหมครับ บอกมาได้เลย (เช่น "จ่าย 19 ปี")',
  },
];

/** The written answer for a message, or undefined when it asks none of these. */
export function faqAnswer(text: string): string | undefined {
  // someone who names a condition is the declaration's, never the check-up's
  const entry = FAQ.find((e) => e.match.test(text) && !(e.key === "conditions" && CONDITION.test(text)));
  if (!entry) return undefined;
  return typeof entry.answer === "function" ? entry.answer(text) : entry.answer;
}
