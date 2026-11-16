import { cardVersionFor } from "@/lib/card-theme";
import {
  PA_FAMILIES, PA_WEEKLY_MAX_WEEKS, paClassesOf, paPerDay, paPremium, paRows, paSumAfterRenewals,
  type PaQuoteFacts, type PaRow,
} from "@/lib/pa-plans";

/**
 * PA's two pictures for its page's ส่งให้ลูกค้า: the chosen plan as a card, and every plan of its
 * family as a table (owner, 2026-11-16, ก ก on mockup https://claude.ai/artifact/JS18RH7pQi6hbtp4tcWPq2).
 * Until then the page had only its text to send. Thai only, whatever language the page is read in.
 *
 * Described here and drawn in the routes (src/app/api/card/pa-card, pa-table), so the figures can
 * be tested without drawing anything. A picture is asked for by the plan's code, the occupation
 * class and the age, never by its figures: they are read off the brochure's table at draw time.
 */

/** Bumped when these two pictures alone change, so an old drawing is not served from a cache. 1: the first (2026-11-16). */
const PA_CARD_REVISION = "p1";

export interface PaCardAsk { code: string; cls: number; age: number }

const query = (a: PaCardAsk) =>
  new URLSearchParams({ plan: a.code, cls: String(a.cls), age: String(a.age), v: `${cardVersionFor()}-${PA_CARD_REVISION}` }).toString();

/** The path the chosen plan's card is drawn at. */
export const paCardPath = (a: PaCardAsk) => `/api/card/pa-card?${query(a)}`;
/** The path the family's all-plans table is drawn at, the same plan marked in it. */
export const paTablePath = (a: PaCardAsk) => `/api/card/pa-table?${query(a)}`;

/** The quote an address names, or undefined when the page would give none for it. */
export function paCardFrom(q: URLSearchParams): PaQuoteFacts | undefined {
  const code = q.get("plan");
  const cls = q.get("cls") ?? "";
  const age = q.get("age") ?? "";
  if (!/^[1-4]$/.test(cls) || !/^\d{1,2}$/.test(age)) return undefined;
  for (const family of PA_FAMILIES) {
    const plan = family.plans.find((p) => p.code === code);
    if (!plan) continue;
    const facts = { family, plan, cls: Number(cls), age: Number(age) };
    if (paPremium(plan, facts.cls) === null || facts.age < family.ageMin || facts.age > family.ageMax) return undefined;
    return facts;
  }
  return undefined;
}

const baht = (n: number) => n.toLocaleString("en-US");

/** the cover's rows as a picture names them: shorter than the page's, which has room to wrap */
const LABEL: Record<PaRow["key"], string> = {
  death: "เสียชีวิต สูญเสียอวัยวะ หรือทุพพลภาพถาวรสิ้นเชิง จากอุบัติเหตุ",
  murder: "ถูกฆาตกรรมหรือลอบทำร้าย",
  motorcycle: "ขับขี่หรือโดยสารรถจักรยานยนต์",
  medical: "ค่ารักษาพยาบาลต่ออุบัติเหตุ",
  weekly: `ชดเชยทุพพลภาพชั่วคราว ต่อสัปดาห์ (สูงสุด ${PA_WEEKLY_MAX_WEEKS} สัปดาห์)`,
};

export interface PaCard {
  planLine: string;
  insuredLine: string;
  /** the yearly premium, grouped */
  premium: string;
  perDay: string;
  /** the death sum, in the sand box */
  main: { label: string; amount: string };
  rows: { label: string; amount: string }[];
  notes: string[];
}

/** The chosen plan's card, in the page's order. */
export function paCard(f: PaQuoteFacts): PaCard {
  const premium = paPremium(f.plan, f.cls)!;
  const [death, ...rest] = paRows(f.plan);
  return {
    planLine: `ประกันอุบัติเหตุ ${f.family.name} · แผน ${f.plan.name}`,
    insuredLine: `อายุ ${f.age} ปี · ขั้นอาชีพ ${f.cls}`,
    premium: baht(premium),
    perDay: `ตกวันละ ${baht(paPerDay(premium))} บาท`,
    main: { label: LABEL.death, amount: baht(death.amount) },
    rows: [
      ...rest.map((r) => ({ label: LABEL[r.key], amount: baht(r.amount) })),
      { label: "ต่ออายุปีที่ 6 ทุนชีวิตเพิ่มเป็น", amount: baht(paSumAfterRenewals(f.plan)) },
    ],
    notes: [
      "คุ้มครอง 24 ชั่วโมง ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี · เบี้ยกำหนดตามลักษณะอาชีพ",
      "ต่ออายุปีที่ 2–6 ทุนชีวิตเพิ่มปีละ 5% ของทุนเริ่มต้น สูงสุด 25%",
    ],
  };
}

export interface PaTable {
  title: string;
  /** who it was quoted for, under the title */
  insuredLine: string;
  /** the plans' names, in the brochure's order */
  columns: string[];
  /** the chosen plan's column */
  picked: number;
  rows: { label: string; cells: string[] }[];
  /** a premium row per occupation class the family takes; "–" where a plan does not take it */
  premiums: { label: string; cells: string[]; chosen: boolean }[];
  foot: string;
}

const SHORT: Record<PaRow["key"], string> = {
  death: "เสียชีวิต สูญเสียอวัยวะ ทุพพลภาพถาวร",
  murder: "ถูกฆาตกรรมหรือลอบทำร้าย",
  motorcycle: "ขับขี่หรือโดยสารรถจักรยานยนต์",
  medical: "ค่ารักษาพยาบาลต่ออุบัติเหตุ",
  weekly: "ชดเชยทุพพลภาพชั่วคราว ต่อสัปดาห์",
};

/** Every plan of the chosen plan's family side by side, as the brochure prints them. */
export function paTable(f: PaQuoteFacts): PaTable {
  const plans = f.family.plans;
  return {
    title: `${f.family.name} · ตารางทุกแผน`,
    insuredLine: `อายุ ${f.age} ปี · ขั้นอาชีพ ${f.cls} · แผนที่เลือก ${f.plan.name}`,
    columns: plans.map((p) => p.name),
    picked: plans.indexOf(f.plan),
    rows: paRows(plans[0]).map((r) => ({
      label: SHORT[r.key],
      cells: plans.map((p) => baht(paRows(p).find((x) => x.key === r.key)!.amount)),
    })),
    premiums: paClassesOf(f.family).map((c) => ({
      label: `เบี้ย/ปี ขั้นอาชีพ ${c}`,
      cells: plans.map((p) => { const v = paPremium(p, c); return v === null ? "–" : baht(v); }),
      chosen: c === f.cls,
    })),
    foot: `หน่วย: บาท · อายุรับประกัน ${f.family.ageMin}–${f.family.ageMax} ปี · คุ้มครอง 24 ชั่วโมง ทั่วโลก · สัญญา 1 ปี ต่ออายุปีต่อปี`,
  };
}

/** What both routes read, in the order the paths write it, then the customer's name the send panel may add. */
export const PA_CARD_KEYS = ["plan", "cls", "age", "v", "name"] as const;
