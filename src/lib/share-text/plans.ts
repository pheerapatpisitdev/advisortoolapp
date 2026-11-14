import type { GsQuote } from "@/calc/global-saving/engine";
import { GS_PREM_YEARS, GS_TAX_CAP } from "@/calc/global-saving/engine";
import { formatBaht } from "@/calc/money";
import type { PensionQuote } from "@/calc/pension/engine";
import type { PayMode } from "@/calc/types";
import type { CancerQuoteFacts } from "@/lib/cancer-cta";
import type { Ci123QuoteFacts } from "@/lib/ci123-cta";
import type { EasyProtectQuoteFacts } from "@/lib/easyprotect-cta";
import { firstMonthlyPayment } from "@/lib/first-payment";
import type { IHealthyCtaFacts } from "@/lib/ihealthy-cta";
import type { IShieldQuoteFacts } from "@/lib/ishield-cta";
import { displayPremium, PER, perDayText, type LegacyQuoteFacts } from "@/lib/legacy-cta";
import { ageWord, type LifeProtectQuoteFacts } from "@/lib/lifeprotect-cta";
import type { LifeTreasureQuoteFacts } from "@/lib/lifetreasure-cta";
import type { PensionWho } from "@/lib/pension-cta";
import type { PlbQuoteFacts } from "@/lib/plb-cta";
import type { BlockDef } from "./template";

/**
 * The plans a member may write their own ข้อความส่งให้ลูกค้า for, and the figures each one offers
 * a template by name (see template.ts). A slot's value is worded exactly as the standard text
 * words that figure, so a custom text and the card beside it never disagree.
 *
 * iHealthy's four-plan comparison is not here: it is a table of plans, not one quote, and has no
 * single figure to name.
 */
export const SHARE_PLAN_KEYS = [
  "lifeprotect", "easyprotect", "lifetreasure", "ishield", "plb", "legacy",
  "cancer", "ci123", "pension", "gsaving", "ihealthy",
] as const;
export type SharePlan = (typeof SHARE_PLAN_KEYS)[number];
export const isSharePlan = (v: unknown): v is SharePlan => SHARE_PLAN_KEYS.includes(v as SharePlan);

export interface SlotDef { name: string; what: string }
export interface SharePlanDef {
  name: string;
  slots: SlotDef[];
  blocks: BlockDef[];
}

type Slots = Record<string, string | undefined>;
const baht = (n: number) => n.toLocaleString("en-US");
const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;

const WHO: SlotDef[] = [
  { name: "เพศ", what: "เพศของผู้เอาประกัน: ชาย หรือ หญิง" },
  { name: "อายุ", what: "อายุของผู้เอาประกัน เป็นตัวเลข (ไม่มีคำว่าปี)" },
];
const PREMIUM: SlotDef[] = [
  { name: "เบี้ยหลัก", what: "เบี้ยงวดที่ใช้เป็นตัวเลขหลัก พร้อมหน่วย เช่น 2,583 บาท/เดือน" },
  { name: "ตกวันละ", what: "เบี้ยเฉลี่ยต่อวัน เป็นจำนวนบาท" },
  { name: "เบี้ยรายเดือน", what: "เบี้ยรายเดือน เป็นจำนวนบาท" },
  { name: "เบี้ยราย 6 เดือน", what: "เบี้ยราย 6 เดือน เป็นจำนวนบาท" },
  { name: "เบี้ยรายปี", what: "เบี้ยรายปี เป็นจำนวนบาท" },
  { name: "ชำระครั้งแรก", what: "ยอดชำระครั้งแรกเมื่อจ่ายรายเดือน (2 งวด) เป็นจำนวนบาท" },
  { name: "เบี้ยทุกงวด", what: "รายการเบี้ยทุกงวด หลายบรรทัด ต้องอยู่บรรทัดของตัวเอง" },
];
const FAMILY: BlockDef = { name: "ครอบครัวได้รับ", starts: "👪", what: "หัวข้อและรายการเงินที่ครอบครัวได้รับเมื่อเสียชีวิต หลายบรรทัด" };
const CASH: BlockDef = { name: "มูลค่าเงินสด", starts: "🏦", what: "หัวข้อและรายการมูลค่าเงินสดตามอายุ หลายบรรทัด" };

