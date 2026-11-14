/**
 * Krungthai-AXA's Personal Accident (PA) plans, from the company's brochure (TH and ENG,
 * 3 pages each, sent by the owner 2026-11-14). Mockup https://claude.ai/artifact/6RyRCubLaap2YinJGpnzcm,
 * owner answered ก ก ก: its own menu heading, the agent picks the occupation class 1–3, and
 * the first round is the page, the all-plans table and the copied text.
 *
 * A one-year contract renewed year by year; the premium is fixed by plan and occupation class,
 * not by age or sex. Age only decides whether the plan can be bought at all.
 */

export type PaFamilyId = "classic" | "platinum" | "max";

export interface PaPlan {
  /** the plan's name as the brochure prints it, "Platinum 02" */
  name: string;
  /** the company's plan code, "PAP02" */
  code: string;
  /** เสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง จากอุบัติเหตุ */
  death: number;
  /** การฆาตกรรมหรือลอบทำร้าย */
  murder: number;
  /** การขับขี่หรือโดยสารรถจักรยานยนต์ */
  motorcycle: number;
  /** ค่ารักษาพยาบาลต่ออุบัติเหตุ; PA Max has none */
  medical?: number;
  /** ค่าชดเชยทุพพลภาพชั่วคราวสิ้นเชิง ต่อสัปดาห์; PA Platinum only */
  weekly?: number;
  /** yearly premium by occupation class 1, 2, 3, 4; null where the class is not accepted */
  premiums: (number | null)[];
}

export interface PaFamily {
  id: PaFamilyId;
  name: string;
  /** the brochure's one line under the family's name */
  tagline: string;
  ageMin: number;
  ageMax: number;
  plans: PaPlan[];
}

/** at most 52 weeks of the weekly sum (PA Platinum) */
export const PA_WEEKLY_MAX_WEEKS = 52;
/** the sum assured grows 5% of the starting sum a renewal year, policy years 2–6, 25% at most */
export const PA_RENEWAL_STEP = 0.05;
export const PA_RENEWAL_MAX = 0.25;
/** occupation classes on the brochure; class 4 is accepted by no plan */
export const PA_CLASSES = [1, 2, 3, 4] as const;

const max = (n: number): PaPlan => {
  const two = String(n).padStart(2, "0");
  return {
    name: `Max ${two}`, code: `PAM${two}`, death: n * 1_000_000,
    murder: n === 1 ? 500_000 : 1_000_000, motorcycle: n === 1 ? 500_000 : 1_000_000,
    premiums: [2_250 * n, 2_250 * n, null, null],
  };
};

export const PA_FAMILIES: PaFamily[] = [
  {
    id: "classic", name: "PA Classic", tagline: "คุ้มครองครบครันเรื่องอุบัติเหตุ", ageMin: 0, ageMax: 64,
    plans: [
      { name: "Classic A", code: "PAC04", death: 700_000, murder: 700_000, motorcycle: 350_000, medical: 80_000, premiums: [3_500, 4_300, 5_150, null] },
      { name: "Classic B", code: "PAC05", death: 1_000_000, murder: 1_000_000, motorcycle: 500_000, medical: 100_000, premiums: [4_500, 5_500, null, null] },
    ],
  },
  {
    id: "platinum", name: "PA Platinum", tagline: "เพิ่มค่าชดเชยรายสัปดาห์", ageMin: 16, ageMax: 64,
    plans: [
      { name: "Platinum 01", code: "PAP01", death: 1_000_000, murder: 750_000, motorcycle: 750_000, medical: 100_000, weekly: 1_000, premiums: [4_800, 6_000, null, null] },
      { name: "Platinum 02", code: "PAP02", death: 2_000_000, murder: 1_000_000, motorcycle: 1_000_000, medical: 120_000, weekly: 2_000, premiums: [8_000, 9_600, null, null] },
      { name: "Platinum 03", code: "PAP03", death: 3_000_000, murder: 1_000_000, motorcycle: 1_000_000, medical: 150_000, weekly: 3_000, premiums: [11_500, 13_500, null, null] },
      { name: "Platinum 04", code: "PAP04", death: 5_000_000, murder: 1_000_000, motorcycle: 1_000_000, medical: 200_000, weekly: 5_000, premiums: [17_500, 20_000, null, null] },
      { name: "Platinum 05", code: "PAP05", death: 10_000_000, murder: 1_000_000, motorcycle: 1_000_000, medical: 300_000, weekly: 10_000, premiums: [32_000, 38_500, null, null] },
    ],
  },
  {
    id: "max", name: "PA Max", tagline: "ทุนชีวิตสูงสุด ไม่มีค่ารักษาพยาบาล", ageMin: 16, ageMax: 64,
    plans: Array.from({ length: 10 }, (_, i) => max(i + 1)),
  },
];

