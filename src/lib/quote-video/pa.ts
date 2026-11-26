import {
  PA_CLASSES, PA_FAMILIES, PA_RENEWAL_MAX, PA_RENEWAL_STEP, PA_WEEKLY_MAX_WEEKS, paPerDay, paPremium,
  type PaFamily, type PaFamilyId, type PaPlan,
} from "@/lib/pa-plans";
import type { CoverRow, QuoteVideoFacts, VideoInput } from "./script";

/**
 * PA in วิดีโอนำเสนอ (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "pa"): the thirteenth
 * plan, the /pa page's Personal Accident plans — a family (Classic, Platinum, Max), one of its plans, an occupation
 * class. The first plan priced by plan alone: the premium is the plan's and the class's, whatever the age or sex
 * (pa-plans.ts), so the input carries neither and the clip says neither (script.ts `sex`, absent; pricedByPlan).
 * Every figure is the page's own table (src/lib/pa-plans.ts), read as PACalculator.tsx reads it.
 *
 * Its scenes: what it covers (scene key "cover"), the injury cover and the weeks off work (key "family"; Classic has
 * the medical row only, Max neither, so Max has no such scene), the sum growing on renewal as stairs (key "critical").
 */

export type PaVideoInput = Extract<VideoInput, { product: "PA" }>;
/** the plan as the Studio names it: the menu's "PA", the LINE menu's and the mockup's "อุบัติเหตุ" */
export const PA_NAME = "PA อุบัติเหตุ";

export interface PaVideoFacts {
  family: PaFamilyId;
  /** "PA Platinum" */
  familyName: string;
  /** the brochure's name, "Platinum 02", and the company's code, "PAP02" */
  plan: string;
  code: string;
  cls: number;
  /** the yearly premium, and whole baht a day as the page rounds it */
  annual: number;
  perDay: number;
  death: number;
  murder: number;
  motorcycle: number;
  /** none on PA Max */
  medical?: number;
  /** PA Platinum only, a week, for at most `weeks` */
  weekly?: number;
  weeks: number;
  /** the death sum each policy year, 1 to 6: 5% of the starting sum more a renewal, 25% at most */
  years: { year: number; sum: number }[];
  /** 5 and 25, as the screen says them */
  stepPercent: number;
  maxPercent: number;
  /** the ages the family is bought at */
  ages: { min: number; max: number };
}

const money = (n: number) => n.toLocaleString("en-US");

/** a plan by its company code, with its family; undefined for any code the page does not sell */
export function paPlanOf(code: string): { family: PaFamily; plan: PaPlan } | undefined {
  for (const family of PA_FAMILIES) {
    const plan = family.plans.find((p) => p.code === code);
    if (plan) return { family, plan };
  }
  return undefined;
}