type Mode = { mode: PayMode; total: number; belowMinimum?: boolean };

/** The premium figures every level-premium plan offers, from the instalments its text prints. */
function premiumSlots(headline: Mode | undefined, modes: Mode[], perDay = true): Slots {
  const of = (mode: PayMode) => {
    const m = modes.find((x) => x.mode === mode);
    return m && !m.belowMinimum ? formatBaht(m.total) : undefined;
  };
  const annual = modes.find((m) => m.mode === "annual");
  const first = firstMonthlyPayment(modes.map((m) => ({ ...m, belowMinimum: Boolean(m.belowMinimum) })));
  return {
    "เบี้ยหลัก": headline ? `${formatBaht(headline.total)} บาท${PER[headline.mode]}` : undefined,
    "ตกวันละ": perDay && annual ? perDayText(annual.total) : undefined,
    "เบี้ยรายเดือน": of("monthly"),
    "เบี้ยราย 6 เดือน": of("semi"),
    "เบี้ยรายปี": of("annual"),
    "ชำระครั้งแรก": first === undefined ? undefined : formatBaht(first),
  };
}

export const SHARE_PLANS: Record<SharePlan, SharePlanDef> = {
  lifeprotect: {
    name: "Life Protect x 2",
    slots: [
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" },
      { name: "ทุนเพิ่มเป็น", what: "ทุนที่เพิ่มเป็น 2 เท่าเมื่อเสียชีวิตก่อนอายุที่กำหนด เป็นจำนวนบาท" },
      { name: "อายุที่ทุนเพิ่ม", what: "อายุที่ทุน 2 เท่าสิ้นสุด เช่น 60" },
      ...WHO,
      { name: "ระยะจ่าย", what: "ระยะชำระเบี้ย เป็นวลี เช่น จ่าย 19 ปี" },
      ...PREMIUM,
    ],
    blocks: [FAMILY],
  },
  easyprotect: {
    name: "อีซี่ โพรเทค 6",
    slots: [
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" }, ...WHO,
      { name: "จำนวนปีที่จ่าย", what: "จำนวนปีที่ชำระเบี้ย เป็นตัวเลข" },
      { name: "คุ้มครองถึงอายุ", what: "อายุที่ความคุ้มครองสิ้นสุด เป็นตัวเลข" },
      { name: "เบี้ยรวมทั้งหมด", what: "เบี้ยรวมตลอดระยะชำระ เป็นจำนวนบาท" },
      { name: "กี่เท่าของเบี้ย", what: "ทุนเป็นกี่เท่าของเบี้ยที่จ่ายทั้งหมด เช่น 2.5" },
      ...PREMIUM,
    ],
    blocks: [FAMILY, CASH],
  },
  lifetreasure: {
    name: "ไลฟ์เทรเชอร์",
    slots: [
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" }, ...WHO,
      { name: "ระยะจ่าย", what: "ระยะชำระเบี้ย เป็นวลี เช่น ชำระเบี้ย 18 ปี" },
      { name: "จำนวนปีที่จ่าย", what: "จำนวนปีที่ชำระเบี้ย เป็นตัวเลข" },
      { name: "คุ้มครองถึงอายุ", what: "อายุที่ความคุ้มครองสิ้นสุด เป็นตัวเลข" },
      { name: "เบี้ยรวมทั้งหมด", what: "เบี้ยรวมตลอดระยะชำระ เป็นจำนวนบาท" },
      { name: "กี่เท่าของเบี้ย", what: "ทุนเป็นกี่เท่าของเบี้ยที่จ่ายทั้งหมด เช่น 1.5" },
      ...PREMIUM,
    ],
    blocks: [FAMILY, CASH],
  },
  ishield: {
    name: "iShield",
    slots: [
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" }, ...WHO,
      { name: "ระยะจ่าย", what: "ระยะชำระเบี้ย เป็นวลี เช่น ชำระเบี้ย 10 ปี" },
      { name: "คุ้มครองถึงอายุ", what: "อายุที่สัญญาครบกำหนด เป็นตัวเลข" },
      { name: "โรคระยะเริ่มต้นรับ", what: "เงินที่ได้รับต่อโรคเมื่อตรวจพบโรคร้ายแรงระยะเริ่มต้น เป็นจำนวนบาท" },
      { name: "โรคระยะรุนแรงรับ", what: "เงินสูงสุดเมื่อตรวจพบโรคร้ายแรงระยะรุนแรง เป็นจำนวนบาท" },
      { name: "เงินคืนครบสัญญา", what: "เงินที่รับคืนเมื่ออยู่ครบสัญญา เป็นจำนวนบาท" },
      ...PREMIUM,
    ],
    blocks: [
      { name: "โรคร้ายแรง", starts: "🩺", what: "หัวข้อและรายการเงินที่ได้รับเมื่อตรวจพบโรคร้ายแรง หลายบรรทัด" },
      { ...FAMILY, name: "เสียชีวิต", what: "หัวข้อและเงินที่ได้รับเมื่อเสียชีวิต หลายบรรทัด" },
      { name: "ครบสัญญา", starts: "🎁", what: "หัวข้อและเงินที่รับคืนเมื่ออยู่ครบสัญญา หลายบรรทัด" },
      CASH,
    ],
  },
  plb: {
    name: "Protection Life",
    slots: [
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" }, ...WHO,
      { name: "ระยะจ่าย", what: "ระยะชำระเบี้ย เป็นวลี เช่น ชำระเบี้ย 12 ปี" },
      { name: "จำนวนปีที่คุ้มครอง", what: "จำนวนปีที่คุ้มครอง เป็นตัวเลข" },
      { name: "คุ้มครองถึงอายุ", what: "อายุที่ความคุ้มครองสิ้นสุด เป็นตัวเลข" },
      { name: "เบี้ยรวมทั้งหมด", what: "เบี้ยรวมตลอดสัญญา เป็นจำนวนบาท" },
      ...PREMIUM,
    ],
    blocks: [FAMILY],
  },
  legacy: {
    name: "มรดกเพื่อครอบครัว",
    slots: [
      { name: "ทุน", what: "เงินที่ครอบครัวได้รับตามแผน เป็นจำนวนบาท เช่น 1,000,000" }, ...WHO,
      { name: "โรคร้ายแรงรับ", what: "เงินสดที่ได้รับเมื่อตรวจพบโรคร้ายแรง เป็นจำนวนบาท" },
      { name: "จำนวนโรค", what: "จำนวนโรคร้ายแรงที่คุ้มครอง เป็นตัวเลข" },
      ...PREMIUM,
    ],
    blocks: [{ name: "โรคร้ายแรง", starts: "🏥", what: "เงินสดเมื่อตรวจพบโรคร้ายแรงและเงื่อนไข หลายบรรทัด" }, FAMILY],
  },
  cancer: {
    name: "ประกันมะเร็ง",
    slots: [
      { name: "ทุนมะเร็ง", what: "ทุนคุ้มครองโรคมะเร็ง เป็นจำนวนบาท" },
      { name: "ชดเชยวันละ", what: "ค่าชดเชยนอนโรงพยาบาลเพราะมะเร็งต่อวัน เป็นจำนวนบาท" },
      ...WHO, ...PREMIUM,
    ],
    blocks: [
      { name: "เงินก้อนตามระยะ", starts: "🔬", what: "หัวข้อและรายการเงินก้อนตามระยะของมะเร็ง หลายบรรทัด" },
      { name: "นอนโรงพยาบาล", starts: "🏥", what: "หัวข้อและค่าชดเชยรายวันเมื่อนอนโรงพยาบาลเพราะมะเร็ง หลายบรรทัด" },
      { name: "ชุดนี้ประกอบด้วย", starts: "📄", what: "รายการสัญญาที่อยู่ในชุดนี้ หลายบรรทัด" },
    ],
  },
  ci123: {
    name: "CI 123",
    slots: [
      { name: "ทุน", what: "ทุนประกันโรคร้ายแรง เป็นจำนวนบาท" }, ...WHO,
      { name: "จำนวนโรค", what: "จำนวนโรคที่คุ้มครอง เป็นตัวเลข" },
      ...PREMIUM,
    ],
    blocks: [
      { name: "เงินก้อนตามระยะ", starts: "🏥", what: "หัวข้อและรายการเงินก้อนตามระยะของโรค หลายบรรทัด" },
      { name: "ชุดนี้ประกอบด้วย", starts: "📄", what: "รายการสัญญาที่อยู่ในชุดนี้ หลายบรรทัด" },
    ],
  },
  pension: {
    name: "บำนาญ สมาร์ท 95",
    slots: [
      ...WHO,
      { name: "บำนาญเดือนละ", what: "บำนาญต่อเดือนในช่วงแรก เป็นจำนวนบาท" },
      { name: "เริ่มรับบำนาญอายุ", what: "อายุที่เริ่มรับบำนาญ เป็นตัวเลข" },
      { name: "จำนวนปีที่จ่าย", what: "จำนวนปีที่ชำระเบี้ย เป็นตัวเลข" },
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" },
      { name: "เบี้ยปีละ", what: "เบี้ยที่จ่ายต่อปี รวมสัญญาเพิ่มเติม เป็นจำนวนบาท" },
      { name: "เบี้ยรวมทั้งหมด", what: "เบี้ยสัญญาหลักรวมตลอดระยะชำระ เป็นจำนวนบาท" },
      { name: "รวมรับบำนาญ", what: "บำนาญรวมที่ได้รับถึงอายุ 95 โดยประมาณ เป็นจำนวนบาท" },
    ],
    blocks: [
      { name: "ตารางบำนาญ", starts: "🎁", what: "หัวข้อและบำนาญแต่ละช่วงอายุ หลายบรรทัด" },
      { name: "เบี้ย", starts: "💰", what: "เบี้ยตามงวดที่เลือกและงวดอื่น หลายบรรทัด" },
    ],
  },
  gsaving: {
    name: "Global Savings Plus 15/8",
    slots: [
      { name: "อายุ", what: "อายุของผู้เอาประกัน เป็นตัวเลข" },
      { name: "เบี้ยปีละ", what: "เบี้ยต่อปี เป็นจำนวนบาท" },
      { name: "เบี้ยรวมทั้งหมด", what: "เบี้ยรวม 8 ปี เป็นจำนวนบาท" },
      { name: "ทุน", what: "ทุนประกัน เป็นจำนวนบาท" },
      { name: "เงินการันตีรวม", what: "เงินที่การันตีรวมตลอดสัญญา เป็นจำนวนบาท" },
      { name: "เงินคืนปีละ", what: "เงินคืนทุกปี เป็นจำนวนบาท" },
      { name: "เงินครบสัญญา", what: "เงินที่รับเมื่อครบสัญญา เป็นจำนวนบาท" },
      { name: "ลดหย่อนภาษีปีละ", what: "เบี้ยที่ใช้ลดหย่อนภาษีได้ต่อปี เป็นจำนวนบาท" },
    ],
    blocks: [{ name: "เงินที่ได้รับ", starts: "✅", what: "เงินการันตีและตัวอย่างเมื่อดัชนีโต (ไม่การันตี) หลายบรรทัด" }],
  },
  ihealthy: {
    name: "iHealthy Ultra",
    slots: [
      { name: "แผน", what: "ชื่อแผน เช่น Gold" },
      { name: "วงเงินต่อปี", what: "วงเงินค่ารักษาต่อปี เป็นจำนวนบาท" },
      { name: "ค่าห้องต่อวัน", what: "ค่าห้องและอาหารต่อวัน เป็นจำนวนบาท" },
      { name: "OPD ต่อปี", what: "วงเงิน OPD ต่อปี เป็นจำนวนบาท (ไม่มีในแผนที่ไม่คุ้มครอง OPD)" },
      ...WHO,
      // the text headlines no instalment, gives no per-day figure and no first payment (ihealthy-cta.ts)
      ...PREMIUM.filter((s) => !["เบี้ยหลัก", "ตกวันละ", "ชำระครั้งแรก"].includes(s.name)),
    ],
    blocks: [{ name: "ความคุ้มครอง", starts: "- ", what: "รายการความคุ้มครอง: ค่าห้อง ค่ารักษา OPD ค่าชดเชยรายวัน หลายบรรทัด" }],
  },
};

