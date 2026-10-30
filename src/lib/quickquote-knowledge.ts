import handbook from "../../data/qa/quickquote-2023.json";

/**
 * The company's pocket product handbook (Quick Quote 2023), as the chat may read it.
 *
 * The rule files say who may buy each plan and the engine says what it costs; neither says how
 * much a child may be insured for, when a medical is called for, what a monk may not buy or
 * which documents go with the form. Those are the underwriting guideline's, and agents ask
 * them every day, so the guideline is kept here in mended Thai rather than paraphrased into a
 * prompt.
 *
 * What was left out is as deliberate as what was kept. Every rate table, the premium example
 * with its payment-mode factors, the PA price list and the cash-value tables stayed in the PDF:
 * a figure a model is handed is a figure it can read out, and premiums come from the engine.
 * The owner also took out iCare, LifeReady, Bumnan Ready and Ultimate Growth (2026-10-30), and
 * the 2023 pages for plans the system already carries rules for were never copied, so the two
 * cannot disagree.
 *
 * The cover says "for internal use", and the owner chose (2026-10-30) to keep it to the agents'
 * own chat on the website — see `open.agent` in `assembleKnowledge`.
 */

export interface HandbookTopic {
  code: string;
  title: string;
  lines: string[];
}

export interface Handbook {
  name: string;
  source: string;
  topics: HandbookTopic[];
}

const HANDBOOK = handbook as Handbook;

export function quickQuote(): Handbook {
  return HANDBOOK;
}

/**
 * Which words open which topic.
 *
 * Kept beside the code rather than in the data file, for the reason the health topics keep
 * theirs: these are this chat's reading of a question, not anything the company wrote.
 */
const OPENS: Record<string, RegExp> = {
  DOCS: /เอกสาร|สำเนา|สูติบัตร|ทะเบียนบ้าน|e-?kyc|ยืนยันตัวตน|ใช้อะไรบ้าง|สมัคร.{0,12}(ใช้|ต้อง)/i,
  PAYMENT: /รายเดือน|หักบัญชี|ตัดบัญชี|ธนาคาร|ชำระ|จ่ายเบี้ย|งวด|ใบรับเงิน|pay-?in|บัญชีรับเงิน|โอนเงิน/i,
  FINANCE: /ทุนสูง|วงเงินสูง|\bLAQ\b|เอกสาร.{0,6}การเงิน|งบดุล|หลักฐาน.{0,6}(การเงิน|รายได้)|รายได้|\bMEB\b|ค่าชดเชยรายวัน|ประกันภัยต่อ/i,
  FORM: /กรอก|ลงนาม|เซ็น|ลายมือชื่อ|ลายนิ้วมือ|พยาน|ขูดลบ|ใบคำขอ/,
  AGE: /คิดอายุ|นับอายุ|อายุ.{0,8}(คิด|นับ)|วันเกิด|จันทรคติ|วันเริ่ม(สัญญา|คุ้มครอง)|วันที่\s*(29|30|31)/,
  HOMEMAKER: /แม่บ้าน|พ่อบ้าน|ไม่มีรายได้|ไม่ได้ทำงาน/,
  JUVENILE: /เด็ก|ลูก|เยาวชน|ผู้เยาว์|นักเรียน|นักศึกษา|ทารก|ขวบ|แรกเกิด/,
  MILITARY: /ทหาร|ตำรวจ/,
  ABROAD: /(ไป|อยู่|ทำงาน).{0,8}ต่างประเทศ|ต่างแดน/,
  FOREIGNER: /ต่างชาติ|ต่างด้าว|foreigner|expat|passport|พาสปอร์ต|วีซ่า|visa|work\s*permit/i,
  MONK: /พระสงฆ์|พระภิกษุ|นักบวช|บวช|เณร|สมณศักดิ์|พระ(?=\s|ทำ|ซื้อ|ได้|จะ|สามารถ|ประกัน|$)/,
  BENEFICIARY: /ผู้รับ(ผล)?ประโยชน์|ผู้ชำระเบี้ย|คนจ่ายเบี้ย|ใคร.{0,6}จ่าย|บุตรบุญธรรม|หลาน|พี่น้อง|ปู่|ย่า|ตายาย/,
  NONMED: /ตรวจสุขภาพ|ไม่ต้องตรวจ|non.?med|\bmed\b|ตรวจร่างกาย|ตรวจเลือด|ตรวจปัสสาวะ|hiv|เอชไอวี|program\s*\d|โปรแกรม.{0,4}ตรวจ|ต้องตรวจ|น้ำลาย/i,
  CHECKUP: /ตรวจสุขภาพ|แพทย์แต่งตั้ง|ใบส่งตัว|เตรียมตัว.{0,6}ตรวจ|งดอาหาร|ค่าตรวจ|จ่ายคืน.{0,6}ตรวจ/,
  BMI: /\bbmi\b|ดัชนีมวลกาย|น้ำหนัก|ส่วนสูง|อ้วน|ผอม/i,
  FEES: /ค่าธรรมเนียม|free\s*look|ยกเลิก.{0,12}(กรมธรรม์|ใบคำขอ|15\s*วัน)|ออกกรมธรรม์ใหม่|ค่าบริการ/i,
  TAX: /ภาษี|ลดหย่อน/,
  "12PL": /12\s*PL|สมาร์ท\s*โปร|smart\s*pro/i,
  AP: /\bAP\b|accident\s*protection|อุบัติเหตุ|สูญเสียอวัยวะ/i,
  ECARE: /e\s*care|extra\s*care|ทุพพลภาพ|อุบัติเหตุ/i,
  MEAX: /\bMEA\b|mea\s*extra|เอ็กซ์\s*ตร้า|smart\s*medicare/i,
  PLS: /\bPLS\s*\d*\b|protection\s*life\s*rider/i,
  PA: /\bPA\b|พีเอ|อุบัติเหตุส่วนบุคคล|pa\s*(classic|platinum|max)|\bPA[CPM]\d{2}\b/i,
};

/** The topics this question opens — none of them when there is no question. */
export function quickQuoteTopicsFor(question: string): HandbookTopic[] {
  if (!question) return [];
  return HANDBOOK.topics.filter((t) => OPENS[t.code]?.test(question));
}

/** The opened topics as one block of the library, or "" when the question opened none. */
export function quickQuoteSection(question: string): string {
  const opened = quickQuoteTopicsFor(question);
  if (!opened.length) return "";
  return [
    `## ${HANDBOOK.name} (เอกสารบริษัท ใช้ภายใน)`,
    "- เกณฑ์ฉบับมกราคม 2566 ที่ยังบังคับใช้ เป็นเกณฑ์ปกติของบริษัท ผลพิจารณาจริงเป็นของบริษัทเสมอ",
    "- ถ้าอายุหรือทุนของแบบใดในส่วนนี้ไม่ตรงกับหัวข้อของแบบนั้นด้านบน ให้ใช้ตัวเลขด้านบน",
    "- ส่วนนี้ไม่มีอัตราเบี้ย ห้ามคิดเบี้ยจากส่วนนี้",
    ...opened.map((t) => [`### ${t.title}`, ...t.lines].join("\n")),
  ].join("\n");
}
