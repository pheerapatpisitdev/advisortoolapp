/**
 * Facebook's advertising rules, checked by pattern and never by a model — so it costs nothing
 * and runs on every piece, including after every edit.
 *
 * Ported from the owner's Maryjane project (src/lib/ad-policy.ts), where it exists because
 * Thai finance copy writes "คุณกำลังมีหนี้อยู่ใช่ไหม" as a matter of course and Meta forbids
 * asserting or implying anything personal about the reader: health, money, debt, age, job.
 * Insurance copy is the same temptation with a different noun — "คุณป่วยอยู่ใช่ไหม" — and the
 * account that gets restricted is the owner's advertising account.
 *
 * The same rules go into the writer's prompt (POLICY_RULES_TH): stopping the sentence at the
 * source is cheaper than catching it afterwards, and catching it afterwards is still needed.
 */
export type PolicySeverity = "block" | "warn";

export interface PolicyRule {
  code: string;
  pattern: RegExp;
  severity: PolicySeverity;
  message: string;
  fix: string;
}

export const POLICY_RULES: PolicyRule[] = [
  {
    code: "health_you",
    pattern: /(?:คุณ|ท่าน)[^.!?\n]{0,20}?(เป็นโรค|ป่วย|เป็นมะเร็ง|เป็นเบาหวาน|ความดันสูง|อ้วน|ซึมเศร้า)/,
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีปัญหาสุขภาพ — Facebook ห้ามในโฆษณา",
    fix: "พูดถึงความคุ้มครองแทนตัวคนอ่าน เช่น “ถ้าวันหนึ่งต้องรักษาตัว…”",
  },
  {
    code: "debt_you",
    pattern: /(?:คุณ|ท่าน)[^.!?\n]{0,20}?(มีหนี้|เป็นหนี้|หนี้สิน|ติดแบล็?คลิสต์|ติดเครดิตบูโร)/,
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีหนี้ — Facebook ห้ามในโฆษณา",
    fix: "เล่าเป็นสถานการณ์ทั่วไป เช่น “บ้านที่ยังผ่อนไม่หมด”",
  },
  {
    code: "age_you",
    pattern: /(?:คุณ|ท่าน)[^.!?\n]{0,10}อายุ\s?[\d๐-๙]{2}|อายุ\s?[\d๐-๙]{2}\s?(\+|ปีขึ้นไป|ขึ้นไป)[^.!?\n]{0,15}(สมัคร|รับได้|ผ่าน)/,
    severity: "block",
    message: "ระบุอายุของคนอ่านตรงๆ — Facebook ห้ามในโฆษณา",
    fix: "ยกเป็นตัวอย่างบุคคลที่สาม เช่น “ตัวอย่าง ผู้หญิงอายุ 35…” หรือไปตั้งอายุที่กลุ่มเป้าหมายของแอด",
  },
  {
    code: "job_you",
    pattern: /(?:คุณ|ท่าน)[^.!?\n]{0,15}?(ตกงาน|ว่างงาน|ไม่มีงานทำ)/,
    severity: "block",
    message: "บอกใบ้สถานะงานของคนอ่าน — Facebook ห้ามในโฆษณา",
    fix: "เปลี่ยนเป็นข้อความกลางๆ ที่ไม่ระบุตัวคนอ่าน",
  },
  {
    code: "guarantee",
    pattern: /(การันตี|รับรอง)[^.!?\n]{0,12}(อนุมัติ|ผ่าน|ได้เงิน|รับประกันภัย)|อนุมัติ\s?(?:100|๑๐๐)\s?%|รับทุกคน/,
    severity: "block",
    message: "รับประกันผลการสมัครแบบเด็ดขาด — ผิดมาตรฐานสินค้าการเงินของ Facebook และบริษัทพิจารณารับประกันทุกราย",
    fix: "บอกเงื่อนไขจริงแทน เช่น “สมัครง่าย ตัวแทนช่วยดูเงื่อนไขให้”",
  },
  {
    code: "pii_request",
    pattern: /(ส่ง|แจ้ง|พิมพ์)[^.!?\n]{0,10}(เลขบัตรประชาชน|เลขบัญชี|รหัสผ่าน)/,
    severity: "block",
    message: "ขอข้อมูลส่วนตัวในโพสต์ — Facebook ห้าม",
    fix: "ชวนทักแชทก่อน แล้วค่อยขอข้อมูลในแชท",
  },
  {
    code: "superlative",
    pattern: /(ถูกที่สุดในประเทศ|ดีที่สุดในโลก|อันดับ\s?[1๑]\s?ของประเทศ|ดีที่สุดในไทย)/,
    severity: "warn",
    message: "คำเกินจริงที่พิสูจน์ไม่ได้ — เสี่ยงโฆษณาถูกปฏิเสธ",
    fix: "ใช้ตัวเลขจริงจากตารางเบี้ยแทนคำว่าที่สุด",
  },
];