export function lifeProtectSlots(f: LifeProtectQuoteFacts): Slots {
  const doubles = !f.death.alreadyPastAge;
  return {
    "ทุน": baht(f.sumAssured),
    "ทุนเพิ่มเป็น": doubles ? baht(f.death.sumBefore) : undefined,
    "อายุที่ทุนเพิ่ม": doubles ? String(f.death.beforeAge) : undefined,
    "เพศ": SEX_WORD[f.sex], "อายุ": ageWord(f.age), "ระยะจ่าย": f.termLabel,
    ...premiumSlots(f.modes[0], f.modes),
  };
}

export function easyProtectSlots(f: EasyProtectQuoteFacts): Slots {
  return {
    "ทุน": baht(f.sumAssured), "เพศ": SEX_WORD[f.sex], "อายุ": ageWord(f.age),
    "จำนวนปีที่จ่าย": String(f.years), "คุ้มครองถึงอายุ": String(f.coverToAge),
    "เบี้ยรวมทั้งหมด": formatBaht(f.total),
    "กี่เท่าของเบี้ย": f.leverage ? f.leverage.toFixed(1) : undefined,
    ...premiumSlots(f.modes[0], f.modes),
  };
}

export function lifeTreasureSlots(f: LifeTreasureQuoteFacts): Slots {
  return {
    "ทุน": baht(f.sumAssured), "เพศ": SEX_WORD[f.sex], "อายุ": ageWord(f.age), "ระยะจ่าย": f.termLabel,
    "จำนวนปีที่จ่าย": String(f.years), "คุ้มครองถึงอายุ": String(f.coverToAge),
    "เบี้ยรวมทั้งหมด": formatBaht(f.total),
    "กี่เท่าของเบี้ย": f.leverage ? f.leverage.toFixed(1) : undefined,
    ...premiumSlots(f.modes[0], f.modes),
  };
}

