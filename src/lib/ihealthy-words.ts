import type { PayMode, Sex } from "@/calc/types";
import type { DeathWords } from "@/lib/death-benefit";
import type { Lang } from "@/lib/ihealthy-lang";

/**
 * Everything the iHealthy Ultra page says in its own voice, in each of its four languages.
 *
 * The company's own wording — the benefit rows, the terms, the disclaimer — is not here: it is
 * translated on the server from data/riders/ihealthy-ultra.i18n.json, so the browser never
 * downloads three languages of contract prose to show one. What is here is the page's own
 * furniture, small enough to ship whole.
 *
 * The Thai is the page as it was before there were other languages, word for word, and the
 * type makes every language say every line: a sentence added to Thai without its three
 * readings fails the build rather than appearing in Thai on the English page.
 */

const n = (x: number) => x.toLocaleString("en-US");

/** A ceiling in the unit a reader of that language counts large sums in. */
export interface Big {
  num: string;
  unit: string;
}

export interface IHealthyWords {
  // ---------- the page ----------
  metaTitle: string;
  metaDescription: string;
  switchLabel: string;
  /** that a translation is a reading of the Thai, and the Thai is what binds; empty in Thai */
  translationNote: string;
  expiredTable: (expiresOn: string) => string;

  // ---------- hero ----------
  eyebrow: string;
  titleLabel: string;
  intro: (minBaht: number, maxBaht: number, plans: number, renewalToAge: number) => string;
  highlightsLabel: string;
  maxPerYear: string;
  choosePlans: string;
  plansUnit: string;
  renewTo: string;
  yearsUnit: string;
  designYours: string;

  // ---------- money and people ----------
  big: (baht: number) => Big;
  /** `big` with the currency folded into the unit, for a sum standing on its own */
  bigBaht: (baht: number) => Big;
  baht: string;
  years: (age: number) => string;
  sex: Record<Sex, string>;
  mode: Record<PayMode, string>;
  coverage: Record<string, string>;
  territory: Record<string, string>;

  // ---------- the form ----------
  age: string;
  sexLabel: string;
  base: string;
  baseSum: string;
  healthPlan: string;
  coverageLabel: string;
  /** what the base plan buttons say, by the rate key's variant, falling back to the table's */
  baseLabel: Record<string, string>;
  baseShort: Record<string, string>;
  baseNote: Record<string, string>;
  sumOf: (sum: number) => string;
  /** the base plan and its sum, as one line on the card */
  baseWithSum: (label: string, sum: number) => string;
  fixedSum: (sum: number) => string;
  onlyPlans: (age: number, plans: string[]) => string;
  territoryOnly: (territory: string, coverage: string) => string;

  // ---------- the card ----------
  notSoldAtAge: (age: number) => string;
  totalPremium: (mode: string) => string;
  belowMinimum: (minMonthly: number) => string;
  refused: (modes: string[], minMonthly: number) => string;
  expiredCard: string;
  annualLimit: string;
  deductible: (baht: number) => string;
  copay: (percent: number) => string;
  firstYearOnly: string;
  dailyCash: (perDay: number) => string;
  /** the benefit table's row title for the same rider, which carries its figure in the cell */
  dailyCashRow: string;
  riderCount: (count: number) => string;
  /** each rider's short name on a card, and the pieces after it */
  riderShort: Record<string, string>;
  riderVariant: Record<string, string>;
  sumShort: (sum: string) => string;
  planShort: (plan: string) => string;
  andMore: (count: number) => string;
  dciTitle: (sum: string) => string;
  dciNote: string;
  death: DeathWords;
  printOrPdf: string;
  /** the printed sheet's own headings: the card and the itemised bill it carries on paper */
  sheetChosen: string;
  sheetItems: (mode: string) => string;
  /** the moment the sheet was made, already written out in the reader's own calendar */
  printedAt: (when: string) => string;
  copyLink: string;
  linkCopied: string;
  /** the card picture and the copied text, which leave the page in the reader's language */
  share: ShareWords;

  // ---------- the contact buttons ----------
  contact: ContactWords;

  // ---------- the rider fold ----------
  foldTitle: string;
  /** the fold's headings, one per kind of cover */
  riderGroups: { health: string; critical: string; accident: string; life: string; waiver: string };
  /** the payer block under PB: who pays at this age, the age box and its unit, the accepted ages */
  payerTitle: (relation: "parent" | "spouse") => string;
  payerAgeLabel: string;
  payerAgeUnit: string;
  payerAges: (min: number, max: number) => string;
  /** the payer named after PB's own line in the bill */
  payerNote: (sex: string, age: number) => string;
  pricingFailed: string;
  retry: string;
  pricing: string;
  optionOf: (rider: string) => string;
  planOf: (rider: string) => string;
  sumOfRider: (rider: string) => string;

  // ---------- the benefit table ----------
  tableScroll: string;
  tableCaption: (plans: number) => string;
  benefitColumn: string;
  notSold: string;
  upTo: (limit: string) => string;
  perDay: string;
  samePlans: string;
  premiumHeading: string;
  moreOnDesktop: (hidden: number) => string;
  scrollHint: string;
  phoneRow: Record<number, string>;

  // ---------- terms and disclaimer ----------
  termsHeading: string;
  waitingSummary: (days: number, specialDays: number) => string;
  waitingBody: (days: number, groups: number, specialDays: number) => string;
  preExistingSummary: string;
  noClaimSummary: (percent: number) => string;
  renewalCopaySummary: string;
  premiumChangesSummary: string;
  outOfTerritorySummary: (days: number) => string;
  exclusionsSummary: string;
  firstYearDisclaimer: (rateVersion: string) => string;

  /** the rider engine's Thai, read into this language where it is one of the known lines */
  rider: (thai: string) => string;
}

/**
 * What the saved card and the copied quote say that the page itself never has to.
 *
 * Both leave the page — a picture forwarded to a spouse, a text pasted into a chat — so they
 * go out in the language the reader chose. The Thai is what the two said before there were
 * other languages, word for word; the bot still sends that.
 */
export interface ShareWords {
  /** after the large figure on the card, e.g. "ต่อปี" */
  per: Record<PayMode, string>;
  /** where a price would be, on a card that may not quote one */
  askPrice: string;
  ceiling: (baht: number) => string;
  territory: (name: string) => string;
  insured: (sex: string, age: number) => string;
  total: (amount: string, mode: PayMode) => string;
  baseLine: (label: string, sum: number) => string;
  /** what the health rider is, named without its plan */
  treatment: string;
  instalment: (mode: string, amount: string) => string;
  monthlyRefused: (minMonthly: number) => string;
  family: string;
  firstYear: string;
  fineprint: string;
}

/** The labels the shared sales buttons carry; each defaults to its Thai on every other page. */
export interface ContactWords {
  copy: { full: string; compact: string; copied: string };
  /** the one send button and the panel it opens (owner, 2026-10-14, option ก) */
  kit: {
    open: string; choose: string; card: string; table: string; diseases: string; text: string;
    /** the panel's send button, by what is ticked */
    send: (pictures: number, text: boolean) => string;
    save: string; working: string; loading: string; nothing: string;
    /** after a send on a phone: the text is on the clipboard too, for an app that drops it */
    sent: string;
    /** after a send on a computer: pictures downloaded, text copied */
    saved: string;
  };
}

// ---------- the rider engine's lines ----------

/**
 * The rider engine speaks Thai to every calculator in the building and should go on doing so;
 * this page reads its lines into the reader's language on the way to the screen.
 *
 * Only lines it knows are read — its handful of names, and the few sentence shapes the rules
 * build around a figure. Anything else is shown as the engine wrote it, which is a Thai line on
 * an English page rather than a line that says something the engine did not.
 */
interface RiderPhrases {
  names: Record<string, string>;
  exact: Record<string, string>;
  ages: (min: string, max: string) => string;
  issueAges: (min: string, max: string) => string;
  exceeds: (what: string) => string;
  belowMin: (what: string, min: string) => string;
  mustBe: (code: string, amount: string) => string;
  notPriced: (line: string) => string;
  unreadable: (count: string) => string;
  paysTo: (plan: string, age: string) => string;
  monthlyBelow: (min: string) => string;
  packageNeeds: (code: string) => string;
  /** an accident rider priced at the cheapest occupational class */
  classOne: (code: string) => string;
  /** one of CI 123's own endorsements, which the engine names "บันทึกฯ <cover>" */
  endorsement: (cover: string) => string;
}

function riderReader(p: RiderPhrases): (thai: string) => string {
  const name = (s: string) => p.names[s] ?? s;
  const read = (s: string): string => {
    if (s in p.exact) return p.exact[s];
    if (s in p.names) return p.names[s];
    let m: RegExpExecArray | null;
    if ((m = /^(.+) จึงไม่ได้คิดเบี้ยให้$/.exec(s))) {
      const rest = m[1];
      const unreadable = /^มีสัญญาเพิ่มเติม (\d+) รายการที่อ่านไม่ออก$/.exec(rest);
      if (unreadable) return p.unreadable(unreadable[1]);
      // "<rider name> <reason>" — the name has spaces of its own, so it is matched whole
      const known = Object.keys(p.names).find((k) => rest.startsWith(`${k} `));
      if (known) return p.notPriced(`${p.names[known]}: ${read(rest.slice(known.length + 1))}`);
      return s;
    }
    if ((m = /^(\d+) - (\d+) ปี$/.exec(s))) return p.ages(m[1], m[2]);
    if ((m = /^อายุรับประกัน (\d+) - (\d+) ปี$/.exec(s))) return p.issueAges(m[1], m[2]);
    if ((m = /^(.+) เกินกว่าที่กำหนด$/.exec(s))) return p.exceeds(name(m[1]));
    if ((m = /^(.+) ต่ำกว่าขั้นต่ำ ([\d,]+)$/.exec(s))) return p.belowMin(name(m[1]), m[2]);
    if ((m = /^ต้องระบุทุน (\S+) ([\d,]+) บาทเท่านั้น$/.exec(s))) return p.mustBe(m[1], m[2]);
    // the package's own wording counts in แสน, a hundred thousand
    if ((m = /^ต้องระบุทุน (\S+) (\d+) แสนบาทเท่านั้น$/.exec(s))) {
      return p.mustBe(m[1], n(Number(m[2]) * 100_000));
    }
    if ((m = /^(.+) — ชำระเบี้ยครบอายุ (\d+) ปี$/.exec(s))) return p.paysTo(m[1], m[2]);
    if ((m = /^เบี้ยประกันภัยรายเดือนต่ำกว่า ([\d,]+) บาท$/.exec(s))) return p.monthlyBelow(m[1]);
    if ((m = /^แพ็กเกจนี้ต้องซื้อ (\S+)$/.exec(s))) return p.packageNeeds(m[1]);
    if ((m = /^เบี้ย (.+?) คิดที่อาชีพชั้น 1 — อาชีพชั้นอื่นเบี้ยสูงกว่านี้$/.exec(s))) return p.classOne(m[1]);
    if ((m = /^บันทึกฯ (.+)$/.exec(s))) return p.endorsement(m[1]);
    return s;
  };
  return read;
}