/**
 * The same rules for English copy (iHealthy Ultra posts for expats). Assertion-only on purpose:
 * "are you…", "you are/you're…", "you have…", "your debts" — so "if you get sick" and "when you
 * change jobs" never match and there is no look-back for if/when. Run on every piece alongside
 * the Thai ones; a Thai post simply never matches. message/fix are Thai (staff read them),
 * the examples inside fix are English.
 */
// "you're sick" asserts; "you're covered for cancer" does not — so the word has to follow straight on
const CONDITION_ADJ = "(?:sick|ill|unwell|diabetic|obese|overweight|depressed|chronically ill)";
const CONDITION_NOUN = "(?:diabetes|cancer|hypertension|high blood pressure|depression|a chronic (?:illness|condition|disease))";
export const POLICY_RULES_EN: PolicyRule[] = [
  {
    code: "health_you_en",
    pattern: new RegExp(`\\b(?:are you|you(?:'|’)re|you are)\\s+(?:(?:so|very|really|still|now|currently|already)\\s+)?${CONDITION_ADJ}\\b|\\byou (?:have|suffer from|are suffering from)\\s+${CONDITION_NOUN}\\b(?!\\s+(?:cover|coverage|protection|insurance|plan|benefit|treatment))`, "i"),
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีปัญหาสุขภาพ — Facebook ห้ามในโฆษณา",
    fix: "พูดถึงความคุ้มครองแทนตัวคนอ่าน เช่น “If you ever need treatment…”",
  },
  {
    code: "debt_you_en",
    pattern: /\b(?:are you|you(?:'|’)re|you are)\b[^.!?\n]{0,15}?\b(?:in debt|indebted|bankrupt)\b|\byou (?:have|owe)\b[^.!?\n]{0,10}?\b(?:debts?|loans?)\b|\byour (?:debts?|credit score)\b/i,
    severity: "block",
    message: "บอกใบ้ว่าคนอ่านมีหนี้ — Facebook ห้ามในโฆษณา",
    fix: "เล่าเป็นสถานการณ์ทั่วไป เช่น “A hospital bill can set anyone back”",
  },
  {
    code: "age_you_en",
    pattern: /(?<!\b(?:if|whether|when|once|as long as) )\b(?:you(?:'|’)re|you are)\s+(?:now\s+)?(?:(?:over|under|aged?)\s?)?\d{2}\b(?! or \d)|\bare you (?:over|under|aged?)\s?\d{2}\b|\bat your age\b/i,
    severity: "block",
    message: "ระบุอายุของคนอ่านตรงๆ — Facebook ห้ามในโฆษณา",
    fix: "ยกเป็นตัวอย่างบุคคลที่สาม เช่น “A 35-year-old woman…” หรือไปตั้งอายุที่กลุ่มเป้าหมายของแอด",
  },
  {
    code: "job_you_en",
    pattern: /\b(?:are you|you(?:'|’)re|you are)\b[^.!?\n]{0,15}?\b(?:unemployed|jobless|out of work|laid off)\b|\b(?:lost|losing) your job\b|\byou (?:lost|have lost) your job\b/i,
    severity: "block",
    message: "บอกใบ้สถานะงานของคนอ่าน — Facebook ห้ามในโฆษณา",
    fix: "เปลี่ยนเป็นข้อความกลางๆ ที่ไม่ระบุตัวคนอ่าน",
  },
  {
    code: "guarantee_en",
    pattern: /\b(?:guarantee[ds]?|assured)\s+(?:approval|acceptance|issue)\b|\b100\s?% (?:approved|approval|acceptance|accepted)\b|\b(?:approved|accepted)\s+100\s?%|\bno one is (?:declined|rejected|turned down)\b|\beveryone (?:is )?(?:approved|accepted)\b|\bguarantee[ds]? (?:to )?(?:approve|accept)\b/i,
    severity: "block",
    message: "รับประกันผลการสมัครแบบเด็ดขาด — ผิดมาตรฐานสินค้าการเงินของ Facebook และบริษัทพิจารณารับประกันทุกราย",
    fix: "บอกเงื่อนไขจริงแทน เช่น “Easy to apply — an agent will check the terms with you”",
  },
  {
    code: "pii_request_en",
    pattern: /\b(?:send|share|give|provide|text|enter|type)\b[^.!?\n]{0,15}?\b(?:passport (?:number|no\.?)|id (?:card )?number|national id|bank account(?: number)?|account number|password|pin)\b/i,
    severity: "block",
    message: "ขอข้อมูลส่วนตัวในโพสต์ — Facebook ห้าม",
    fix: "ชวนทักแชทก่อน แล้วค่อยขอข้อมูลในแชท เช่น “Message us to get started”",
  },
  {
    code: "superlative_en",
    pattern: /\b(?:best|cheapest)\b[^.!?\n]{0,25}?\b(?:in|of|across)\s+(?:thailand|the (?:world|country))\b|\bthailand(?:'|’)s (?:best|cheapest|#\s?1|number one)\b|(?<![\w])#\s?1\b|\bnumber\s?(?:one|1)\b|\bno\.\s?1\b/i,
    severity: "warn",
    message: "คำเกินจริงที่พิสูจน์ไม่ได้ — เสี่ยงโฆษณาถูกปฏิเสธ",
    fix: "ใช้ตัวเลขจริงจากตารางเบี้ยแทนคำว่า best / cheapest",
  },
  {
    code: "visa_type_en",
    pattern: /\b(?:o-?a|o-?x|non-?o|non-?immigrant|retirement|elite|ltr|dtv|smart|education|marriage|business|work|tourist|long[- ]stay)\s+(?:visa|extension)\b|\b(?:visa|extension)\s+(?:type\s+)?(?:o-?a|o-?x|non-?o|dtv|ltr)\b/i,
    severity: "block",
    message: "ระบุชื่อประเภทวีซ่า — ไม่เขียนในโพสต์ ให้ชวนทักแชทแทน",
    fix: "เขียนว่า “Message us to check your visa”",
  },
  {
    code: "visa_promise_en",
    pattern: /\bvisas?\s+(?:is\s+|will be\s+|gets?\s+)?(?:approved|guaranteed?|assured|sorted|secured)\b|\bvisa approval\s+(?:is\s+)?(?:guaranteed?|assured)\b|\b(?:approved|guaranteed|assured|secured)\s+visas?\b|\b(?:guarantee[ds]?|ensure[ds]?|secure[ds]?)\s+(?:your\s+|the\s+|a\s+)?visa\b|\b(?:works?|valid|good|accepted)\s+(?:for|with)\s+(?:every|any|all)\s+(?:\w+\s+)?visas?\b/i,
    severity: "block",
    message: "สัญญาว่าวีซ่าจะผ่าน — ห้าม ผลวีซ่าขึ้นกับสำนักงานตรวจคนเข้าเมือง",
    fix: "เขียนว่า “Message us to check your visa” แทนคำสัญญา",
  },
];

export interface PolicyFinding {
  code: string;
  severity: PolicySeverity;
  message: string;
  fix: string;
  /** the words that tripped the rule, so the owner can find them */
  match: string;
}

/**
 * "ถ้าวันหนึ่งคุณป่วยหนัก" supposes; "คุณป่วยอยู่ใช่ไหม" asserts. Insurance is sold on the
 * first kind and Meta's rule is about the second, so a match that opens on one of these words
 * is left alone. Only the rules about the reader's own attributes have this out; a guarantee
 * is a guarantee however the sentence begins.
 */
const SUPPOSING = /(ถ้า|หาก|สมมติ(ว่า)?|เมื่อ|วันที่|ในวันที่|ถ้าวันหนึ่ง)\s*$/;
const ABOUT_THE_READER = new Set(["health_you", "debt_you", "job_you"]);
// those three patterns are lazy on purpose: a greedy one swallows "ถ้าคุณป่วย… แล้วคุณป่วยอยู่"
// as a single match that opens on ถ้า, and the second, asserting half goes unread

/**
 * หาทีม's own rules, on top of the rest (owner, 2026-09-26). A recruiting post is a job ad to
 * Facebook — applicants may not be picked by sex, age or status — and an income claim to
 * คปภ.; the owner's rule is no income figure at all. Only recruit pieces are read with these:
 * a plan post quoting "เบี้ยเดือนละ 1,200 บาท" is not promising anyone a salary.
 */
export const RECRUIT_POLICY_RULES: PolicyRule[] = [
  {
    code: "income_promise",
    pattern: /(?:รายได้|เงินเดือน|ได้เงิน|รับเงิน|ค่าคอม)[^.!?\n]{0,20}?(?:[\d๐-๙][\d๐-๙,]{2,}|[\d๐-๙]+\s?(?:หมื่น|แสน|ล้าน)|หลัก\s?(?:หมื่น|แสน|ล้าน))|(?:หลัก\s?(?:หมื่น|แสน|ล้าน)|[\d๐-๙][\d๐-๙,]{3,}\s?บาท)[^.!?\n]{0,12}?(?:ต่อเดือน|\/เดือน|ต่อปี)/,
    severity: "block",
    message: "ระบุตัวเลขรายได้ — ห้ามในโพสต์หาทีม (คปภ. และ Facebook ถือเป็นการอ้างรายได้)",
    fix: "เขียนว่า “รายได้ขึ้นกับผลงาน” แทนตัวเลข",
  },
  {
    code: "income_guarantee",
    pattern: /(?:การันตี|รับประกัน|ชัวร์|แน่นอน)[^.!?\n]{0,10}(?:รายได้|เงินเดือน)|(?:รายได้|เงินเดือน)[^.!?\n]{0,10}(?:การันตี|แน่นอน|ชัวร์|ประจำทุกเดือน)/,
    severity: "block",
    message: "สัญญาว่ามีรายได้แน่นอน — งานตัวแทนรายได้มาจากผลงาน สัญญาแบบนี้ไม่ได้",
    fix: "เขียนว่า “รายได้ขึ้นกับผลงาน” และบอกว่าทีมช่วยอะไรบ้าง",
  },
  {
    code: "hire_filter",
    pattern: /(?:เฉพาะ|รับแต่)[^.!?\n]{0,6}(?:ผู้หญิง|ผู้ชาย|เพศ|หญิง|ชาย|โสด)|(?:ผู้หญิง|ผู้ชาย|โสด|สัญชาติไทย)[^.!?\n]{0,6}เท่านั้น|อายุ\s?[\d๐-๙]{2}\s?(?:-|–|ถึง)\s?[\d๐-๙]{2}|เพศ\s?(?:หญิง|ชาย)|หน้าตาดี|บุคลิกดี/,
    severity: "block",
    message: "เลือกผู้สมัครจากเพศ อายุ หรือสถานภาพ — Facebook ห้ามในโฆษณาหางาน",
    fix: "เปิดให้ทุกคน เช่น “ไม่จำกัดวุฒิ ไม่ต้องมีประสบการณ์”",
  },
  {
    code: "mlm",
    pattern: /ดาวน์\s?ไลน์|อั[พป]\s?ไลน์|downline|upline|ธุรกิจเครือข่าย|ชวนคน[^.!?\n]{0,10}(?:ได้เงิน|ได้ค่า|รับเงิน)/i,
    severity: "block",
    message: "คำแนวธุรกิจเครือข่าย — Facebook ปฏิเสธโฆษณาแบบนี้ และไม่ใช่วิธีทำงานของตัวแทน",
    fix: "เล่าว่างานคือดูแลลูกค้า ไม่ใช่ชวนคนมาต่อ",
  },
  {
    code: "exam_promise",
    pattern: /(?:สอบ|ใบอนุญาต)[^.!?\n]{0,25}?(?:จนผ่าน|ผ่านแน่|ผ่านชัวร์|ผ่าน\s?(?:100|๑๐๐)|การันตี)|(?:การันตี|รับรอง)[^.!?\n]{0,10}สอบผ่าน/,
    severity: "warn",
    message: "สัญญาว่าสอบใบอนุญาตผ่าน — ผลสอบขึ้นกับผู้สอบ สัญญาแบบนี้ไม่ได้",
    fix: "เขียนว่า “ทีมช่วยเตรียมตัวสอบ”",
  },
  {
    code: "easy_money",
    pattern: /รวย|งานสบาย|ไม่ต้องขาย|ไม่ต้องทำอะไร|นอนรับ|เงินไหลเข้า/,
    severity: "warn",
    message: "คำแนวรวยง่าย — เสี่ยงโฆษณาถูกปฏิเสธ และคนที่มาเพราะคำนี้มักอยู่ไม่นาน",
    fix: "บอกตรงๆ ว่างานนี้ต้องเรียนรู้ ทีมช่วยอะไร และรายได้ขึ้นกับผลงาน",
  },
];

export function checkPolicy(text: string, opts: { recruit?: boolean } = {}): PolicyFinding[] {
  const out: PolicyFinding[] = [];
  for (const rule of [...POLICY_RULES, ...POLICY_RULES_EN, ...(opts.recruit ? RECRUIT_POLICY_RULES : [])]) {
    const every = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
    for (const m of text.matchAll(every)) {
      const before = text.slice(Math.max(0, m.index - 14), m.index);
      if (ABOUT_THE_READER.has(rule.code) && SUPPOSING.test(before)) continue;
      out.push({ code: rule.code, severity: rule.severity, message: rule.message, fix: rule.fix, match: m[0] });
      break;
    }
  }
  return out;
}

/** the same rules, as the writer is told them */
export const POLICY_RULES_TH = [
  "กฎโฆษณาของ Facebook (ห้ามฝ่าฝืน):",
  "- ห้ามชี้หรือบอกใบ้ว่าคนอ่านมีลักษณะส่วนตัว เช่น ป่วย เป็นโรค มีหนี้ อายุเท่าไร ตกงาน — ห้ามเขียน “คุณป่วยอยู่ใช่ไหม” หรือ “คุณอายุ 40 แล้ว” ให้เล่าจากมุมของความคุ้มครองหรือยกตัวอย่างบุคคลที่สามแทน",
  "- ห้ามรับประกันผลการสมัคร เช่น อนุมัติ 100% รับทุกคน",
  "- ห้ามขอเลขบัตรประชาชน เลขบัญชี หรือข้อมูลส่วนตัวในโพสต์",
  "- ห้ามคำเกินจริงที่พิสูจน์ไม่ได้ เช่น ดีที่สุดในประเทศ อันดับ 1",
].join("\n");