export function iShieldSlots(f: IShieldQuoteFacts): Slots {
  return {
    "ทุน": baht(f.sumAssured), "เพศ": SEX_WORD[f.sex], "อายุ": ageWord(f.age), "ระยะจ่าย": f.termLabel,
    "คุ้มครองถึงอายุ": String(f.maturityAge),
    "โรคระยะเริ่มต้นรับ": baht(f.illness.early), "โรคระยะรุนแรงรับ": baht(f.illness.major),
    "เงินคืนครบสัญญา": baht(f.sumAssured),
    ...premiumSlots(f.modes[0], f.modes),
  };
}

export function plbSlots(f: PlbQuoteFacts): Slots {
  return {
    "ทุน": baht(f.sumAssured), "เพศ": SEX_WORD[f.sex], "อายุ": String(f.age), "ระยะจ่าย": f.termLabel,
    "จำนวนปีที่คุ้มครอง": String(f.years), "คุ้มครองถึงอายุ": String(f.endsAtAge),
    "เบี้ยรวมทั้งหมด": formatBaht(f.total),
    ...premiumSlots(f.modes[0], f.modes),
  };
}

export function legacySlots(f: LegacyQuoteFacts): Slots {
  return {
    "ทุน": baht(f.millions * 1_000_000), "เพศ": SEX_WORD[f.sex], "อายุ": String(f.age),
    "โรคร้ายแรงรับ": baht(f.critical), "จำนวนโรค": String(f.diseaseCount),
    ...premiumSlots(displayPremium(f.modes, false), f.modes),
  };
}

