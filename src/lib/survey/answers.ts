/**
 * สำรวจความคุ้มครอง (owner, 2026-10-22, mockup SWVNeW6CQii59D6nhzUWpx): a short survey an agent
 * runs with someone who already holds a policy, in five parts, ending in a meeting and a
 * "สรุปก่อนนัด". These are its answers, their labels, and the one check the server makes of what
 * the browser sends. Nothing here prices anything: the summary points at a calculator.
 */

export const COMPANIES = ["กรุงไทย-แอกซ่า", "AIA", "เมืองไทยประกันชีวิต", "ไทยประกันชีวิต", "FWD", "อื่น ๆ"] as const;
export type Company = (typeof COMPANIES)[number];

export const TIE_LABEL = { family: "ญาติ", friend: "เพื่อน", referred: "มีคนแนะนำมา", stranger: "ไม่รู้จักมาก่อน" } as const;
export const REASON_LABEL = {
  health: "ห่วงค่ารักษา", retire: "เงินใช้ยามเกษียณ", education: "ทุนการศึกษาลูก",
  family: "ดูแลครอบครัว", tax: "ลดหย่อนภาษี", favor: "ช่วยคนรู้จัก",
} as const;
export const HOUSEHOLD_LABEL = { all: "ครบทุกคน", some: "บางคน", self: "แค่ตัวเอง" } as const;
export const CARE_LABEL = { good: "ดูแลดี", rare: "นาน ๆ ที", gone: "ติดต่อไม่ได้" } as const;
export const HELP_LABEL = { address: "เปลี่ยนที่อยู่", payment: "ช่องทางจ่ายเบี้ย", claim: "ช่วยทำเคลม", summary: "สรุปกรมธรรม์ให้" } as const;
export const WORRY_LABEL = {
  health: "ค่ารักษาพยาบาล", retire: "เงินใช้ยามเกษียณ", education: "ทุนการศึกษาลูก", income: "รายได้ของครอบครัว",
} as const;
/** the reason read to the customer under each worry, in the agency's own words */
export const WORRY_WHY: Record<WorryKey, string> = {
  health: "ค่าห้องและค่าผ่าตัดโรงพยาบาลเอกชนขึ้นทุกปี ป่วยหนักครั้งเดียวอาจใช้เงินเก็บไปหลายปี",
  retire: "พอหยุดทำงาน รายได้ก็หยุด แต่ค่ากินค่าอยู่ยังเดินต่อทุกเดือน",
  education: "ค่าเรียนของลูกควรมีครบจนจบ ไม่ว่าวันนั้นเราจะยังอยู่ดูแลหรือไม่",
  income: "ถ้าเราเป็นคนหารายได้หลัก ครอบครัวควรใช้ชีวิตแบบเดิมต่อได้ แม้วันหนึ่งไม่มีเรา",
};
export const BUDGETS = [1000, 2000, 3000, 5000] as const;
export const DECIDER_LABEL = { self: "ตัดสินใจเอง", spouse: "คู่สมรส", parents: "พ่อแม่", other: "คนอื่น ๆ" } as const;
export const PLACE_LABEL = { home: "บ้าน", work: "ที่ทำงาน", cafe: "ร้านกาแฟ", video: "วิดีโอคอล" } as const;

export type Tie = keyof typeof TIE_LABEL;
export type Reason = keyof typeof REASON_LABEL;
export type Household = keyof typeof HOUSEHOLD_LABEL;
export type Care = keyof typeof CARE_LABEL;
export type Help = keyof typeof HELP_LABEL;
export type WorryKey = keyof typeof WORRY_LABEL;
export type Decider = keyof typeof DECIDER_LABEL;
export type Place = keyof typeof PLACE_LABEL;
/** a monthly figure, "more" than the largest chip, or "unsure" */
export type Budget = (typeof BUDGETS)[number] | "more" | "unsure";

export const WORRIES: WorryKey[] = ["health", "retire", "education", "income"];

