import qa from "../../data/qa/lifeprotect-plus.json";

/**
 * The company's own Q&A for ไลฟ์ โพรเทค+, as the chat may read it.
 *
 * The rate tables and the rules file say what the plan costs and who may buy it; neither says
 * whether the booster can be dropped, whether a monk or a foreigner can be insured, or why the
 * premium does not fall at sixty. Agents are asked those every week and the answers are in the
 * company's Q&A sheet, so the sheet is kept here word for word (with the PDF's broken Thai
 * vowels mended) rather than paraphrased into a prompt.
 *
 * It is the same kind of knowledge the health contract is in `health-knowledge.ts`: a document
 * of the company's, kept apart from the generated rule files so that a re-extract cannot lose it.
 */

export interface QaItem {
  no: number;
  q: string;
  a: string;
  /** marketing material for the agent, not a sentence for the customer */
  internal?: boolean;
}

export interface ProductQa {
  name: string;
  source: string;
  items: QaItem[];
}

const QA = qa as ProductQa;

export function lifeProtectQa(): ProductQa {
  return QA;
}

/**
 * The plan by any name a customer or an agent uses for it — the company's, the agency's
 * advert ("x 2", "ประกันมรดก"), the booster, or a plan code.
 */
const NAMED = /ไลฟ์\s*โพร\s*เท[คก]|life\s*protect|lifeprotect|x\s*2\b|ประกันมรดก|protection\s*booster|บูสเตอร์|booster|WLF\d{2}[LH]/i;

export function lifeProtectNamedIn(text: string): boolean {
  return NAMED.test(text);
}

/** The whole sheet as one block of the library. */
export function lifeProtectQaSection(): string {
  return [
    `## คำถามที่พบบ่อยของ ${QA.name} (เอกสารของบริษัท)`,
    "- “Life Protect x 2” ที่เอเจนซี่ใช้โฆษณา คือ ไลฟ์ โพรเทค+ 100 (Protection Booster 100% — เสียชีวิตก่อนอายุ 60 ได้ 2 เท่าของทุน) แชทนี้คิดเบี้ยให้เฉพาะแบบ 100 ส่วนแบบ 50 ตอบเรื่องเงื่อนไขได้ แต่ให้ตัวแทนเป็นคนเสนอราคา",
    "- ถ้าลูกค้าได้ใบเสนอราคาแล้ว ตัวเลขเงินคืนและมูลค่าเวนคืนของเขาให้ใช้ตัวเลขในใบเสนอ/ตารางมูลค่าเท่านั้น",
    ...QA.items.map((i) => [
      `**ข้อ ${i.no}. ${i.q}**${i.internal ? " (ข้อมูลการตลาดภายใน ใช้ช่วยบอกว่าแบบนี้เหมาะกับใคร ห้ามเรียกลูกค้าด้วยชื่อกลุ่ม)" : ""}`,
      i.a,
    ].join("\n")),
  ].join("\n");
}