export function cancerSlots(f: CancerQuoteFacts): Slots {
  return {
    "ทุนมะเร็ง": baht(f.cpr), "ชดเชยวันละ": baht(f.hic), "เพศ": SEX_WORD[f.sex], "อายุ": String(f.age),
    ...premiumSlots(displayPremium(f.modes, false), f.modes),
  };
}

export function ci123Slots(f: Ci123QuoteFacts): Slots {
  return {
    "ทุน": baht(f.sum), "เพศ": SEX_WORD[f.sex], "อายุ": String(f.age), "จำนวนโรค": String(f.diseaseCount),
    ...premiumSlots(displayPremium(f.modes, false), f.modes),
  };
}

export function pensionSlots(who: PensionWho, q: PensionQuote): Slots {
  const down = (n: number) => Math.floor(n).toLocaleString("en-US");
  return {
    "เพศ": SEX_WORD[who.sex], "อายุ": String(who.age),
    "บำนาญเดือนละ": baht(q.monthlyPension), "เริ่มรับบำนาญอายุ": String(q.bands[0].fromAge),
    "จำนวนปีที่จ่าย": String(q.payYears), "ทุน": baht(q.sumAssured),
    "เบี้ยปีละ": down(q.totalYearlyPaid), "เบี้ยรวมทั้งหมด": down(q.totalPremium),
    "รวมรับบำนาญ": baht(q.totalPension),
  };
}

