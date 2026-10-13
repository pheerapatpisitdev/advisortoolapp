import { iShieldFacts } from "@/lib/ishield-facts";
import diseases from "../../../../data/riders/ishield-diseases.json";

/**
 * iShield's questions, answered in fixed sentences (owner, 2026-10-11: rule-only, no model).
 *
 * After a quotation every question — "เป็นมะเร็งเคลมได้ไหม", "เบี้ยขึ้นทุกปีไหม" — was answered
 * with the same quotation again. Three sources now, in this order:
 *
 *   1. an illness named with a question about cover: where it sits in the plan's own list of
 *      seventy (data/riders/ishield-diseases.json, the list /ishield shows), and what that pays
 *      on the customer's sum;
 *   2. the seven questions /ishield answers under คำถามที่พบบ่อย, in the page's own words
 *      (the FAQ removed 2026-10-14 from src/components/ishield/Sections.tsx) — the owner has read those;
 *   3. anything else: the admin checks and answers in the chat, and the question is written
 *      down for /admin/crm. Tax relief is here until the owner gives a confirmed sentence.
 */

const LIST = diseases as { early: string[]; major: string[] };

/**
 * The words customers use, and what they find in the list. Each finder is a piece of the
 * list's own wording, so an illness is placed by the contract's names, not by a guess.
 */
const ILLNESSES: { said: RegExp; name: string; finds: RegExp }[] = [
  { said: /มะเร็ง|cancer/i, name: "มะเร็ง", finds: /(?<!ไม่ใช่)มะเร็ง/ },
  { said: /หัวใจ|heart/i, name: "โรคหัวใจ", finds: /หัวใจ/ },
  { said: /หลอดเลือดสมอง|สโตรก|stroke|เส้นเลือดในสมอง/i, name: "โรคหลอดเลือดสมอง", finds: /หลอดเลือดสมอง|เส้นเลือดบริเวณคอ/ },
  { said: /ไตวาย|โรคไต|ไตเสื่อม|ฟอกไต/, name: "โรคไต", finds: /ไตวาย|ถุงน้ำในไต|ไตอักเสบ/ },
  { said: /ตับวาย|โรคตับ|ตับแข็ง|ตับอักเสบ/, name: "โรคตับ", finds: /ตับ(?!อ่อน)/ },
  { said: /อัลไซเมอร์|สมองเสื่อม/, name: "โรคสมองเสื่อม", finds: /อัลไซเมอร์/ },
  { said: /พาร์กินสัน/, name: "โรคพาร์กินสัน", finds: /พาร์กินสัน/ },
  { said: /ตาบอด|มองไม่เห็น/, name: "ตาบอด", finds: /ตาบอด|มองเห็น/ },
  { said: /อัมพาต/, name: "อัมพาต", finds: /อัมพาต/ },
  { said: /โคม่า/, name: "ภาวะโคม่า", finds: /โคม่า/ },
  { said: /ปอด/, name: "โรคปอด", finds: /ปอด(?!.*หลอดเลือดแดง)/ },
  { said: /หูหนวก|ไม่ได้ยิน|การได้ยิน/, name: "การสูญเสียการได้ยิน", finds: /ได้ยิน/ },
  { said: /ลูปัส|เอสแอลอี|\bsle\b/i, name: "โรคลูปัส (SLE)", finds: /ลูปัส|ลูปูส/ },
  { said: /ไฟไหม้|แผลไหม้|น้ำร้อนลวก/, name: "แผลไหม้", finds: /แผลไหม้/ },
];

/** a question about being paid for an illness, rather than a statement about having one */
const ASKS_COVER = /คุ้มครอง|ครอบคลุม|เคลม|ได้เงิน|รับเงิน|จ่าย|ไหม|มั้ย|หรือเปล่า|รึเปล่า|\?/;

const money = (n: number) => n.toLocaleString("en-US");

/** Where a named illness sits in the seventy, and what that pays on `sum`; undefined when none is named. */
export function coverFor(asked: string, sum?: number): string | undefined {
  if (!ASKS_COVER.test(asked)) return undefined;
  const named = ILLNESSES.filter((i) => i.said.test(asked));
  if (named.length !== 1) return undefined;
  const [illness] = named;
  const early = LIST.early.filter((d) => illness.finds.test(d));
  const major = LIST.major.filter((d) => illness.finds.test(d));
  if (!early.length && !major.length) return undefined;
  const facts = iShieldFacts();
  const pays = (percent: number) => (sum ? ` คือ ${money(Math.round(sum * percent / 100))} บาท` : "");
  const few = (names: string[]) => names.slice(0, 3).join(", ") + (names.length > 3 ? ` และอีก ${names.length - 3} รายการ` : "");
  const lines = [`คุ้มครอง${illness.name}ครับ`];
  if (major.length) lines.push(`• ระยะรุนแรง (${few(major)}) รับ ${facts.illness.majorPercent}% ของทุน${pays(facts.illness.majorPercent)}`);
  if (early.length) lines.push(`• ระยะเริ่มต้น (${few(early)}) รับ ${facts.illness.earlyPercent}% ของทุน${pays(facts.illness.earlyPercent)}`);
  lines.push(`ตามคำนิยามในกรมธรรม์ · ไม่คุ้มครองโรคร้ายแรงที่เกิดขึ้นภายใน ${facts.illness.waitingDays} วันแรกนับจากวันที่กรมธรรม์มีผลบังคับ`);
  return lines.join("\n");
}

