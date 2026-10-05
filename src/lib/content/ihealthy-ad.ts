import { iHealthyFacts, isHeading, type BenefitRow } from "@/lib/ihealthy-facts";
import type { Lang } from "./output";

/**
 * iHealthy Ultra's ad emphasis (owner, 2026-10-06): an iHealthy ad puts its weight on what the
 * yearly lump-sum limit pays for — cancer treatment, major surgery and ICU, a stay at a private
 * hospital, kidney dialysis — and not on the pay or cover period. The categories and their
 * per-plan amounts are read from the company's benefit sheet (data/riders/ihealthy-ultra.json),
 * never typed here: a category the headline's plan pays nothing for is left out, and the
 * outpatient extras appear only on the plans that have them. Only the words around them are ours.
 *
 * Heart surgery may be an example (owner, 2026-10-06, lifting the earlier ban). No hospital names —
 * "โรงพยาบาลเอกชนชั้นนำ" / "leading private hospitals" only (owner, 2026-10-06). The special
 * waiting period for tumours and cancer goes in the cautions, so no ad says cancer is covered
 * from day one.
 */

/** the plans of the ad's premium table, in its rows' order (numbers-cases/ihealthy.ts ladder) */
export const IHEALTHY_RUNGS = ["SMART", "BRONZE", "SILVER", "GOLD"] as const;

/** a cell that pays nothing, in the company's words */
const NOTHING = new Set(["-", "ไม่คุ้มครอง", ""]);

/** the categories an ad leans on, then the outpatient extras, each with its words */
interface Category {
  no: number;
  th: (value: string) => string;
  en: (value: string) => string;
}

/** "9,000 ต่อวัน" → 9,000; "12000" → 12,000; "ตามที่จ่ายจริง" → null */
function amount(value: string): string | null {
  const m = /^([\d,]+)(?:\s*ต่อวัน)?$/.exec(value.trim());
  return m ? Number(m[1].replace(/,/g, "")).toLocaleString("en-US") : null;
}

const asCharged = (value: string) => amount(value) === null;

const CORE: Category[] = [
  {
    no: 11,
    th: () => "รักษามะเร็งด้วยเคมีบำบัด จ่ายตามจริง",
    en: () => "Cancer treatment by chemotherapy: paid as charged",
  },
  {
    no: 10,
    th: () => "รักษาเนื้องอกหรือมะเร็งด้วยรังสีรักษา จ่ายตามจริง",
    en: () => "Tumour or cancer treatment by radiotherapy: paid as charged",
  },
  {
    no: 4,
    th: () => "การผ่าตัดใหญ่และหัตถการ ค่าห้องผ่าตัด ค่าแพทย์ผ่าตัดและวิสัญญีแพทย์ จ่ายตามจริง",
    en: () => "Major surgery and procedures — operating room, surgeon and anaesthetist fees: paid as charged",
  },
  {
    no: 1,
    th: (v) => (asCharged(v)
      ? "ค่าห้องและค่าอาหารผู้ป่วยในโรงพยาบาลเอกชนชั้นนำ จ่ายตามจริง (รวมห้อง ICU)"
      : `ค่าห้องและค่าอาหาร วันละ ${amount(v)} บาท (ผู้ป่วยในโรงพยาบาลเอกชนชั้นนำ) · ห้อง ICU จ่ายตามจริง`),
    en: (v) => (asCharged(v)
      ? "Inpatient room and board at leading private hospitals: paid as charged (ICU included)"
      : `Inpatient room and board at leading private hospitals: up to ${amount(v)} THB a day · intensive care (ICU) paid as charged`),
  },
  {
    no: 9,
    th: () => "ล้างไตผ่านทางเส้นเลือดสำหรับโรคไตวายเรื้อรัง จ่ายตามจริง",
    en: () => "Kidney dialysis for chronic kidney failure: paid as charged",
  },
];

/** the extras on the higher plans: outpatient visits, physiotherapy, dental care, a check-up, vaccines */
const EXTRAS: Category[] = [
  {
    no: 18,
    th: (v) => (asCharged(v) ? "ค่ารักษาผู้ป่วยนอก (ปรึกษาแพทย์และยา) จ่ายตามจริง" : `ค่ารักษาผู้ป่วยนอก (ปรึกษาแพทย์และยา) วงเงินปีละ ${amount(v)} บาท`),
    en: (v) => (asCharged(v) ? "Outpatient doctor visits and medicine: paid as charged" : `Outpatient doctor visits and medicine: covered up to ${amount(v)} THB a year`),
  },
  {
    no: 19,
    th: (v) => (asCharged(v) ? "ค่ากายภาพบำบัดผู้ป่วยนอก จ่ายตามจริง" : `ค่ากายภาพบำบัดผู้ป่วยนอก วงเงินปีละ ${amount(v)} บาท`),
    en: (v) => (asCharged(v) ? "Outpatient physiotherapy: paid as charged" : `Outpatient physiotherapy: covered up to ${amount(v)} THB a year`),
  },
  {
    no: 22,
    th: (v) => (asCharged(v) ? "ค่ารักษาทางทันตกรรม จ่ายตามจริง" : `ค่ารักษาทางทันตกรรม วงเงินปีละ ${amount(v)} บาท`),
    en: (v) => (asCharged(v) ? "Dental care: paid as charged" : `Dental care: covered up to ${amount(v)} THB a year`),
  },
  {
    no: 26,
    th: (v) => (asCharged(v) ? "ค่าตรวจสุขภาพประจำปี จ่ายตามจริง" : `ค่าตรวจสุขภาพประจำปี วงเงินปีละ ${amount(v)} บาท`),
    en: (v) => (asCharged(v) ? "Annual health check-up: paid as charged" : `Annual health check-up: covered up to ${amount(v)} THB a year`),
  },
  {
    no: 27,
    th: (v) => (asCharged(v) ? "ค่าฉีดวัคซีน จ่ายตามจริง" : `ค่าฉีดวัคซีน วงเงินปีละ ${amount(v)} บาท`),
    en: (v) => (asCharged(v) ? "Vaccinations: paid as charged" : `Vaccinations: covered up to ${amount(v)} THB a year`),
  },
];