export function gsavingSlots(age: number, q: GsQuote): Slots {
  const round = (n: number) => Math.round(n).toLocaleString("en-US");
  return {
    "อายุ": String(age),
    "เบี้ยปีละ": q.premium.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    "เบี้ยรวมทั้งหมด": round(GS_PREM_YEARS * q.premium), "ทุน": round(q.sa),
    "เงินการันตีรวม": round(q.guaranteed),
    "เงินคืนปีละ": round(q.scenarios[0].rows[0].payback), "เงินครบสัญญา": round(q.scenarios[0].maturity),
    "ลดหย่อนภาษีปีละ": round(Math.min(q.premium, GS_TAX_CAP)),
  };
}

export function iHealthySlots(f: IHealthyCtaFacts): Slots {
  if (!f.shown || !f.arrangement) return {};
  const modes: Mode[] = [{ mode: f.mode, total: f.shown.total, belowMinimum: f.shown.belowMinimum }, ...f.shown.others];
  const room = /^[\d,]+/.exec(f.benefits?.room ?? "")?.[0];
  const opd = f.benefits?.opd;
  // no headline, no per-day figure and no first payment: the health rider re-prices every year (ihealthy-cta.ts)
  const all = premiumSlots(modes[0], modes, false);
  return {
    "แผน": f.arrangement.planName, "วงเงินต่อปี": baht(f.arrangement.annualMax),
    "ค่าห้องต่อวัน": room, "OPD ต่อปี": opd && /^[\d,]+$/.test(opd) ? opd : undefined,
    "เพศ": SEX_WORD[f.sex], "อายุ": String(f.age),
    "เบี้ยรายเดือน": all["เบี้ยรายเดือน"], "เบี้ยราย 6 เดือน": all["เบี้ยราย 6 เดือน"], "เบี้ยรายปี": all["เบี้ยรายปี"],
  };
}