/** The page's seven, by what each question looks like. First match wins, so the narrow come first. */
function pageAnswers(): { asks: RegExp; answer: string }[] {
  const f = iShieldFacts();
  return [
    {
      asks: /เคลม.*(?:กี่ครั้ง|หลายครั้ง|ซ้ำ)|กี่ครั้ง|หลายโรค/,
      answer: `เคลมได้อีกถ้าเป็นคนละโรคกับที่เคยเคลมครับ ระยะเริ่มต้นแต่ละครั้งรับ ${f.illness.earlyPercent}% ของทุนประกัน`
        + ` ส่วนระยะรุนแรงจ่ายสูงสุด ${f.illness.majorPercent}% ของทุน โดยหักเงินที่จ่ายในระยะเริ่มต้นไปแล้วออก`,
    },
    {
      asks: /(?:เคลม|รับ).*ระยะเริ่มต้น.*(?:เหลือ|ต่อ|ลด)|ทุน.*ลด/,
      answer: `ทุนประกันจะลดลงตามสัดส่วนของเงินที่จ่ายไปครับ เช่นรับไป ${f.illness.earlyPercent}% ทุนที่เหลือก็ลดลง`
        + ` ${f.illness.earlyPercent}% และมูลค่าเวนคืนลดตามด้วย ส่วนที่เหลือยังคุ้มครองต่อทั้งชีวิตและโรคร้ายแรง`,
    },
    {
      asks: /รอคอย|ระยะรอ|คุ้มครอง(?:เลย|ทันที)|มีผล(?:เลย|ทันที|เมื่อไ|ตอนไหน)|เริ่มคุ้มครอง/,
      answer: `ยังครับ แบบนี้ไม่คุ้มครองโรคร้ายแรงที่เกิดขึ้นภายใน ${f.illness.waitingDays} วันแรก`
        + " นับจากวันที่กรมธรรม์เริ่มมีผลบังคับ เป็นเงื่อนไขมาตรฐานของประกันโรคร้ายแรงทุกบริษัท ส่วนความคุ้มครองชีวิตมีผลตั้งแต่วันแรก",
    },
    {
      asks: /เบี้ย.*(?:ขึ้น|เพิ่ม|ปรับ)|ขึ้นตามอายุ/,
      answer: "ไม่ขึ้นครับ เบี้ยล็อกที่อายุ ณ วันที่ทำ และเท่าเดิมตลอดระยะเวลาชำระ"
        + " ต่างจากสัญญาเพิ่มเติมที่ต่ออายุปีต่อปี ซึ่งเบี้ยจะปรับตามอายุ",
    },
    {
      asks: /ไม่ป่วย|ไม่เป็นอะไร|เงิน.*หาย|ครบสัญญา|เวนคืน|ได้เงินคืน/,
      answer: `ไม่หายครับ อยู่ครบสัญญาอายุ ${f.maturityAge} ปี รับคืนเต็มทุนประกัน และระหว่างทางมีมูลค่าเงินสด`
        + " ที่เวนคืนหรือกู้ได้ตามเงื่อนไขกรมธรรม์ ดูได้จากตารางมูลค่าทุกปีที่ส่งให้"
        + ` เช่นทุน ${f.example.sum} บาท ชำระ 10 ปี ที่อายุ 60 มีมูลค่า ${f.cash60} บาท`,
    },
    {
      asks: /อายุ(?:เท่าไ|กี่ปี).*(?:ทำ|สมัคร)|รับอายุ|อายุสูงสุด|ทุน(?:ขั้น)?ต่ำ|ทุนสูงสุด/,
      answer: `รับตั้งแต่แรกเกิดถึงอายุ ${f.ageMax} ปีครับ ทุนประกันตั้งแต่ ${f.saMin} ถึง ${f.saMax} บาท`
        + " อายุสูงสุดต่างกันตามระยะเวลาชำระเบี้ย",
    },
    {
      asks: /ค่าห้อง|ค่ารักษา|นอนโรงพยาบาล|ผู้ป่วยใน|\bopd\b|\bipd\b/i,
      answer: "แบบนี้เป็นเงินก้อน ไม่ใช่ค่ารักษาครับ ถ้าต้องการค่ารักษาพยาบาลหรือค่าชดเชยรายวันด้วย"
        + " พ่วงสัญญาเพิ่มเติมได้ บอกในแชทนี้ได้เลยครับ",
    },
  ];
}

/** One of the page's answers for this question, or undefined. */
export function pageAnswer(asked: string): string | undefined {
  return pageAnswers().find((a) => a.asks.test(asked))?.answer;
}

/** Said when nothing above answers: true, in the admin's voice, and never a guess about the contract. */
export const ADMIN_CHECKS = "ข้อนี้ผมไม่อยากตอบเดาครับ เดี๋ยวแอดมินเช็กให้แล้วกลับมาตอบในแชทนี้นะครับ 🙏";

const QUESTION = /ไหม|มั้ย|ยังไง|อย่างไร|อะไร|หรือเปล่า|รึเปล่า|ไหน|เมื่อไ|ทำไม|ได้ป่าว|\?/;
/** money questions keep their old answer: the quotation is the answer to "เท่าไหร่" */
const ABOUT_MONEY = /เบี้ย|เท่าไ|ราคา|บาท|จ่าย|ผ่อน|งวด|รายเดือน|รายปี|ทุน/;

/** A question the quotation does not answer and nothing here can: the admin's to answer. */
export function forTheAdmin(asked: string): boolean {
  if (/ภาษี|ลดหย่อน/.test(asked)) return true;
  return QUESTION.test(asked) && !ABOUT_MONEY.test(asked);
}