/** "หมวดย่อยที่ 4.2 …" belongs to category 4; a numbered row to its own */
function categoryOf(row: BenefitRow): number | null {
  if (row.no !== null) return row.no;
  const m = /^หมวดย่อยที่ (\d+)\./.exec(row.title);
  return m ? Number(m[1]) : null;
}

/**
 * What the plan pays in a category, as the sheet says it for an adult: the first cell of its rows
 * that pays something (a category with sub-rows pays when any of them does), or null for nothing.
 */
export function categoryValue(no: number, plan: string): string | null {
  for (const entry of iHealthyFacts().rows) {
    if (isHeading(entry) || categoryOf(entry) !== no) continue;
    const v = (entry.adult[plan] ?? "").trim();
    if (!NOTHING.has(v)) return v;
  }
  return null;
}

/** the categories the plan pays for, in the ad's order: the core ones, then its extras */
export function adCategories(plan: string): number[] {
  return [...CORE, ...EXTRAS].filter((c) => categoryValue(c.no, plan) !== null).map((c) => c.no);
}

/** the plan as the ad's brief names it: "GOLD" → "Gold" */
const planName = (code: string) => code.charAt(0) + code.slice(1).toLowerCase();

/**
 * The iHealthy block of an ad's brief for the headline's plan, in the brief's language: what the
 * yearly limit pays for (the plan's own categories and amounts), what to stress and what not to
 * say. Empty for a plan the sheet does not have.
 */
export function iHealthyAdFacts(plan: string, lang: Lang = "th"): string[] {
  const sheetPlan = iHealthyFacts().plans.find((p) => p.code === plan);
  if (!sheetPlan) return [];
  const en = lang === "en";
  const said = (list: Category[]) => list.flatMap((c) => {
    const v = categoryValue(c.no, plan);
    return v === null ? [] : [`- ${en ? c.en(v) : c.th(v)}`];
  });
  const core = said(CORE);
  const extras = said(EXTRAS);
  const limit = sheetPlan.annualMax.toLocaleString("en-US");
  if (en) {
    return [
      "",
      `### What the yearly limit pays for — plan ${planName(plan)} (${limit} THB a year)`,
      "Put the ad's weight here — on what the lump-sum yearly limit pays for — not on the pay period or the cover period.",
      ...core,
      ...(extras.length ? ["Extras on this plan:", ...extras] : []),
      "Say \"leading private hospitals\" only: never name a hospital.",
    ];
  }
  return [
    "",
    `### วงเงินเหมาจ่ายต่อปีจ่ายอะไรบ้าง — แผน ${planName(plan)} (วงเงินปีละ ${limit} บาท)`,
    "ให้น้ำหนักของแอดอยู่ที่สิ่งที่วงเงินเหมาจ่ายต่อปีจ่ายให้ ไม่ใช่ระยะเวลาจ่ายเบี้ยหรือระยะเวลาคุ้มครอง",
    ...core,
    ...(extras.length ? ["ผลประโยชน์เสริมของแผนนี้:", ...extras] : []),
    "พูดว่า \"โรงพยาบาลเอกชนชั้นนำ\" เท่านั้น ห้ามระบุชื่อโรงพยาบาล",
  ];
}

/** the special waiting period for tumours and cancer, as a caution line (without its bullet) */
export function iHealthyAdCaution(lang: Lang = "th"): string {
  const days = iHealthyFacts().terms.specialWaitingDays;
  return lang === "en"
    ? `Tumours, cysts and cancer have a special waiting period of ${days} days from the start of cover — never say cancer is covered from day one`
    : `เนื้องอก ถุงน้ำ และมะเร็งทุกชนิด มีระยะเวลารอคอยพิเศษ ${days} วันนับจากวันเริ่มคุ้มครอง — ห้ามเขียนว่าคุ้มครองมะเร็งตั้งแต่วันแรก`;
}