export function paFamily(id: PaFamilyId): PaFamily {
  return PA_FAMILIES.find((f) => f.id === id)!;
}

/** the yearly premium for an occupation class (1–4), or null where the plan does not take it */
export function paPremium(plan: PaPlan, cls: number): number | null {
  return plan.premiums[cls - 1] ?? null;
}

/** the classes a family takes in at least one plan, for the picker */
export function paClassesOf(family: PaFamily): number[] {
  return PA_CLASSES.filter((c) => family.plans.some((p) => paPremium(p, c) !== null));
}

/** the death sum in the sixth policy year, after five renewals of +5% */
export function paSumAfterRenewals(plan: PaPlan): number {
  return Math.round(plan.death * (1 + PA_RENEWAL_MAX));
}

export interface PaRow {
  key: "death" | "murder" | "motorcycle" | "medical" | "weekly";
  label: string;
  amount: number;
}

/** the plan's cover in the brochure's order, leaving out what the plan does not have */
export function paRows(plan: PaPlan): PaRow[] {
  const rows: PaRow[] = [
    { key: "death", label: "เสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง จากอุบัติเหตุ", amount: plan.death },
    { key: "murder", label: "ถูกฆาตกรรมหรือลอบทำร้าย", amount: plan.murder },
    { key: "motorcycle", label: "ขับขี่หรือโดยสารรถจักรยานยนต์", amount: plan.motorcycle },
  ];
  if (plan.medical) rows.push({ key: "medical", label: "ค่ารักษาพยาบาลต่ออุบัติเหตุ (รวมรถจักรยานยนต์)", amount: plan.medical });
  if (plan.weekly) rows.push({ key: "weekly", label: `ชดเชยทุพพลภาพชั่วคราวสิ้นเชิง ต่อสัปดาห์ (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`, amount: plan.weekly });
  return rows;
}

/** whole baht a day, rounded up as every other page does */
export function paPerDay(premium: number): number {
  return Math.ceil(premium / 365);
}

export interface PaQuoteFacts {
  family: PaFamily;
  plan: PaPlan;
  cls: number;
  age: number;
}

const baht = (n: number) => n.toLocaleString("en-US");

/** The quote as the agent pastes it into a chat, in the page's order. */
export function paQuoteText(f: PaQuoteFacts): string | undefined {
  const premium = paPremium(f.plan, f.cls);
  if (premium === null || f.age < f.family.ageMin || f.age > f.family.ageMax) return undefined;
  const p = f.plan;
  return [
    `🛡️ ประกันอุบัติเหตุ ${f.family.name} แผน ${p.name}`,
    `อายุ ${f.age} · ขั้นอาชีพ ${f.cls}`,
    `💰 เบี้ย ${baht(premium)} บาท/ปี (ตกวันละ ${baht(paPerDay(premium))} บาท)`,
    "",
    "✅ ความคุ้มครอง",
    `- อุบัติเหตุเสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวร ${baht(p.death)} บาท`,
    `- ถูกฆาตกรรมหรือลอบทำร้าย ${baht(p.murder)} บาท`,
    `- ขับขี่หรือโดยสารมอเตอร์ไซค์ ${baht(p.motorcycle)} บาท`,
    ...(p.medical ? [`- ค่ารักษาพยาบาลต่ออุบัติเหตุ ${baht(p.medical)} บาท`] : []),
    ...(p.weekly ? [`- ชดเชยทุพพลภาพชั่วคราว สัปดาห์ละ ${baht(p.weekly)} บาท (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`] : []),
    `- ต่ออายุปีที่ 2–6 ทุนเพิ่มปีละ 5% สูงสุด 25% (ปีที่ 6 ทุนชีวิต ${baht(paSumAfterRenewals(p))} บาท)`,
    "",
    "📌 คุ้มครอง 24 ชั่วโมง ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี",
    "เบี้ยกำหนดตามลักษณะอาชีพ",
  ].join("\n");
}