export interface SurveyAnswers {
  /** empty when the customer has no policy: parts 1's other questions and part 2 are skipped */
  companies: Company[];
  tie: Tie | null;
  reasons: Reason[];
  household: Household | null;
  years: number | null;
  care: Care | null;
  help: Help[];
  planned: boolean | null;
  /** the one worried about most */
  top: WorryKey | null;
  /** worried about too, never including `top` */
  also: WorryKey[];
  kids: number | null;
  eldest: number | null;
  budget: Budget | null;
  decider: Decider | null;
  place: Place | null;
  /** yyyy-mm-dd, Bangkok */
  date: string;
  /** HH:MM */
  time: string;
  name: string;
  phone: string;
  /** yyyy-mm-dd (Gregorian) */
  birth: string;
  sex: "M" | "F";
  address: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Today in Bangkok as yyyy-mm-dd. */
export function bangkokToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** Age in whole years on `today` (both yyyy-mm-dd), or null for a date that is not a real past day. */
export function ageOn(birth: string, today: string): number | null {
  if (!ISO_DAY.test(birth) || !ISO_DAY.test(today)) return null;
  const [y, m, d] = birth.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
  if (birth > today) return null;
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** The day `n` days after yyyy-mm-dd, as yyyy-mm-dd. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const THAI_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const THAI_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "อา. 25 ต.ค." */
export function thaiDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${THAI_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${THAI_MONTH[m - 1]}`;
}

export const isWeekend = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 || w === 6;
};

/** The next four days of the kind asked for, from tomorrow. */
export function nextDays(today: string, weekend: boolean, count = 4): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < count && i < 30; i++) {
    const day = addDays(today, i);
    if (isWeekend(day) === weekend) out.push(day);
  }
  return out;
}

/** a meeting may be set up to this far ahead */
export const MEET_AHEAD_DAYS = 60;

export const yearlyOf = (b: Budget | null) => (typeof b === "number" ? b * 12 : 0);
export const budgetWord = (b: Budget | null) =>
  b === null ? "" : b === "more" ? "มากกว่า 5,000 บาท/เดือน" : b === "unsure" ? "ยังไม่แน่ใจ" : `${b.toLocaleString("en-US")} บาท/เดือน (ปีละ ${yearlyOf(b).toLocaleString("en-US")})`;

const pick = <T extends string>(v: unknown, keys: readonly T[]): T | null => (keys.includes(v as T) ? (v as T) : null);
const picks = <T extends string>(v: unknown, keys: readonly T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => keys.includes(x as T)))] : [];
const whole = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * The answers made safe, or the sentence to show when they cannot be saved. Consent is checked
 * by the caller with the details, as the FHC save does. `today` is Bangkok's.
 */
export function cleanSurvey(raw: unknown, today: string): SurveyAnswers | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const companies = picks(r.companies, COMPANIES);
  const holds = companies.length > 0;
  const top = pick(r.top, WORRIES);
  const also = picks(r.also, WORRIES).filter((k) => k !== top);
  const budget: Budget | null = r.budget === "more" || r.budget === "unsure"
    ? r.budget
    : BUDGETS.includes(r.budget as (typeof BUDGETS)[number]) ? (r.budget as Budget) : null;
  const education = top === "education" || also.includes("education");

  const name = text(r.name, 100);
  if (!name) return "ใส่ชื่อลูกค้าก่อนนะครับ";
  const phone = text(r.phone, 30);
  if (!/\d{9,}/.test(phone.replace(/\D/g, ""))) return "ใส่เบอร์โทรลูกค้าให้ครบก่อนนะครับ";
  const birth = typeof r.birth === "string" ? r.birth : "";
  const age = ageOn(birth, today);
  if (age === null || age > 100) return "ใส่วันเกิดลูกค้าให้ถูกต้องก่อนนะครับ";
  const sex = r.sex === "F" ? "F" : r.sex === "M" ? "M" : null;
  if (!sex) return "เลือกเพศของลูกค้าก่อนนะครับ";
  const date = typeof r.date === "string" && ISO_DAY.test(r.date) ? r.date : "";
  if (!date || date <= today || date > addDays(today, MEET_AHEAD_DAYS)) return "เลือกวันนัดก่อนนะครับ";
  const time = typeof r.time === "string" && TIME.test(r.time) ? r.time : "";
  if (!time) return "เลือกเวลานัดก่อนนะครับ";

  return {
    companies,
    tie: holds ? pick(r.tie, Object.keys(TIE_LABEL) as Tie[]) : null,
    reasons: holds ? picks(r.reasons, Object.keys(REASON_LABEL) as Reason[]) : [],
    household: holds ? pick(r.household, Object.keys(HOUSEHOLD_LABEL) as Household[]) : null,
    years: holds ? whole(r.years, 80) : null,
    care: holds ? pick(r.care, Object.keys(CARE_LABEL) as Care[]) : null,
    help: holds ? picks(r.help, Object.keys(HELP_LABEL) as Help[]) : [],
    planned: typeof r.planned === "boolean" ? r.planned : null,
    top, also,
    kids: education ? whole(r.kids, 10) : null,
    eldest: education ? whole(r.eldest, 30) : null,
    budget,
    decider: pick(r.decider, Object.keys(DECIDER_LABEL) as Decider[]),
    place: pick(r.place, Object.keys(PLACE_LABEL) as Place[]),
    date, time, name, phone, birth, sex,
    address: text(r.address, 200),
  };
}

/** A saved survey read back: anything that no longer passes is treated as missing. */
export function isSurvey(v: unknown): v is SurveyAnswers {
  const r = v as SurveyAnswers | null;
  return !!r && typeof r === "object" && typeof r.name === "string" && typeof r.date === "string" && Array.isArray(r.companies);
}