/** the classes a plan takes, "1, 2" */
export const paClassesTaken = (plan: PaPlan): number[] => PA_CLASSES.filter((c) => paPremium(plan, c) !== null);

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedPa(v: PaVideoInput): PaVideoInput | string {
  const found = typeof v.plan === "string" ? paPlanOf(v.plan) : undefined;
  if (!found) return "เลือกแผน PA";
  if (!Number.isInteger(v.cls) || paPremium(found.plan, v.cls) === null) {
    return `${found.plan.name} รับขั้นอาชีพ ${paClassesTaken(found.plan).join(", ")} · ขั้น 4 ไม่รับทุกแบบ`;
  }
  return { product: "PA", plan: found.plan.code, cls: v.cls };
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function paVideoFacts(v: PaVideoInput): QuoteVideoFacts | undefined {
  const ok = checkedPa(v);
  if (typeof ok === "string") return undefined;
  const { family, plan } = paPlanOf(ok.plan)!;
  const annual = paPremium(plan, ok.cls);
  if (annual === null) return undefined;
  const perDay = paPerDay(annual);
  const renewals = Math.round(PA_RENEWAL_MAX / PA_RENEWAL_STEP);
  const years = Array.from({ length: renewals + 1 }, (_, i) => ({ year: i + 1, sum: Math.round(plan.death * (1 + PA_RENEWAL_STEP * i)) }));
  const g: PaVideoFacts = {
    family: family.id, familyName: family.name, plan: plan.name, code: plan.code, cls: ok.cls, annual, perDay,
    death: plan.death, murder: plan.murder, motorcycle: plan.motorcycle,
    ...(plan.medical ? { medical: plan.medical } : {}), ...(plan.weekly ? { weekly: plan.weekly } : {}), weeks: PA_WEEKLY_MAX_WEEKS,
    years, stepPercent: Math.round(PA_RENEWAL_STEP * 100), maxPercent: Math.round(PA_RENEWAL_MAX * 100),
    ages: { min: family.ageMin, max: family.ageMax },
  };
  // the page's rows in the clip's words: no "เสียชีวิต" on the screen either
  const cover: CoverRow[] = [
    { label: "จากไป สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง", amount: money(plan.death), mark: true },
    { label: "ถูกฆาตกรรม ลอบทำร้าย", amount: money(plan.murder), mark: false },
    { label: "ขับขี่ โดยสารมอเตอร์ไซค์", amount: money(plan.motorcycle), mark: false },
    ...(plan.medical ? [{ label: "ค่ารักษาต่ออุบัติเหตุ", amount: money(plan.medical), mark: false }] : []),
    ...(plan.weekly ? [{ label: `ชดเชยหยุดงาน ต่อสัปดาห์ (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`, amount: money(plan.weekly), mark: false }] : []),
  ];
  const price = money(annual);
  return {
    product: "PA",
    planLine: `PA ${plan.name}`,
    // where the others name the insured, the class the price is by (owner, 2026-11-26): no age, no sex
    insuredWho: `อาชีพชั้น ${ok.cls}`,
    insuredLine: `คุ้มครองอุบัติเหตุ ${money(plan.death)}`,
    // the youngest the plan takes: never shown or said (script.ts pricedByPlan)
    age: family.ageMin,
    lead: { label: "คุ้มครองอุบัติเหตุ", amount: money(plan.death), baht: plan.death },
    leadMark: "สัญญาปีต่อปี ต่ออายุทุกปี",
    leadPill: `อาชีพชั้น ${ok.cls}`,
    contactLine: "เดินทางทุกวัน มีไว้อุ่นใจ",
    priceMark: `ตกวันละ ${perDay} บาท`,
    priceBig: { label: "จ่ายปีละ", amount: price, unit: "บาท" },
    perDayAmount: String(perDay),
    priceTitle: "ค่าใช้จ่ายต่อปี",
    prices: [{ label: "รายปี", amount: price, main: true }],
    spokenPrice: { per: "ปีละ", amount: price },
    pills: [`ตกวันละ ${perDay} บาท`, "ราคาเท่ากันทุกอายุ"],
    priceNotes: [`ราคาตามแผนและอาชีพชั้น ${ok.cls} ไม่ขึ้นกับอายุหรือเพศ`],
    coverTitle: "คุ้มครองอะไรบ้าง",
    cover,
    coverStyle: "rows",
    coverNote: "คุ้มครอง 24 ชั่วโมง ทั่วโลก",
    // a one-year contract: the oldest age the plan is bought at, never said as an age it covers to
    coverToAge: family.ageMax,
    footNote: "สัญญา 1 ปี ต่ออายุปีต่อปี · ราคาตามแผนและขั้นอาชีพ ไม่ขึ้นกับอายุหรือเพศ",
    pa: g,
  };
}

/** "PA Platinum 02 ทุน 2 ล้านบาท": the plan as the voice names it */
const planSaid = (g: PaVideoFacts) => `PA ${g.plan}`;
/** the year-6 sum, the top of the stairs */
export const paSixth = (g: PaVideoFacts): number => g.years[g.years.length - 1].sum;

/** "อุบัติเหตุไม่เลือกวัน PA Platinum 02 คุ้มครองอุบัติเหตุ ทุน 2 ล้านบาท ต่ออายุทุกปีค่ะ" */
export const paLeadLine = (g: PaVideoFacts, said: (baht: number) => string): string =>
  `อุบัติเหตุไม่เลือกวัน ${planSaid(g)} คุ้มครองอุบัติเหตุ ทุน ${said(g.death)} ต่ออายุทุกปีค่ะ`;

/** "สำหรับอาชีพชั้น 1 จ่ายปีละ 8,000 บาท ตกวันละ 22 บาท ราคาเดียวกันทุกช่วงอายุค่ะ" */
export function paPriceLine(f: QuoteVideoFacts, g: PaVideoFacts): string {
  const yearly = f.prices.find((r) => r.label === "รายปี")?.amount ?? money(g.annual);
  return `สำหรับอาชีพชั้น ${g.cls} จ่ายปีละ ${yearly} บาท ตกวันละ ${g.perDay} บาท ราคาเดียวกันทุกช่วงอายุค่ะ`;
}

/** what it covers, said plainly and calmly (owner, 2026-11-26): an attack is "ถูกทำร้ายร่างกาย" */
export const paCoverLine = (g: PaVideoFacts, said: (baht: number) => string): string =>
  `ถ้าอุบัติเหตุทำให้จากไป สูญเสียอวัยวะ หรือทุพพลภาพถาวร รับ ${said(g.death)} กรณีถูกทำร้ายร่างกาย รับ ${said(g.murder)} ขับขี่หรือโดยสารมอเตอร์ไซค์ก็คุ้มครอง ${said(g.motorcycle)}ค่ะ`;

/** the injury cover: the medical sum, and the weekly sum where the plan has one; undefined on PA Max */
export function paInjuryLine(g: PaVideoFacts): string | undefined {
  if (!g.medical) return undefined;
  const care = `บาดเจ็บจากอุบัติเหตุ รับค่ารักษาครั้งละ ${money(g.medical)} บาท`;
  return g.weekly
    ? `${care} ถ้าต้องหยุดงานเพราะทุพพลภาพชั่วคราว รับสัปดาห์ละ ${money(g.weekly)} บาท สูงสุด ${g.weeks} สัปดาห์ค่ะ`
    : `${care} รวมอุบัติเหตุจากมอเตอร์ไซค์ด้วยค่ะ`;
}

/** "ต่ออายุต่อเนื่อง ทุนเพิ่มปีละ 5% ของทุนเริ่มต้น ปีที่ 6 ทุนเป็น 2.5 ล้านบาทค่ะ" */
export const paRenewLine = (g: PaVideoFacts, said: (baht: number) => string): string =>
  `ต่ออายุต่อเนื่อง ทุนเพิ่มปีละ ${g.stepPercent}% ของทุนเริ่มต้น ปีที่ ${g.years.length} ทุนเป็น ${said(paSixth(g))}ค่ะ`;