export const THAI_CONTACT: ContactWords = {
  copy: { full: "คัดลอกข้อความ", compact: "คัดลอก", copied: "คัดลอกแล้ว ✓" },
  kit: {
    open: "ส่งให้ลูกค้า", choose: "เลือกสิ่งที่จะส่ง", card: "การ์ด", table: "ตาราง", diseases: "รายชื่อโรค", text: "ข้อความ",
    send: (n, t) => (n && t ? `ส่ง ${n} รูป + ข้อความ` : n ? `ส่ง ${n} รูป` : "ส่งข้อความ"),
    save: "บันทึกรูปลงเครื่อง", working: "กำลังเตรียม…", loading: "กำลังสร้าง…", nothing: "เลือกอย่างน้อย 1 อย่าง",
    sent: "ส่งแล้ว ✓ ข้อความคัดลอกไว้ วางต่อได้", saved: "ดาวน์โหลดรูปแล้ว · คัดลอกข้อความแล้ว ✓",
  },
};

const th: IHealthyWords = {
  metaTitle: "iHealthy Ultra — ค่ารักษาพยาบาลเหมาจ่ายถึง 100 ล้านต่อปี",
  metaDescription:
    "ประกันสุขภาพเหมาจ่าย 6 แผน วงเงิน 3 ถึง 100 ล้านบาทต่อปี ต่ออายุได้ถึงอายุ 98 ปี เทียบผลประโยชน์ครบ 28 หมวด และคำนวณเบี้ยของคุณเองได้ทันที",
  switchLabel: "ภาษา",
  translationNote: "",
  expiredTable: (on) => `ตารางเบี้ยชุดนี้หมดอายุตั้งแต่ ${on} ขอเบี้ยปัจจุบันได้จากตัวแทน`,

  eyebrow: "ประกันสุขภาพ · iHealthy Ultra",
  titleLabel: "ค่ารักษาพยาบาล",
  intro: (min, max, plans, age) =>
    `เหมาจ่ายค่ารักษาต่อปี ตั้งแต่ ${n(min / 1e6)} ล้าน ถึงสูงสุด ${n(max / 1e6)} ล้านบาท เลือกได้ ${plans} แผน ต่ออายุได้ถึงอายุ ${age} ปี`,
  highlightsLabel: "จุดเด่นความคุ้มครอง",
  maxPerYear: "วงเงินสูงสุดต่อปี",
  choosePlans: "เลือกความคุ้มครอง",
  plansUnit: "แผน",
  renewTo: "ต่ออายุได้ถึง",
  yearsUnit: "ปี",
  designYours: "ออกแบบความคุ้มครองของคุณ",

  big: (baht) => ({ num: n(baht / 1e6), unit: "ล้าน" }),
  bigBaht: (baht) => ({ num: n(baht / 1e6), unit: "ล้านบาท" }),
  baht: "บาท",
  years: (age) => `${age} ปี`,
  sex: { M: "ชาย", F: "หญิง" },
  mode: { annual: "รายปี", semi: "ราย 6 เดือน", monthly: "รายเดือน" },
  coverage: { "Full Coverage": "เต็มจำนวน", Deductible: "มีความรับผิดส่วนแรก", "Co-Payment": "ร่วมจ่าย" },
  territory: { ประเทศไทย: "ประเทศไทย", เอเชีย: "เอเชีย", ทั่วโลก: "ทั่วโลก" },

  age: "อายุ",
  sexLabel: "เพศ",
  base: "สัญญาหลัก",
  baseSum: "ทุนสัญญาหลัก",
  healthPlan: "แผนสุขภาพ",
  coverageLabel: "ความคุ้มครอง",
  baseLabel: {},
  baseShort: {},
  baseNote: {},
  sumOf: (sum) => `ทุน ${n(sum)}`,
  baseWithSum: (label, sum) => `${label} ทุน ${n(sum)}`,
  fixedSum: (sum) => `${n(sum)} บาท · แพ็กเกจกำหนดไว้ เปลี่ยนไม่ได้`,
  onlyPlans: (age, plans) => `ที่อายุ ${age} ปี บริษัทขายเฉพาะแผน ${plans.join(" และ ")}`,
  territoryOnly: (t, c) => `อาณาเขต${t}มีเฉพาะความคุ้มครองแบบ${c}`,

  notSoldAtAge: (age) => `ที่อายุ ${age} ปี บริษัทยังไม่เปิดขายแบบที่เลือกไว้ ลองเปลี่ยนสัญญาหลักหรือแผนสุขภาพ`,
  totalPremium: (mode) => `เบี้ยรวม ${mode}`,
  belowMinimum: (min) => `ต่ำกว่าเบี้ยรายเดือนขั้นต่ำ ${n(min)} บาท ที่บริษัทรับชำระ`,
  refused: (modes, min) => `${modes.join(" และ ")} ต่ำกว่าขั้นต่ำ ${n(min)} บาท บริษัทไม่รับชำระ`,
  expiredCard: "ตารางเบี้ยชุดนี้หมดอายุแล้ว ขอเบี้ยปัจจุบันได้จากตัวแทน",
  annualLimit: "วงเงินค่ารักษาต่อปี",
  deductible: (baht) => `รับผิดส่วนแรก ${n(baht)} บาทต่อปี`,
  copay: (pct) => `ร่วมจ่าย ${pct} เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง`,
  firstYearOnly: "เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น",
  dailyCash: (perDay) => `ค่าชดเชยรายวัน ${n(perDay)} บาท`,
  dailyCashRow: "ค่าชดเชยรายวัน",
  riderCount: (count) => `สัญญาเพิ่มเติม ${count} รายการ`,
  riderShort: {
    MEB: "ค่ารักษาพยาบาล MEB",
    MEX: "ค่ารักษาพยาบาลพิเศษ MEX",
    DCI: "โรคร้ายแรง DCI",
    CI123: "โรคร้ายแรง CI 123",
    CPR: "มะเร็ง CPR",
    RRSS: "โรคร้ายโซชิลด์",
    AP: "อุบัติเหตุ AP",
    ECARE: "อุบัติเหตุ ECARE",
    PLS: "คุ้มครองชีวิต",
    WP: "ยกเว้นเบี้ย WP",
    PB: "ผู้ชำระเบี้ย PB",
  },
  riderVariant: { FIT: "ฟิต", BEYOND: "บียอนด์" },
  sumShort: (s) => `ทุน ${s}`,
  planShort: (p) => `แผน ${p}`,
  andMore: (c) => `และอีก ${c} รายการ`,
  dciTitle: (sum) => `DCI คุ้มครองโรคร้ายแรง ${sum} บาท · 31 โรค`,
  dciNote: "เป็นไปตามคำนิยามและเงื่อนไขในกรมธรรม์",
  death: {
    before: (age) => `เสียชีวิตก่อนอายุ ${age} ปี`,
    between: (from, to) => `อายุ ${from}–${to} ปี`,
    from: (age) => `อายุ ${age} ปีขึ้นไป`,
    until: (age) => `จนถึงอายุ ${age} ปี`,
    always: "ทุกช่วงอายุ",
  },
  printOrPdf: "พิมพ์ หรือบันทึก PDF",
  sheetChosen: "สรุปแผนที่เลือก",
  sheetItems: (mode) => `เบี้ยประกันแยกตามสัญญา (${mode})`,
  printedAt: (when) => `จัดทำเมื่อ ${when}`,
  copyLink: "คัดลอกลิงก์หน้านี้",
  linkCopied: "คัดลอกแล้ว ✓",
  share: {
    per: { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" },
    askPrice: "ขอราคาปัจจุบันได้ทางแชท",
    ceiling: (b) => `วงเงินค่ารักษา ${n(b)} บาทต่อปี`,
    territory: (t) => `อาณาเขต${t}`,
    insured: (sex, age) => `${sex} อายุ ${age} ปี`,
    total: (amount, mode) =>
      `เบี้ยรวมประมาณ ${amount} บาท${{ annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" }[mode]}`,
    baseLine: (label, sum) => `${label} ทุน ${n(sum)} บาท`,
    treatment: "ค่ารักษาพยาบาล",
    instalment: (mode, amount) => `${mode} ${amount} บาท`,
    monthlyRefused: (min) => `(ต่ำกว่าขั้นต่ำ ${n(min)} บาท บริษัทไม่รับชำระรายเดือน)`,
    family: "ครอบครัวได้รับเมื่อเสียชีวิต",
    firstYear: "เบี้ยปีแรก เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น",
    fineprint: "เบี้ยของอาชีพชั้น 1 · ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกัน"
      + "และที่ระบุในกรมธรรม์",
  },

  contact: THAI_CONTACT,

  foldTitle: "แนบสัญญาเพิ่มเติมอื่น",
  riderGroups: { health: "สุขภาพ", critical: "โรคร้ายแรง / มะเร็ง", accident: "อุบัติเหตุ", life: "คุ้มครองชีวิต", waiver: "ยกเว้นเบี้ย" },
  payerTitle: (r) => `ผู้ชำระเบี้ย (${r === "parent" ? "พ่อหรือแม่" : "คู่สมรส"})`,
  payerAgeLabel: "อายุผู้ชำระเบี้ย",
  payerAgeUnit: "ปี",
  payerAges: (a, b) => `รับผู้ชำระเบี้ยอายุ ${a}–${b} ปี`,
  payerNote: (sex, age) => `ผู้ชำระเบี้ย ${sex} ${age} ปี`,
  pricingFailed: "คิดเบี้ยไม่สำเร็จ",
  retry: "ลองอีกครั้ง",
  pricing: "กำลังคิดเบี้ย",
  optionOf: (r) => `แบบของ${r}`,
  planOf: (r) => `แผนของ${r}`,
  sumOfRider: (r) => `ทุนของ${r}`,

  tableScroll: "เลื่อนตารางเพื่อดูแผนอื่น",
  tableCaption: (plans) => `ตารางผลประโยชน์ iHealthy Ultra ทั้ง ${plans} แผน`,
  benefitColumn: "ผลประโยชน์",
  notSold: "ไม่ขายที่อายุนี้",
  upTo: (limit) => `ไม่เกิน ${limit}`,
  perDay: "ต่อวัน",
  samePlans: "ทุกแผนเท่ากัน",
  premiumHeading: "เบี้ยประกัน",
  moreOnDesktop: (hidden) => `ตารางเต็มมีอีก ${hidden} หมวด ดูได้บนจอคอมพิวเตอร์ · `,
  scrollHint: "เลื่อนตารางไปทางขวาเพื่อดูแผนอื่น · ",
  phoneRow: {
    1: "ค่าห้องและค่าอาหาร",
    5: "Day Surgery",
    7: "อุบัติเหตุ OPD 24 ชม",
    10: "มะเร็ง รังสีรักษา",
    18: "ผู้ป่วยนอก OPD",
  },

  termsHeading: "เงื่อนไขที่ต้องรู้ก่อนตัดสินใจ",
  waitingSummary: (d, s) => `ไม่คุ้มครอง ${d} วันแรก และ ${s} วันแรกสำหรับบางโรค`,
  waitingBody: (d, g, s) =>
    `การป่วยที่เกิดใน ${d} วันแรกนับจากวันเริ่มคุ้มครองไม่ได้รับความคุ้มครอง และอีก ${g} กลุ่มโรคนี้ต้องรอถึง ${s} วัน`,
  preExistingSummary: "สภาพที่เป็นมาก่อนทำประกัน",
  noClaimSummary: (pct) => `ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย ${pct} เปอร์เซ็นต์`,
  renewalCopaySummary: "บริษัทขอให้ร่วมจ่ายตอนต่ออายุได้",
  premiumChangesSummary: "เบี้ยปีต่ออายุเปลี่ยนได้",
  outOfTerritorySummary: (d) => `รักษานอกอาณาเขต คุ้มครองฉุกเฉิน ${d} วันแรกของการเดินทาง`,
  exclusionsSummary: "ข้อยกเว้นที่บริษัทไม่คุ้มครอง",
  firstYearDisclaimer: (v) =>
    `เบี้ยที่แสดงเป็นเบี้ยปีแรกของอาชีพชั้น 1 เบี้ยปีต่อไปคิดตามอายุที่เพิ่มขึ้น · ไม่ใช่ใบเสนอราคา เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกัน · อัตราเบี้ยชุด ${v}`,

  rider: (s) => s,
};

const en: IHealthyWords = {
  metaTitle: "iHealthy Ultra — lump-sum medical cover up to 100 million baht a year",
  metaDescription:
    "Health insurance with 6 plans and annual limits from 3 to 100 million baht, renewable to age 98. Compare all 28 benefit categories and work out your own premium instantly.",
  switchLabel: "Language",
  translationNote:
    "This translation is provided for convenience only. If it differs from the Thai version, the Thai version and the policy prevail.",
  expiredTable: (on) => `This premium table expired on ${on}. Please ask an agent for current premiums.`,

  eyebrow: "Health insurance · iHealthy Ultra",
  titleLabel: "Medical expenses",
  intro: (min, max, plans, age) =>
    `Lump-sum medical cover each year, from ${n(min / 1e6)} million up to ${n(max / 1e6)} million baht. Choose from ${plans} plans, renewable up to age ${age}.`,
  highlightsLabel: "Coverage highlights",
  maxPerYear: "Maximum per year",
  choosePlans: "Choose your cover",
  plansUnit: "plans",
  renewTo: "Renewable to age",
  yearsUnit: "",
  designYours: "Design your cover",

  big: (baht) => ({ num: n(baht / 1e6), unit: "million" }),
  bigBaht: (baht) => ({ num: n(baht / 1e6), unit: "million baht" }),
  baht: "baht",
  years: (age) => `${age} yrs`,
  sex: { M: "Male", F: "Female" },
  mode: { annual: "Annual", semi: "Semi-annual", monthly: "Monthly" },
  coverage: { "Full Coverage": "Full coverage", Deductible: "With deductible", "Co-Payment": "Co-payment" },
  territory: { ประเทศไทย: "Thailand", เอเชีย: "Asia", ทั่วโลก: "Worldwide" },

  age: "Age",
  sexLabel: "Sex",
  base: "Base policy",
  baseSum: "Base sum assured",
  healthPlan: "Health plan",
  coverageLabel: "Coverage",
  baseLabel: { WLF99H: "Life Protect+ x 2", WLF99HX: "Health Ultra Package" },
  baseShort: { WLF99H: "x 2", WLF99HX: "Health package" },
  baseNote: { WLF99H: "Choose your sum" },
  sumOf: (sum) => `Sum ${n(sum)}`,
  baseWithSum: (label, sum) => `${label}, sum assured ${n(sum)}`,
  fixedSum: (sum) => `${n(sum)} baht · fixed by the package`,
  onlyPlans: (age, plans) => `At age ${age} the company sells only ${plans.join(" and ")}`,
  territoryOnly: (t, c) => `${t} cover is available only as ${c.toLowerCase()}`,

  notSoldAtAge: (age) =>
    `The company does not sell this combination at age ${age}. Try another base policy or health plan.`,
  totalPremium: (mode) => `Total premium · ${mode}`,
  belowMinimum: (min) => `Below the company's minimum monthly premium of ${n(min)} baht`,
  refused: (modes, min) => `${modes.join(" and ")}: below the ${n(min)} baht minimum, not accepted by the company`,
  expiredCard: "This premium table has expired. Please ask an agent for current premiums.",
  annualLimit: "Annual medical limit",
  deductible: (baht) => `deductible ${n(baht)} baht a year`,
  copay: (pct) => `co-payment ${pct}% of covered expenses`,
  firstYearOnly: "First-year premium; later years are priced on the higher age",
  dailyCash: (perDay) => `Daily hospital cash ${n(perDay)} baht`,
  dailyCashRow: "Daily hospital cash",
  riderCount: (count) => `${count} additional riders`,
  riderShort: {
    MEB: "Medical expense MEB",
    MEX: "Extra medical MEX",
    DCI: "Critical illness DCI",
    CI123: "Critical illness CI 123",
    CPR: "Cancer CPR",
    RRSS: "So Shield critical illness",
    AP: "Accident AP",
    ECARE: "Accident ECARE",
    PLS: "Extra life cover",
    WP: "Premium waiver WP",
    PB: "Payor benefit PB",
  },
  riderVariant: { FIT: "Fit", BEYOND: "Beyond" },
  sumShort: (s) => `sum ${s}`,
  planShort: (p) => `plan ${p}`,
  andMore: (c) => `and ${c} more`,
  dciTitle: (sum) => `DCI critical illness cover ${sum} baht · 31 illnesses`,
  dciNote: "As defined in, and subject to the conditions of, the policy",
  death: {
    before: (age) => `Death before age ${age}`,
    between: (from, to) => `Age ${from}–${to}`,
    from: (age) => `Age ${age} and over`,
    until: (age) => `Up to age ${age}`,
    always: "At any age",
  },
  printOrPdf: "Print or save as PDF",
  sheetChosen: "Selected plan",
  sheetItems: (mode) => `Premium by contract (${mode})`,
  printedAt: (when) => `Prepared ${when}`,
  copyLink: "Copy link to this page",
  linkCopied: "Copied ✓",
  share: {
    per: { annual: "a year", semi: "every 6 months", monthly: "a month" },
    askPrice: "Ask for the current price in chat",
    ceiling: (b) => `Medical limit ${n(b)} baht a year`,
    territory: (t) => `Territory: ${t}`,
    insured: (sex, age) => `${sex}, age ${age}`,
    total: (amount, mode) =>
      `Total premium about ${amount} baht${{ annual: "/year", semi: "/6 months", monthly: "/month" }[mode]}`,
    baseLine: (label, sum) => `${label}, sum assured ${n(sum)} baht`,
    treatment: "Medical expenses",
    instalment: (mode, amount) => `${mode} ${amount} baht`,
    monthlyRefused: (min) => `(below the ${n(min)} baht minimum; monthly payment not accepted)`,
    family: "Paid to the family on death",
    firstYear: "First-year premium; later years are priced on the higher age",
    fineprint: "Premium for occupational class 1 · Not a quotation: actual premiums and cover depend on"
      + " underwriting and on the policy",
  },

  contact: {
    copy: { full: "Copy text", compact: "Copy", copied: "Copied ✓" },
    kit: {
      open: "Send to customer", choose: "Choose what to send", card: "Card", table: "Table", diseases: "Illnesses", text: "Text",
      send: (n, t) => (n && t ? `Send ${n} image${n > 1 ? "s" : ""} + text` : n ? `Send ${n} image${n > 1 ? "s" : ""}` : "Send text"),
      save: "Save images", working: "Preparing…", loading: "Creating…", nothing: "Choose at least one",
      sent: "Sent ✓ Text copied too, paste it if needed", saved: "Images downloaded · text copied ✓",
    },
  },

  foldTitle: "Add other riders",
  riderGroups: { health: "Health", critical: "Critical illness / cancer", accident: "Accident", life: "Extra life cover", waiver: "Premium waiver" },
  payerTitle: (r) => `Premium payer (${r === "parent" ? "parent" : "spouse"})`,
  payerAgeLabel: "Payer's age",
  payerAgeUnit: "years",
  payerAges: (a, b) => `Payers aged ${a}–${b} are accepted`,
  payerNote: (sex, age) => `payer ${sex.toLowerCase()}, ${age}`,
  pricingFailed: "Could not calculate the premium",
  retry: "Try again",
  pricing: "Calculating…",
  optionOf: (r) => `Option for ${r}`,
  planOf: (r) => `Plan for ${r}`,
  sumOfRider: (r) => `Sum assured for ${r}`,

  tableScroll: "Scroll the table to see other plans",
  tableCaption: (plans) => `iHealthy Ultra benefits, all ${plans} plans`,
  benefitColumn: "Benefit",
  notSold: "Not sold at this age",
  upTo: (limit) => `Up to ${limit}`,
  perDay: "per day",
  samePlans: "same in every plan",
  premiumHeading: "Premium",
  moreOnDesktop: (hidden) => `The full table has ${hidden} more categories on a computer screen · `,
  scrollHint: "Scroll the table right to see other plans · ",
  phoneRow: {
    1: "Room and board",
    5: "Day Surgery",
    7: "Accident OPD 24 hrs",
    10: "Cancer radiotherapy",
    18: "Outpatient (OPD)",
  },

  termsHeading: "Conditions to know before you decide",
  waitingSummary: (d, s) => `No cover for the first ${d} days, and the first ${s} days for some illnesses`,
  waitingBody: (d, g, s) =>
    `Illness arising in the first ${d} days from the start of cover is not covered, and these ${g} groups of illness wait ${s} days`,
  preExistingSummary: "Conditions you had before buying",
  noClaimSummary: (pct) => `No claims for 3 years in a row: ${pct}% off the premium`,
  renewalCopaySummary: "The company may require a co-payment on renewal",
  premiumChangesSummary: "Renewal premiums can change",
  outOfTerritorySummary: (d) => `Treatment abroad: emergencies covered for the first ${d} days of a trip`,
  exclusionsSummary: "What the company does not cover",
  firstYearDisclaimer: (v) =>
    `Premiums shown are first-year premiums for occupational class 1; later years are priced on the higher age · Not a quotation: actual premiums and cover depend on underwriting · Rate set ${v}`,

  rider: riderReader({
    names: {
      "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)": "Medical expense rider (MEB)",
      "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)": "Critical illness rider (DCI)",
      "ไอเฮลท์ตี้ อัลตร้า": "iHealthy Ultra",
      "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)": "Waiver of premium rider (WP)",
      "สัญญาเพิ่มเติมดับบลิวพี ฟิต": "WP Fit",
      "สัญญาเพิ่มเติมดับบลิวพี บียอนด์": "WP Beyond",
      "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)": "Payor benefit rider (PB)",
      "สัญญาเพิ่มเติมพีบี ฟิต": "PB Fit",
      "สัญญาเพิ่มเติมพีบี บียอนด์": "PB Beyond",
      "สัญญาเพิ่มเติมอุบัติเหตุ (AP)": "Accident rider (AP)",
      "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)": "Accident rider (ECARE)",
      "สัญญาเพิ่มเติมค่ารักษาพยาบาลพิเศษ (MEX)": "Extra medical expense rider (MEX)",
      "สัญญาเพิ่มเติม PLS": "PLS rider",
      "สัญญาเพิ่มเติม PLS (PLS05)": "PLS rider (PLS05)",
      "สัญญาเพิ่มเติม PLS (PLS10)": "PLS rider (PLS10)",
      "สัญญาเพิ่มเติม PLS (PLS12)": "PLS rider (PLS12)",
      "สัญญาเพิ่มเติม PLS (PLS15)": "PLS rider (PLS15)",
      "สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR)": "Cancer rider (CPR)",
      "โรคร้ายโซชิลด์": "So Shield critical illness",
      "แผน S": "Plan S",
      "แผน M": "Plan M",
      "แผน L": "Plan L",
      "แผน XL": "Plan XL",
      "สัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (CI 123)": "Critical illness rider (CI 123)",
      "สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC)": "Cancer daily cash rider (HIC)",
    },
    exact: {
      "ไม่สามารถซื้อได้": "Not available",
      "ไม่คุ้มครอง": "Not covered",
      "กรุณาเลือกแบบ": "Please choose an option",
      "ไม่ขายกับ package นี้": "Not sold with this package",
      "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง": "Choose either WP or PB, not both",
      "ไม่สามารถซื้อคู่กับ DCI ได้": "Cannot be bought together with DCI",
      "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์": "The payer's age is outside the accepted range",
      "ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra": "Cannot be bought together with MEX, MEB or iHealthy Ultra",
      "ต้องซื้อคู่กับ CPR": "Must be bought together with CPR",
      "กรอกอายุผู้ชำระเบี้ย": "Enter the payer's age",
    },
    ages: (a, b) => `age ${a} – ${b}`,
    issueAges: (a, b) => `Issue ages ${a} – ${b}`,
    exceeds: (w) => `${w} exceeds the limit`,
    belowMin: (w, m) => `${w} is below the minimum of ${m}`,
    mustBe: (c, a) => `${c} sum assured must be exactly ${a} baht`,
    notPriced: (l) => `${l} — not included in the premium`,
    unreadable: (c) => `${c} riders could not be read and were not priced`,
    paysTo: (p, a) => `${p} — premiums payable to age ${a}`,
    monthlyBelow: (m) => `Monthly premium is below ${m} baht`,
    packageNeeds: (c) => `This package requires ${c}`,
    classOne: (c) => `${c} premium is for occupational class 1; other classes cost more`,
    endorsement: (x) => `Endorsement: ${x}`,
  }),
};

/** 万 and 亿: a Chinese reader counts large sums in ten-thousands, not in millions. */
function wan(baht: number): Big {
  return baht >= 1e8 ? { num: n(baht / 1e8), unit: "亿" } : { num: n(baht / 1e4), unit: "万" };
}

const zh: IHealthyWords = {
  metaTitle: "iHealthy Ultra — 每年医疗费用保障最高1亿泰铢",
  metaDescription:
    "健康保险共6个计划，每年保障额度300万至1亿泰铢，可续保至98岁。比较全部28类保障，并可立即自行计算保费。",
  switchLabel: "语言",
  translationNote: "本翻译仅供参考。如与泰文版本有任何不一致，以泰文版本及保单条款为准。",
  expiredTable: (on) => `本保费表已于 ${on} 过期，请向代理人索取最新保费。`,

  eyebrow: "健康保险 · iHealthy Ultra",
  titleLabel: "医疗费用",
  intro: (min, max, plans, age) => {
    const a = wan(min);
    const b = wan(max);
    return `每年医疗费用保障额度从${a.num}${a.unit}到最高${b.num}${b.unit}泰铢，共${plans}个计划可选，可续保至${age}岁。`;
  },
  highlightsLabel: "保障亮点",
  maxPerYear: "每年最高额度",
  choosePlans: "可选保障",
  plansUnit: "个计划",
  renewTo: "可续保至",
  yearsUnit: "岁",
  designYours: "设计您的保障",

  big: wan,
  bigBaht: (baht) => {
    const b = wan(baht);
    return { num: b.num, unit: `${b.unit}泰铢` };
  },
  baht: "泰铢",
  years: (age) => `${age}岁`,
  sex: { M: "男", F: "女" },
  mode: { annual: "年缴", semi: "半年缴", monthly: "月缴" },
  coverage: { "Full Coverage": "全额保障", Deductible: "含免赔额", "Co-Payment": "共付" },
  territory: { ประเทศไทย: "泰国", เอเชีย: "亚洲", ทั่วโลก: "全球" },

  age: "年龄",
  sexLabel: "性别",
  base: "主合同",
  baseSum: "主合同保额",
  healthPlan: "健康计划",
  coverageLabel: "保障方式",
  baseLabel: { WLF99H: "Life Protect+ x 2", WLF99HX: "Health Ultra Package" },
  baseShort: { WLF99H: "x 2", WLF99HX: "健康套餐" },
  baseNote: { WLF99H: "自选保额" },
  sumOf: (sum) => `保额 ${n(sum)}`,
  baseWithSum: (label, sum) => `${label} 保额 ${n(sum)}`,
  fixedSum: (sum) => `${n(sum)} 泰铢 · 套餐固定，不可更改`,
  onlyPlans: (age, plans) => `${age}岁时公司仅销售 ${plans.join("、")} 计划`,
  territoryOnly: (t, c) => `${t}区域仅提供${c}`,

  notSoldAtAge: (age) => `公司在${age}岁时尚未销售所选组合，请更换主合同或健康计划。`,
  totalPremium: (mode) => `总保费 · ${mode}`,
  belowMinimum: (min) => `低于公司可接受的最低月缴保费 ${n(min)} 泰铢`,
  refused: (modes, min) => `${modes.join("、")}低于最低 ${n(min)} 泰铢，公司不接受`,
  expiredCard: "本保费表已过期，请向代理人索取最新保费。",
  annualLimit: "每年医疗额度",
  deductible: (baht) => `免赔额每年 ${n(baht)} 泰铢`,
  copay: (pct) => `共付已保障费用的 ${pct}%`,
  firstYearOnly: "首年保费，之后按增长的年龄计算",
  dailyCash: (perDay) => `住院每日津贴 ${n(perDay)} 泰铢`,
  dailyCashRow: "住院每日津贴",
  riderCount: (count) => `附加合同 ${count} 项`,
  riderShort: {
    MEB: "医疗费用 MEB",
    MEX: "额外医疗 MEX",
    DCI: "重大疾病 DCI",
    CI123: "重大疾病 CI 123",
    CPR: "癌症 CPR",
    RRSS: "So Shield 重大疾病",
    AP: "意外 AP",
    ECARE: "意外 ECARE",
    PLS: "附加寿险",
    WP: "保费豁免 WP",
    PB: "付款人保障 PB",
  },
  riderVariant: { FIT: "Fit", BEYOND: "Beyond" },
  sumShort: (s) => `保额 ${s}`,
  planShort: (p) => `计划 ${p}`,
  andMore: (c) => `另有 ${c} 项`,
  dciTitle: (sum) => `DCI 重大疾病保障 ${sum} 泰铢 · 31种疾病`,
  dciNote: "以保单中的定义及条件为准",
  death: {
    before: (age) => `${age}岁前身故`,
    between: (from, to) => `${from}–${to}岁`,
    from: (age) => `${age}岁及以上`,
    until: (age) => `至${age}岁`,
    always: "任何年龄",
  },
  printOrPdf: "打印或保存为PDF",
  sheetChosen: "所选计划",
  sheetItems: (mode) => `各合同保费（${mode}）`,
  printedAt: (when) => `制作日期 ${when}`,
  copyLink: "复制本页链接",
  linkCopied: "已复制 ✓",
  share: {
    per: { annual: "每年", semi: "每半年", monthly: "每月" },
    askPrice: "请在聊天中询问当前价格",
    ceiling: (b) => `每年医疗额度 ${n(b)} 泰铢`,
    territory: (t) => `保障区域：${t}`,
    insured: (sex, age) => `${sex} ${age}岁`,
    total: (amount, mode) =>
      `总保费约 ${amount} 泰铢${{ annual: "/年", semi: "/半年", monthly: "/月" }[mode]}`,
    baseLine: (label, sum) => `${label} 保额 ${n(sum)} 泰铢`,
    treatment: "医疗费用",
    instalment: (mode, amount) => `${mode} ${amount} 泰铢`,
    monthlyRefused: (min) => `（低于最低 ${n(min)} 泰铢，公司不接受月缴）`,
    family: "身故时家人可获得",
    firstYear: "首年保费，之后按增长的年龄计算",
    fineprint: "职业等级1的保费 · 非正式报价，实际保费及保障以核保结果及保单为准",
  },

  contact: {
    copy: { full: "复制文字", compact: "复制", copied: "已复制 ✓" },
    kit: {
      open: "发送给客户", choose: "选择要发送的内容", card: "卡片", table: "表格", diseases: "疾病列表", text: "文字",
      send: (n, t) => (n && t ? `发送 ${n} 张图片 + 文字` : n ? `发送 ${n} 张图片` : "发送文字"),
      save: "保存图片", working: "正在准备…", loading: "正在生成…", nothing: "请至少选择一项",
      sent: "已发送 ✓ 文字也已复制，可直接粘贴", saved: "图片已下载 · 文字已复制 ✓",
    },
  },

  foldTitle: "添加其他附加合同",
  riderGroups: { health: "医疗", critical: "重大疾病 / 癌症", accident: "意外", life: "附加寿险", waiver: "保费豁免" },
  payerTitle: (r) => `保费支付人（${r === "parent" ? "父亲或母亲" : "配偶"}）`,
  payerAgeLabel: "支付人年龄",
  payerAgeUnit: "岁",
  payerAges: (a, b) => `支付人年龄须为 ${a}–${b} 岁`,
  payerNote: (sex, age) => `支付人 ${sex} ${age}岁`,
  pricingFailed: "保费计算失败",
  retry: "重试",
  pricing: "正在计算保费…",
  optionOf: (r) => `${r}的类型`,
  planOf: (r) => `${r}的计划`,
  sumOfRider: (r) => `${r}的保额`,

  tableScroll: "滑动表格查看其他计划",
  tableCaption: (plans) => `iHealthy Ultra 全部${plans}个计划的保障表`,
  benefitColumn: "保障项目",
  notSold: "此年龄不销售",
  upTo: (limit) => `最多 ${limit}`,
  perDay: "每天",
  samePlans: "各计划相同",
  premiumHeading: "保费",
  moreOnDesktop: (hidden) => `完整表格另有${hidden}类，请在电脑屏幕查看 · `,
  scrollHint: "向右滑动表格查看其他计划 · ",
  phoneRow: {
    1: "住院房费及膳食费",
    5: "日间手术",
    7: "意外门诊 24小时",
    10: "癌症放射治疗",
    18: "门诊 OPD",
  },

  termsHeading: "决定前需要了解的条件",
  waitingSummary: (d, s) => `前${d}天不保障，部分疾病前${s}天不保障`,
  waitingBody: (d, g, s) => `自保障开始之日起前${d}天内发生的疾病不予保障，以下${g}类疾病须等待${s}天`,
  preExistingSummary: "投保前已有的疾病",
  noClaimSummary: (pct) => `连续3年无理赔，保费减 ${pct}%`,
  renewalCopaySummary: "续保时公司可要求共付",
  premiumChangesSummary: "续保保费可能变动",
  outOfTerritorySummary: (d) => `区域外就医：出行前${d}天的紧急医疗受保障`,
  exclusionsSummary: "公司不予保障的除外责任",
  firstYearDisclaimer: (v) =>
    `所示保费为职业等级1的首年保费，之后按增长的年龄计算 · 非正式报价，实际保费及保障以核保结果为准 · 费率版本 ${v}`,

  rider: riderReader({
    names: {
      "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)": "医疗费用附加合同（MEB）",
      "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)": "重大疾病附加合同（DCI）",
      "ไอเฮลท์ตี้ อัลตร้า": "iHealthy Ultra",
      "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)": "豁免保费附加合同（WP）",
      "สัญญาเพิ่มเติมดับบลิวพี ฟิต": "WP Fit",
      "สัญญาเพิ่มเติมดับบลิวพี บียอนด์": "WP Beyond",
      "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)": "付款人保障附加合同（PB）",
      "สัญญาเพิ่มเติมพีบี ฟิต": "PB Fit",
      "สัญญาเพิ่มเติมพีบี บียอนด์": "PB Beyond",
      "สัญญาเพิ่มเติมอุบัติเหตุ (AP)": "意外附加合同（AP）",
      "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)": "意外附加合同（ECARE）",
      "สัญญาเพิ่มเติมค่ารักษาพยาบาลพิเศษ (MEX)": "额外医疗费用附加合同（MEX）",
      "สัญญาเพิ่มเติม PLS": "PLS 附加合同",
      "สัญญาเพิ่มเติม PLS (PLS05)": "PLS 附加合同（PLS05）",
      "สัญญาเพิ่มเติม PLS (PLS10)": "PLS 附加合同（PLS10）",
      "สัญญาเพิ่มเติม PLS (PLS12)": "PLS 附加合同（PLS12）",
      "สัญญาเพิ่มเติม PLS (PLS15)": "PLS 附加合同（PLS15）",
      "สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR)": "癌症保障附加合同（CPR）",
      "โรคร้ายโซชิลด์": "So Shield 重大疾病保障",
      "แผน S": "S 计划",
      "แผน M": "M 计划",
      "แผน L": "L 计划",
      "แผน XL": "XL 计划",
      "สัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (CI 123)": "重大疾病保障附加合同（CI 123）",
      "สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC)": "癌症住院日津贴附加合同（HIC）",
    },
    exact: {
      "ไม่สามารถซื้อได้": "不可购买",
      "ไม่คุ้มครอง": "不保障",
      "กรุณาเลือกแบบ": "请选择类型",
      "ไม่ขายกับ package นี้": "不与此套餐一起销售",
      "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง": "请在 WP 和 PB 中选择其一",
      "ไม่สามารถซื้อคู่กับ DCI ได้": "不能与 DCI 一起购买",
      "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์": "付款人年龄不符合条件",
      "ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra": "不能与 MEX、MEB 或 iHealthy Ultra 一起购买",
      "ต้องซื้อคู่กับ CPR": "必须与 CPR 一起购买",
      "กรอกอายุผู้ชำระเบี้ย": "请填写支付人年龄",
    },
    ages: (a, b) => `${a} – ${b}岁`,
    issueAges: (a, b) => `投保年龄 ${a} – ${b}岁`,
    exceeds: (w) => `${w}超出规定`,
    belowMin: (w, m) => `${w}低于最低 ${m}`,
    mustBe: (c, a) => `${c}保额必须为 ${a} 泰铢`,
    notPriced: (l) => `${l}，因此未计入保费`,
    unreadable: (c) => `有${c}项附加合同无法读取，因此未计入保费`,
    paysTo: (p, a) => `${p} — 缴费至${a}岁`,
    monthlyBelow: (m) => `月缴保费低于 ${m} 泰铢`,
    packageNeeds: (c) => `此套餐必须购买 ${c}`,
    classOne: (c) => `${c} 保费按第1类职业计算，其他职业类别保费更高`,
    endorsement: (x) => `附加条款：${x}`,
  }),
};

const ru: IHealthyWords = {
  metaTitle: "iHealthy Ultra — покрытие расходов на лечение до 100 млн бат в год",
  metaDescription:
    "Медицинское страхование: 6 планов с годовым лимитом от 3 до 100 млн бат, продление до 98 лет. Сравните все 28 разделов покрытия и сразу рассчитайте свой взнос.",
  switchLabel: "Язык",
  translationNote:
    "Перевод предоставлен только для удобства. При расхождениях с версией на тайском языке преимущественную силу имеют тайская версия и полис.",
  expiredTable: (on) => `Срок действия этой таблицы взносов истёк ${on}. Актуальные взносы уточните у агента.`,

  eyebrow: "Медицинское страхование · iHealthy Ultra",
  titleLabel: "Расходы на лечение",
  intro: (min, max, plans, age) =>
    `Покрытие расходов на лечение в год — от ${n(min / 1e6)} млн до ${n(max / 1e6)} млн бат. ${plans} планов на выбор, продление до ${age} лет.`,
  highlightsLabel: "Главное о покрытии",
  maxPerYear: "Максимум в год",
  choosePlans: "Выбор покрытия",
  plansUnit: "планов",
  renewTo: "Продление до",
  yearsUnit: "лет",
  designYours: "Подберите своё покрытие",

  big: (baht) => ({ num: n(baht / 1e6), unit: "млн" }),
  bigBaht: (baht) => ({ num: n(baht / 1e6), unit: "млн бат" }),
  baht: "бат",
  years: (age) => `${age} лет`,
  // short, because the two share half a phone's width with the age picker
  sex: { M: "Муж.", F: "Жен." },
  mode: { annual: "Ежегодно", semi: "Раз в полгода", monthly: "Ежемесячно" },
  coverage: { "Full Coverage": "Полное покрытие", Deductible: "С франшизой", "Co-Payment": "С доплатой" },
  territory: { ประเทศไทย: "Таиланд", เอเชีย: "Азия", ทั่วโลก: "Весь мир" },

  age: "Возраст",
  sexLabel: "Пол",
  base: "Основной договор",
  baseSum: "Страховая сумма основного договора",
  healthPlan: "План медицинского страхования",
  coverageLabel: "Покрытие",
  baseLabel: { WLF99H: "Life Protect+ x 2", WLF99HX: "Health Ultra Package" },
  baseShort: { WLF99H: "x 2", WLF99HX: "Пакет здоровья" },
  baseNote: { WLF99H: "Своя сумма" },
  sumOf: (sum) => `Сумма ${n(sum)}`,
  baseWithSum: (label, sum) => `${label}, страховая сумма ${n(sum)}`,
  fixedSum: (sum) => `${n(sum)} бат · задана пакетом, изменить нельзя`,
  onlyPlans: (age, plans) => `В возрасте ${age} лет компания продаёт только планы ${plans.join(" и ")}`,
  territoryOnly: (t, c) => `Для территории «${t}» доступно только: ${c.toLowerCase()}`,

  notSoldAtAge: (age) =>
    `В возрасте ${age} лет компания не продаёт выбранное сочетание. Выберите другой основной договор или план.`,
  totalPremium: (mode) => `Общий взнос · ${mode.toLowerCase()}`,
  belowMinimum: (min) => `Ниже минимального ежемесячного взноса компании — ${n(min)} бат`,
  refused: (modes, min) => `${modes.join(" и ")}: ниже минимума ${n(min)} бат, компания не принимает`,
  expiredCard: "Срок действия таблицы взносов истёк. Актуальные взносы уточните у агента.",
  annualLimit: "Годовой лимит на лечение",
  deductible: (baht) => `франшиза ${n(baht)} бат в год`,
  copay: (pct) => `доплата ${pct}% покрываемых расходов`,
  firstYearOnly: "Взнос за первый год; далее рассчитывается по возрасту",
  dailyCash: (perDay) => `Суточные при госпитализации ${n(perDay)} бат`,
  dailyCashRow: "Суточные при госпитализации",
  riderCount: (count) => `Дополнительных договоров: ${count}`,
  riderShort: {
    MEB: "Мед. расходы MEB",
    MEX: "Доп. мед. расходы MEX",
    DCI: "Тяжёлые заболевания DCI",
    CI123: "Тяжёлые заболевания CI 123",
    CPR: "Рак CPR",
    RRSS: "So Shield — тяжёлые заболевания",
    AP: "Несчастный случай AP",
    ECARE: "Несчастный случай ECARE",
    PLS: "Доп. страхование жизни",
    WP: "Освобождение от взносов WP",
    PB: "Защита плательщика PB",
  },
  riderVariant: { FIT: "Fit", BEYOND: "Beyond" },
  sumShort: (s) => `сумма ${s}`,
  planShort: (p) => `план ${p}`,
  andMore: (c) => `и ещё ${c}`,
  dciTitle: (sum) => `DCI — критические заболевания ${sum} бат · 31 заболевание`,
  dciNote: "Согласно определениям и условиям полиса",
  death: {
    before: (age) => `Смерть до ${age} лет`,
    between: (from, to) => `Возраст ${from}–${to} лет`,
    from: (age) => `С ${age} лет`,
    until: (age) => `До ${age} лет`,
    always: "В любом возрасте",
  },
  printOrPdf: "Печать или PDF",
  sheetChosen: "Выбранный план",
  sheetItems: (mode) => `Взнос по договорам (${mode})`,
  printedAt: (when) => `Подготовлено ${when}`,
  copyLink: "Скопировать ссылку",
  linkCopied: "Скопировано ✓",
  share: {
    per: { annual: "в год", semi: "за 6 месяцев", monthly: "в месяц" },
    askPrice: "Узнайте текущую цену в чате",
    ceiling: (b) => `Лимит на лечение ${n(b)} бат в год`,
    territory: (t) => `Территория: ${t}`,
    insured: (sex, age) => `${sex}, ${age} лет`,
    total: (amount, mode) =>
      `Общий взнос около ${amount} бат${{ annual: "/год", semi: "/6 месяцев", monthly: "/месяц" }[mode]}`,
    baseLine: (label, sum) => `${label}, страховая сумма ${n(sum)} бат`,
    treatment: "Медицинские расходы",
    instalment: (mode, amount) => `${mode} ${amount} бат`,
    monthlyRefused: (min) => `(ниже минимума ${n(min)} бат; ежемесячная оплата не принимается)`,
    family: "Выплата семье в случае смерти",
    firstYear: "Взнос за первый год; далее рассчитывается по возрасту",
    fineprint: "Взнос для 1-го класса профессии · Не является коммерческим предложением: фактические взносы"
      + " и покрытие зависят от андеррайтинга и условий полиса",
  },

  contact: {
    copy: { full: "Скопировать текст", compact: "Копия", copied: "Скопировано ✓" },
    kit: {
      open: "Отправить клиенту", choose: "Что отправить", card: "Карточка", table: "Таблица", diseases: "Болезни", text: "Текст",
      send: (n, t) => (n && t ? `Отправить фото (${n}) + текст` : n ? `Отправить фото (${n})` : "Отправить текст"),
      save: "Сохранить фото", working: "Готовим…", loading: "Создаём…", nothing: "Выберите хотя бы одно",
      sent: "Отправлено ✓ Текст тоже скопирован", saved: "Фото скачаны · текст скопирован ✓",
    },
  },

  foldTitle: "Добавить другие дополнительные договоры",
  riderGroups: { health: "Здоровье", critical: "Тяжёлые заболевания / рак", accident: "Несчастный случай", life: "Дополнительное страхование жизни", waiver: "Освобождение от взносов" },
  payerTitle: (r) => `Плательщик взносов (${r === "parent" ? "отец или мать" : "супруг(а)"})`,
  payerAgeLabel: "Возраст плательщика",
  payerAgeUnit: "лет",
  payerAges: (a, b) => `Принимаются плательщики ${a}–${b} лет`,
  payerNote: (sex, age) => `плательщик ${sex}, ${age} лет`,
  pricingFailed: "Не удалось рассчитать взнос",
  retry: "Повторить",
  pricing: "Рассчитываем взнос…",
  optionOf: (r) => `Вариант: ${r}`,
  planOf: (r) => `План: ${r}`,
  sumOfRider: (r) => `Страховая сумма: ${r}`,

  tableScroll: "Прокрутите таблицу, чтобы увидеть другие планы",
  tableCaption: (plans) => `Таблица покрытия iHealthy Ultra, все ${plans} планов`,
  benefitColumn: "Покрытие",
  notSold: "Не продаётся в этом возрасте",
  upTo: (limit) => `Не более ${limit}`,
  perDay: "в день",
  samePlans: "одинаково во всех планах",
  premiumHeading: "Страховой взнос",
  moreOnDesktop: (hidden) => `В полной таблице ещё ${hidden} разделов — откройте на компьютере · `,
  scrollHint: "Прокрутите таблицу вправо, чтобы увидеть другие планы · ",
  phoneRow: {
    1: "Палата и питание",
    5: "Day Surgery",
    7: "Амбулаторно при травме, 24 ч",
    10: "Лучевая терапия рака",
    18: "Амбулаторно (OPD)",
  },

  termsHeading: "Условия, которые нужно знать до решения",
  waitingSummary: (d, s) => `Нет покрытия первые ${d} дней, для некоторых болезней — первые ${s} дней`,
  waitingBody: (d, g, s) =>
    `Болезни, возникшие в первые ${d} дней с начала покрытия, не покрываются, а для этих ${g} групп заболеваний срок ожидания — ${s} дней`,
  preExistingSummary: "Заболевания до начала страхования",
  noClaimSummary: (pct) => `Нет выплат 3 года подряд — скидка ${pct}% на взнос`,
  renewalCopaySummary: "При продлении компания может ввести доплату",
  premiumChangesSummary: "Взнос при продлении может меняться",
  outOfTerritorySummary: (d) => `Лечение за границей: экстренные случаи в первые ${d} дней поездки`,
  exclusionsSummary: "Что компания не покрывает",
  firstYearDisclaimer: (v) =>
    `Указаны взносы за первый год для 1-го класса профессии; далее взнос рассчитывается по возрасту · Не является коммерческим предложением: фактические взносы и покрытие зависят от андеррайтинга · Тарифы ${v}`,

  rider: riderReader({
    names: {
      "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)": "Дополнительный договор медицинских расходов (MEB)",
      "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)": "Дополнительный договор критических заболеваний (DCI)",
      "ไอเฮลท์ตี้ อัลตร้า": "iHealthy Ultra",
      "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)": "Дополнительный договор освобождения от взносов (WP)",
      "สัญญาเพิ่มเติมดับบลิวพี ฟิต": "WP Fit",
      "สัญญาเพิ่มเติมดับบลิวพี บียอนด์": "WP Beyond",
      "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)": "Дополнительный договор защиты плательщика (PB)",
      "สัญญาเพิ่มเติมพีบี ฟิต": "PB Fit",
      "สัญญาเพิ่มเติมพีบี บียอนด์": "PB Beyond",
      "สัญญาเพิ่มเติมอุบัติเหตุ (AP)": "Дополнительный договор от несчастных случаев (AP)",
      "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)": "Дополнительный договор от несчастных случаев (ECARE)",
      "สัญญาเพิ่มเติมค่ารักษาพยาบาลพิเศษ (MEX)": "Дополнительный договор расширенных медицинских расходов (MEX)",
      "สัญญาเพิ่มเติม PLS": "Дополнительный договор PLS",
      "สัญญาเพิ่มเติม PLS (PLS05)": "Дополнительный договор PLS (PLS05)",
      "สัญญาเพิ่มเติม PLS (PLS10)": "Дополнительный договор PLS (PLS10)",
      "สัญญาเพิ่มเติม PLS (PLS12)": "Дополнительный договор PLS (PLS12)",
      "สัญญาเพิ่มเติม PLS (PLS15)": "Дополнительный договор PLS (PLS15)",
      "สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR)": "Дополнительный договор защиты от рака (CPR)",
      "โรคร้ายโซชิลด์": "So Shield — тяжёлые заболевания",
      "แผน S": "План S",
      "แผน M": "План M",
      "แผน L": "План L",
      "แผน XL": "План XL",
      "สัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (CI 123)": "Дополнительный договор тяжёлых заболеваний (CI 123)",
      "สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC)": "Дополнительный договор суточных выплат при раке (HIC)",
    },
    exact: {
      "ไม่สามารถซื้อได้": "Недоступно",
      "ไม่คุ้มครอง": "Не покрывается",
      "กรุณาเลือกแบบ": "Выберите вариант",
      "ไม่ขายกับ package นี้": "Не продаётся с этим пакетом",
      "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง": "Выберите WP или PB, не оба",
      "ไม่สามารถซื้อคู่กับ DCI ได้": "Нельзя купить вместе с DCI",
      "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์": "Возраст плательщика вне допустимых пределов",
      "ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra": "Нельзя купить вместе с MEX, MEB или iHealthy Ultra",
      "ต้องซื้อคู่กับ CPR": "Покупается только вместе с CPR",
      "กรอกอายุผู้ชำระเบี้ย": "Укажите возраст плательщика",
    },
    ages: (a, b) => `${a} – ${b} лет`,
    issueAges: (a, b) => `Возраст страхования ${a} – ${b} лет`,
    exceeds: (w) => `${w}: превышен лимит`,
    belowMin: (w, m) => `${w}: ниже минимума ${m}`,
    mustBe: (c, a) => `Страховая сумма ${c} должна быть ровно ${a} бат`,
    notPriced: (l) => `${l} — не включено во взнос`,
    unreadable: (c) => `Не удалось прочитать дополнительных договоров: ${c}, они не включены во взнос`,
    paysTo: (p, a) => `${p} — взносы до ${a} лет`,
    monthlyBelow: (m) => `Ежемесячный взнос ниже ${m} бат`,
    packageNeeds: (c) => `Этот пакет требует ${c}`,
    classOne: (c) => `Взнос ${c} рассчитан для 1-го класса профессии; для других классов он выше`,
    endorsement: (x) => `Дополнение: ${x}`,
  }),
};

const my: IHealthyWords = {
  metaTitle: "iHealthy Ultra — တစ်နှစ်လျှင် ဆေးကုသစရိတ် ဘတ် သန်း 100 အထိ",
  metaDescription:
    "ကျန်းမာရေးအာမခံ အစီအစဉ် 6 မျိုး၊ တစ်နှစ်လျှင် ဘတ် သန်း 3 မှ 100 အထိ၊ အသက် 98 နှစ်အထိ သက်တမ်းတိုးနိုင်သည်။ အကျိုးခံစားခွင့် အပိုင်း 28 ခုလုံးကို နှိုင်းယှဉ်ပြီး သင့်ပရီမီယံကို ချက်ချင်းတွက်ချက်ပါ။",
  switchLabel: "ဘာသာစကား",
  translationNote:
    "ဤဘာသာပြန်ချက်သည် အဆင်ပြေစေရန်အတွက်သာ ဖြစ်သည်။ ထိုင်းဘာသာမူနှင့် ကွဲလွဲပါက ထိုင်းဘာသာမူနှင့် ပေါ်လစီကိုသာ အတည်ယူရမည်။",
  expiredTable: (on) => `ဤပရီမီယံဇယားသည် ${on} တွင် သက်တမ်းကုန်ဆုံးပြီး ဖြစ်သည်။ လက်ရှိပရီမီယံကို ကိုယ်စားလှယ်ထံ မေးမြန်းပါ။`,

  eyebrow: "ကျန်းမာရေးအာမခံ · iHealthy Ultra",
  titleLabel: "ဆေးကုသစရိတ်",
  intro: (min, max, plans, age) =>
    `တစ်နှစ်လျှင် ဆေးကုသစရိတ်ကို သန်း ${n(min / 1e6)} မှ အများဆုံး ဘတ် သန်း ${n(max / 1e6)} အထိ အကာအကွယ်ပေးသည်။ အစီအစဉ် ${plans} မျိုးမှ ရွေးချယ်နိုင်ပြီး အသက် ${age} နှစ်အထိ သက်တမ်းတိုးနိုင်သည်။`,
  highlightsLabel: "အကာအကွယ် အဓိကအချက်များ",
  maxPerYear: "တစ်နှစ်လျှင် အများဆုံး",
  choosePlans: "အကာအကွယ် ရွေးချယ်မှု",
  plansUnit: "မျိုး",
  renewTo: "သက်တမ်းတိုးနိုင်သည့် အသက်",
  yearsUnit: "နှစ်",
  designYours: "သင့်အကာအကွယ်ကို ရွေးချယ်ပါ",

  big: (baht) => ({ num: n(baht / 1e6), unit: "သန်း" }),
  bigBaht: (baht) => ({ num: n(baht / 1e6), unit: "သန်း ဘတ်" }),
  baht: "ဘတ်",
  years: (age) => `${age} နှစ်`,
  sex: { M: "ကျား", F: "မ" },
  mode: { annual: "နှစ်စဉ်", semi: "6 လတစ်ကြိမ်", monthly: "လစဉ်" },
  coverage: { "Full Coverage": "အပြည့်အဝ", Deductible: "ကိုယ်တိုင်ကျခံငွေဖြင့်", "Co-Payment": "တွဲဖက်ပေးချေမှုဖြင့်" },
  territory: { ประเทศไทย: "ထိုင်းနိုင်ငံ", เอเชีย: "အာရှ", ทั่วโลก: "ကမ္ဘာတစ်ဝှမ်း" },

  age: "အသက်",
  sexLabel: "ကျား/မ",
  base: "အဓိကစာချုပ်",
  baseSum: "အဓိကစာချုပ် အာမခံငွေ",
  healthPlan: "ကျန်းမာရေးအစီအစဉ်",
  coverageLabel: "အကာအကွယ်ပုံစံ",
  baseLabel: { WLF99H: "Life Protect+ x 2", WLF99HX: "Health Ultra Package" },
  baseShort: { WLF99H: "x 2", WLF99HX: "ကျန်းမာရေးပက်ကေ့ချ်" },
  baseNote: { WLF99H: "ငွေပမာဏ ကိုယ်တိုင်ရွေး" },
  sumOf: (sum) => `အာမခံငွေ ${n(sum)}`,
  baseWithSum: (label, sum) => `${label} အာမခံငွေ ${n(sum)}`,
  fixedSum: (sum) => `${n(sum)} ဘတ် · ပက်ကေ့ချ်က သတ်မှတ်ထားပြီး ပြောင်း၍မရပါ`,
  onlyPlans: (age, plans) => `အသက် ${age} နှစ်တွင် ကုမ္ပဏီက ${plans.join(" နှင့် ")} အစီအစဉ်ကိုသာ ရောင်းချသည်`,
  territoryOnly: (t, c) => `${t} နယ်မြေအတွက် ${c} ပုံစံသာ ရနိုင်သည်`,

  notSoldAtAge: (age) =>
    `အသက် ${age} နှစ်တွင် ရွေးထားသော ပုံစံကို ကုမ္ပဏီက မရောင်းချသေးပါ။ အဓိကစာချုပ် သို့မဟုတ် ကျန်းမာရေးအစီအစဉ်ကို ပြောင်းကြည့်ပါ။`,
  totalPremium: (mode) => `စုစုပေါင်း ပရီမီယံ · ${mode}`,
  belowMinimum: (min) => `ကုမ္ပဏီလက်ခံသော အနည်းဆုံး လစဉ်ပရီမီယံ ${n(min)} ဘတ်ထက် နည်းသည်`,
  refused: (modes, min) => `${modes.join(" နှင့် ")} သည် အနည်းဆုံး ${n(min)} ဘတ်ထက် နည်း၍ ကုမ္ပဏီက လက်မခံပါ`,
  expiredCard: "ဤပရီမီယံဇယား သက်တမ်းကုန်ပြီ ဖြစ်သည်။ လက်ရှိပရီမီယံကို ကိုယ်စားလှယ်ထံ မေးမြန်းပါ။",
  annualLimit: "တစ်နှစ်လျှင် ဆေးကုသစရိတ် ကန့်သတ်ငွေ",
  deductible: (baht) => `ကိုယ်တိုင်ကျခံငွေ တစ်နှစ်လျှင် ${n(baht)} ဘတ်`,
  copay: (pct) => `အကာအကွယ်ရသော ကုန်ကျစရိတ်၏ ${pct}% တွဲဖက်ပေးချေ`,
  firstYearOnly: "ပထမနှစ် ပရီမီယံ ဖြစ်ပြီး နောက်နှစ်များတွင် အသက်အလိုက် တွက်ချက်သည်",
  dailyCash: (perDay) => `ဆေးရုံတက် နေ့စဉ်ထောက်ပံ့ငွေ ${n(perDay)} ဘတ်`,
  dailyCashRow: "ဆေးရုံတက် နေ့စဉ်ထောက်ပံ့ငွေ",
  riderCount: (count) => `ဖြည့်စွက်စာချုပ် ${count} ခု`,
  riderShort: {
    MEB: "ဆေးကုသစရိတ် MEB",
    MEX: "အပိုဆေးကုသစရိတ် MEX",
    DCI: "ပြင်းထန်သောရောဂါ DCI",
    CI123: "ပြင်းထန်သောရောဂါ CI 123",
    CPR: "ကင်ဆာ CPR",
    RRSS: "So Shield ပြင်းထန်သောရောဂါ",
    AP: "မတော်တဆမှု AP",
    ECARE: "မတော်တဆမှု ECARE",
    PLS: "အသက်အာမခံ ထပ်ဆောင်း",
    WP: "ပရီမီယံ ကင်းလွတ်ခွင့် WP",
    PB: "ပေးသူ အကာအကွယ် PB",
  },
  riderVariant: { FIT: "Fit", BEYOND: "Beyond" },
  sumShort: (s) => `အာမခံငွေ ${s}`,
  planShort: (p) => `အစီအစဉ် ${p}`,
  andMore: (c) => `နောက်ထပ် ${c} ခု`,
  dciTitle: (sum) => `DCI ပြင်းထန်သောရောဂါ အကာအကွယ် ${sum} ဘတ် · ရောဂါ 31 မျိုး`,
  dciNote: "ပေါ်လစီပါ အဓိပ္ပာယ်ဖွင့်ဆိုချက်နှင့် စည်းကမ်းချက်များအတိုင်း",
  death: {
    before: (age) => `အသက် ${age} နှစ်မတိုင်မီ သေဆုံးပါက`,
    between: (from, to) => `အသက် ${from}–${to} နှစ်`,
    from: (age) => `အသက် ${age} နှစ်နှင့်အထက်`,
    until: (age) => `အသက် ${age} နှစ်အထိ`,
    always: "အသက်မရွေး",
  },
  printOrPdf: "ပုံနှိပ်ရန် သို့မဟုတ် PDF သိမ်းရန်",
  sheetChosen: "ရွေးချယ်ထားသော အစီအစဉ်",
  sheetItems: (mode) => `စာချုပ်အလိုက် ပရီမီယံ (${mode})`,
  printedAt: (when) => `ပြုစုသည့်ရက် ${when}`,
  copyLink: "ဤစာမျက်နှာလင့်ခ် ကူးယူရန်",
  linkCopied: "ကူးယူပြီး ✓",
  share: {
    per: { annual: "တစ်နှစ်လျှင်", semi: "6 လလျှင်", monthly: "တစ်လလျှင်" },
    askPrice: "လက်ရှိ ဈေးနှုန်းကို chat တွင် မေးမြန်းပါ",
    ceiling: (b) => `တစ်နှစ်လျှင် ဆေးကုသစရိတ် ကန့်သတ်ငွေ ${n(b)} ဘတ်`,
    territory: (t) => `အကာအကွယ်နယ်မြေ - ${t}`,
    insured: (sex, age) => `${sex} အသက် ${age} နှစ်`,
    total: (amount, mode) =>
      `စုစုပေါင်း ပရီမီယံ ခန့်မှန်း ${amount} ဘတ် (${{ annual: "တစ်နှစ်လျှင်", semi: "6 လလျှင်", monthly: "တစ်လလျှင်" }[mode]})`,
    baseLine: (label, sum) => `${label} အာမခံငွေ ${n(sum)} ဘတ်`,
    treatment: "ဆေးကုသစရိတ်",
    instalment: (mode, amount) => `${mode} ${amount} ဘတ်`,
    monthlyRefused: (min) => `(အနည်းဆုံး ${n(min)} ဘတ်ထက် နည်း၍ လစဉ်ပေးချေမှုကို ကုမ္ပဏီက လက်မခံပါ)`,
    family: "သေဆုံးပါက မိသားစု ရရှိမည့်ငွေ",
    firstYear: "ပထမနှစ် ပရီမီယံ ဖြစ်ပြီး နောက်နှစ်များတွင် အသက်အလိုက် တွက်ချက်သည်",
    fineprint: "အလုပ်အကိုင်အဆင့် 1 ၏ ပရီမီယံ · ဈေးနှုန်းကမ်းလှမ်းချက် မဟုတ်ပါ၊ အမှန်တကယ် ပရီမီယံနှင့် အကာအကွယ်မှာ"
      + " အာမခံလက်ခံစိစစ်မှုရလဒ်နှင့် ပေါ်လစီပါအတိုင်း ဖြစ်သည်",
  },

  contact: {
    copy: { full: "စာသား ကူးယူရန်", compact: "ကူး", copied: "ကူးယူပြီး ✓" },
    kit: {
      open: "ဖောက်သည်ထံ ပို့ရန်", choose: "ပို့မည့်အရာ ရွေးပါ", card: "ကတ်", table: "ဇယား", diseases: "ရောဂါစာရင်း", text: "စာသား",
      send: (n, t) => (n && t ? `ပုံ ${n} ပုံ + စာသား ပို့ရန်` : n ? `ပုံ ${n} ပုံ ပို့ရန်` : "စာသား ပို့ရန်"),
      save: "ပုံများ သိမ်းရန်", working: "ပြင်ဆင်နေသည်…", loading: "ပြုလုပ်နေသည်…", nothing: "အနည်းဆုံး တစ်ခု ရွေးပါ",
      sent: "ပို့ပြီး ✓ စာသားကိုလည်း ကူးထားသည်", saved: "ပုံများ ဒေါင်းလုဒ်ပြီး · စာသား ကူးပြီး ✓",
    },
  },

  foldTitle: "အခြား ဖြည့်စွက်စာချုပ်များ ထည့်ရန်",
  riderGroups: { health: "ကျန်းမာရေး", critical: "ပြင်းထန်သောရောဂါ / ကင်ဆာ", accident: "မတော်တဆမှု", life: "အသက်အာမခံ ထပ်ဆောင်း", waiver: "ပရီမီယံ ကင်းလွတ်ခွင့်" },
  payerTitle: (r) => `ပရီမီယံပေးသူ (${r === "parent" ? "မိဘ" : "ခင်ပွန်း/ဇနီး"})`,
  payerAgeLabel: "ပေးသူ၏ အသက်",
  payerAgeUnit: "နှစ်",
  payerAges: (a, b) => `အသက် ${a}–${b} နှစ် ပေးသူများကို လက်ခံသည်`,
  payerNote: (sex, age) => `ပေးသူ ${sex} အသက် ${age} နှစ်`,
  pricingFailed: "ပရီမီယံ တွက်ချက်၍ မရပါ",
  retry: "ထပ်ကြိုးစားရန်",
  pricing: "ပရီမီယံ တွက်ချက်နေသည်…",
  optionOf: (r) => `${r} ၏ ပုံစံ`,
  planOf: (r) => `${r} ၏ အစီအစဉ်`,
  sumOfRider: (r) => `${r} ၏ အာမခံငွေ`,

  tableScroll: "အခြားအစီအစဉ်များ ကြည့်ရန် ဇယားကို ရွှေ့ပါ",
  tableCaption: (plans) => `iHealthy Ultra အစီအစဉ် ${plans} မျိုးလုံး၏ အကျိုးခံစားခွင့်ဇယား`,
  benefitColumn: "အကျိုးခံစားခွင့်",
  notSold: "ဤအသက်တွင် မရောင်းပါ",
  upTo: (limit) => `အများဆုံး ${limit}`,
  perDay: "တစ်ရက်လျှင်",
  samePlans: "အစီအစဉ်အားလုံး အတူတူ",
  premiumHeading: "ပရီမီယံ",
  moreOnDesktop: (hidden) => `ဇယားအပြည့်တွင် နောက်ထပ် အပိုင်း ${hidden} ခု ရှိပြီး ကွန်ပျူတာဖန်သားပြင်တွင် ကြည့်နိုင်သည် · `,
  scrollHint: "အခြားအစီအစဉ်များ ကြည့်ရန် ဇယားကို ညာဘက်သို့ ရွှေ့ပါ · ",
  phoneRow: {
    1: "အခန်းခနှင့် အစားအသောက်",
    5: "Day Surgery",
    7: "မတော်တဆ ပြင်ပလူနာ 24 နာရီ",
    10: "ကင်ဆာ ဓာတ်ရောင်ခြည်ကုထုံး",
    18: "ပြင်ပလူနာ (OPD)",
  },

  termsHeading: "မဆုံးဖြတ်မီ သိထားရမည့် စည်းကမ်းချက်များ",
  waitingSummary: (d, s) => `ပထမ ${d} ရက်နှင့် အချို့ရောဂါများအတွက် ပထမ ${s} ရက် အကာအကွယ်မရပါ`,
  waitingBody: (d, g, s) =>
    `အကာအကွယ်စတင်သည့်နေ့မှ ပထမ ${d} ရက်အတွင်း ဖြစ်ပေါ်သော ဖျားနာမှုကို အကာအကွယ်မပေးဘဲ အောက်ပါ ရောဂါအုပ်စု ${g} ခုအတွက် ${s} ရက် စောင့်ရမည်`,
  preExistingSummary: "အာမခံမဝယ်မီ ရှိပြီးသော ရောဂါများ",
  noClaimSummary: (pct) => `3 နှစ်ဆက်တိုက် လျော်ကြေးမတောင်းပါက ပရီမီယံ ${pct}% လျှော့`,
  renewalCopaySummary: "သက်တမ်းတိုးချိန်တွင် ကုမ္ပဏီက တွဲဖက်ပေးချေရန် တောင်းဆိုနိုင်သည်",
  premiumChangesSummary: "သက်တမ်းတိုးနှစ် ပရီမီယံ ပြောင်းလဲနိုင်သည်",
  outOfTerritorySummary: (d) => `နယ်မြေပြင်ပ ကုသမှု- ခရီးစဉ်၏ ပထမ ${d} ရက်အတွင်း အရေးပေါ်ကုသမှုကို အကာအကွယ်ပေးသည်`,
  exclusionsSummary: "ကုမ္ပဏီက အကာအကွယ်မပေးသော ခြွင်းချက်များ",
  firstYearDisclaimer: (v) =>
    `ပြထားသော ပရီမီယံသည် အလုပ်အကိုင်အဆင့် 1 ၏ ပထမနှစ် ပရီမီယံ ဖြစ်ပြီး နောက်နှစ်များတွင် အသက်အလိုက် တွက်ချက်သည် · ဈေးနှုန်းကမ်းလှမ်းချက် မဟုတ်ပါ၊ အမှန်တကယ် ပရီမီယံနှင့် အကာအကွယ်မှာ အာမခံလက်ခံစိစစ်မှုရလဒ်အတိုင်း ဖြစ်သည် · နှုန်းထား ${v}`,

  rider: riderReader({
    names: {
      "สัญญาเพิ่มเติมค่ารักษาพยาบาล (MEB)": "ဆေးကုသစရိတ် ဖြည့်စွက်စာချုပ် (MEB)",
      "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)": "ပြင်းထန်သောရောဂါ ဖြည့်စွက်စာချုပ် (DCI)",
      "ไอเฮลท์ตี้ อัลตร้า": "iHealthy Ultra",
      "สัญญาเพิ่มเติมดับบลิวพี (ยกเว้นเบี้ย)": "ပရီမီယံ ကင်းလွတ်ခွင့် ဖြည့်စွက်စာချုပ် (WP)",
      "สัญญาเพิ่มเติมดับบลิวพี ฟิต": "WP Fit",
      "สัญญาเพิ่มเติมดับบลิวพี บียอนด์": "WP Beyond",
      "สัญญาเพิ่มเติมพีบี (ผู้ชำระเบี้ย)": "ပရီမီယံပေးသူ အကာအကွယ် ဖြည့်စွက်စာချုပ် (PB)",
      "สัญญาเพิ่มเติมพีบี ฟิต": "PB Fit",
      "สัญญาเพิ่มเติมพีบี บียอนด์": "PB Beyond",
      "สัญญาเพิ่มเติมอุบัติเหตุ (AP)": "မတော်တဆမှု ဖြည့်စွက်စာချုပ် (AP)",
      "สัญญาเพิ่มเติมอุบัติเหตุ (ECARE)": "မတော်တဆမှု ဖြည့်စွက်စာချုပ် (ECARE)",
      "สัญญาเพิ่มเติมค่ารักษาพยาบาลพิเศษ (MEX)": "အပိုဆေးကုသစရိတ် ဖြည့်စွက်စာချုပ် (MEX)",
      "สัญญาเพิ่มเติม PLS": "PLS ဖြည့်စွက်စာချုပ်",
      "สัญญาเพิ่มเติม PLS (PLS05)": "PLS ဖြည့်စွက်စာချုပ် (PLS05)",
      "สัญญาเพิ่มเติม PLS (PLS10)": "PLS ဖြည့်စွက်စာချုပ် (PLS10)",
      "สัญญาเพิ่มเติม PLS (PLS12)": "PLS ဖြည့်စွက်စာချုပ် (PLS12)",
      "สัญญาเพิ่มเติม PLS (PLS15)": "PLS ဖြည့်စွက်စာချုပ် (PLS15)",
      "สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR)": "ကင်ဆာ အကာအကွယ် ဖြည့်စွက်စာချုပ် (CPR)",
      "โรคร้ายโซชิลด์": "So Shield ပြင်းထန်သောရောဂါ",
      "แผน S": "အစီအစဉ် S",
      "แผน M": "အစီအစဉ် M",
      "แผน L": "အစီအစဉ် L",
      "แผน XL": "အစီအစဉ် XL",
      "สัญญาเพิ่มเติมคุ้มครองโรคร้ายแรง (CI 123)": "ပြင်းထန်သောရောဂါ အကာအကွယ် ဖြည့်စွက်စာချုပ် (CI 123)",
      "สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC)": "ကင်ဆာကြောင့် နေ့စဉ်ထောက်ပံ့ကြေး ဖြည့်စွက်စာချုပ် (HIC)",
    },
    exact: {
      "ไม่สามารถซื้อได้": "ဝယ်၍မရပါ",
      "ไม่คุ้มครอง": "အကာအကွယ်မပေးပါ",
      "กรุณาเลือกแบบ": "ပုံစံ ရွေးချယ်ပါ",
      "ไม่ขายกับ package นี้": "ဤပက်ကေ့ချ်နှင့် မရောင်းပါ",
      "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง": "WP သို့မဟုတ် PB တစ်ခုသာ ရွေးပါ",
      "ไม่สามารถซื้อคู่กับ DCI ได้": "DCI နှင့်အတူ ဝယ်၍မရပါ",
      "อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์": "ပရီမီယံပေးသူ၏ အသက်သည် သတ်မှတ်ချက်နှင့် မကိုက်ညီပါ",
      "ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra": "MEX၊ MEB သို့မဟုတ် iHealthy Ultra နှင့်အတူ ဝယ်၍မရပါ",
      "ต้องซื้อคู่กับ CPR": "CPR နှင့်အတူသာ ဝယ်နိုင်သည်",
      "กรอกอายุผู้ชำระเบี้ย": "ပေးသူ၏ အသက်ကို ဖြည့်ပါ",
    },
    ages: (a, b) => `${a} – ${b} နှစ်`,
    issueAges: (a, b) => `အာမခံနိုင်သည့် အသက် ${a} – ${b} နှစ်`,
    exceeds: (w) => `${w} သတ်မှတ်ချက်ထက် ကျော်လွန်သည်`,
    belowMin: (w, m) => `${w} အနည်းဆုံး ${m} ထက် နည်းသည်`,
    mustBe: (c, a) => `${c} အာမခံငွေသည် ${a} ဘတ် အတိအကျ ဖြစ်ရမည်`,
    notPriced: (l) => `${l} — ပရီမီယံတွင် မထည့်တွက်ပါ`,
    unreadable: (c) => `ဖတ်၍မရသော ဖြည့်စွက်စာချုပ် ${c} ခုကို ပရီမီယံတွင် မထည့်တွက်ပါ`,
    paysTo: (p, a) => `${p} — အသက် ${a} နှစ်အထိ ပရီမီယံပေးသွင်း`,
    monthlyBelow: (m) => `လစဉ်ပရီမီယံသည် ${m} ဘတ်ထက် နည်းသည်`,
    packageNeeds: (c) => `ဤပက်ကေ့ချ်သည် ${c} ဝယ်ရန် လိုအပ်သည်`,
    classOne: (c) => `${c} ပရီမီယံကို အလုပ်အကိုင်အဆင့် ၁ ဖြင့် တွက်ထားသည်၊ အခြားအဆင့်များ ပိုများသည်`,
    endorsement: (x) => `ဖြည့်စွက်ချက်: ${x}`,
  }),
};

export const WORDS: Record<Lang, IHealthyWords> = { th, en, zh, ru, my };

/** The engine's own Thai names and notes stay as they are where a language has no line for them. */
export function baseWords(w: IHealthyWords, variant: string, table: { label: string; short: string; note?: string }) {
  return {
    label: w.baseLabel[variant] ?? table.label,
    short: w.baseShort[variant] ?? table.short,
    note: table.note === undefined ? undefined : w.baseNote[variant] ?? table.note,
  };
}
