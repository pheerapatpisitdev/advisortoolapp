import { formatBaht } from "@/calc/money";
import type { ModePremium } from "@/calc/mode-premiums";
import { PAY_MODE_LABEL, type PayMode } from "@/calc/types";
import { budgetFit } from "@/lib/budget-sum";
import { CI123_SUMS, stagePays, sumWords } from "@/lib/ci123-cta";
import { ci123Table, type Ci123Stage, type Ci123Table } from "@/lib/ci123-table";
import { perDayText } from "@/lib/legacy-cta";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * CI 123 in วิดีโอนำเสนอ (owner, 2026-11-26, ข on mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p): the
 * eleventh plan, the /ci123 page's set — the CI 123 rider on the smallest Life Protect x2 — one of the page's
 * seven CI sums, an age, a sex. Every figure is the page's own table (src/lib/ci123-table.ts), read as
 * Ci123Calculator.tsx reads it, so the clip and the page cannot disagree.
 *
 * Its scenes (the owner chose ข: the other stages a scene of their own): the stages that climb to the whole sum
 * as stairs (scene key "critical"), then what else it pays — the special conditions, critical care, and the
 * children's illnesses for an insured of 18 or under (key "cover"), then the base contract's life cover (key
 * "family"). The price is the first year's for the set as a whole: the CI 123 part is priced on attained age and
 * rises, and the screen says so.
 */

export type Ci123VideoInput = Extract<VideoInput, { product: "CI123" }>;
export const CI123_NAME = "CI 123";

/** one stage as the clip shows it: its name long and short, how many conditions, its share and what it pays */
export interface Ci123Row {
  key: string;
  /** the page's own name, "โรคร้ายแรงระยะก่อนเริ่มต้น" */
  label: string;
  /** the stairs' short name, "ก่อนเริ่มต้น" */
  short: string;
  count: number;
  /** "20% ไม่เกิน 100,000", "25%" */
  share: string;
  amount: number;
  /** the stage's own limit, said under it (the children's ages, critical care's shared limit) */
  note?: string;
}

/** the base contract's life cover as the clip lists it: before the booster age and from it, or from it only */
export interface Ci123DeathRow { label: string; amount: number; on: boolean }

export interface Ci123VideoFacts {
  sum: number;
  tier: number;
  diseaseCount: number;
  /** the three stages the stairs climb, lowest first */
  stairs: Ci123Row[];
  /** what else it pays: the children's illnesses (18 or under only), the special conditions, critical care */
  more: Ci123Row[];
  /** the insured is of an age the children's illnesses cover */
  juvenile: boolean;
  baseSum: number;
  death: { beforeAge: number; sumBefore: number; sumFrom: number };
  deathRows: Ci123DeathRow[];
  /** the first year's yearly total, as the page prints it, and as whole baht a day */
  annual: string;
  perDay: string;
}

/** the stairs, in the leaflet's order, lowest first */
const STAIRS = ["pre-early ci", "early to intermediate ci", "major ci"];
/** the rest, in the leaflet's order */
const MORE = ["juvenile ci", "special conditions", "critical care benefit"];
const SHORT: Record<string, string> = {
  "pre-early ci": "ก่อนเริ่มต้น", "early to intermediate ci": "เริ่มต้น–ปานกลาง", "major ci": "ระยะรุนแรง",
  "juvenile ci": "โรคเด็ก", "special conditions": "เงื่อนไขพิเศษ", "critical care benefit": "ภาวะวิกฤต",
};
/** the children's illnesses are for an insured of 1 month to 18 (ci123-table.ts STAGE_TEXT) */
export const CI123_JUVENILE_TO = 18;
const pct = (share: number) => `${Math.round(share * 100)}%`;

export const ciMoney = (n: number) => Math.round(n).toLocaleString("en-US");
/** "4 โรค · 10% ของทุน" */
export const ciRowSub = (r: Ci123Row) => `${r.count} ${r.key === "critical care benefit" ? "ภาวะ" : "โรค"} · ${r.share} ของทุน`;

const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];
/** one person's prices off the page's table: satang by mode, the monthly one flagged when under the minimum */
function pricesOf(t: Ci123Table, tier: number, age: number, sex: "M" | "F"): ModePremium[] | undefined {
  const row = t.premiums[sex]?.[tier - 1]?.[age - t.ageMin];
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({ mode, total: row[i], belowMinimum: mode === "monthly" && row[3] === 1 }));
}

const SUMS_WORD = `ทุน CI 123 ${CI123_SUMS.map(sumWords).join(" ")} ตามขั้นของหน้า CI 123`;

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedCi123(v: Ci123VideoInput, today: Date = new Date()): Ci123VideoInput | string {
  const t = ci123Table(today);
  if (!Number.isInteger(v.age) || v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!t.sums.includes(v.sumAssured)) return SUMS_WORD;
  return { product: "CI123", age: v.age, sex: v.sex, sumAssured: v.sumAssured };
}

/** The biggest of the page's sums whose instalment fits; the words for why none does otherwise. */
export function ci123FromBudget(v: Ci123VideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): Ci123VideoInput | string {
  const t = ci123Table(today);
  const none = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";
  if (t.expired || v.age < t.ageMin || v.age > t.ageMax) return none;
  const price = (sum: number) => pricesOf(t, t.sums.indexOf(sum) + 1, v.age, v.sex);
  const fit = budgetFit(t.sums, price, budget);
  if (fit) return { ...v, sumAssured: fit.sum, budget };
  const first = price(t.sums[0])?.find((m) => m.mode === (budget.per === "month" ? "monthly" : "annual"));
  if (!first) return none;
  const floor = budget.per === "month" && first.belowMinimum ? ` (รายเดือนขั้นต่ำ ${t.minMonthlyTotal.toLocaleString("en-US")} บาท)` : "";
  return `งบนี้ยังไม่พอสำหรับทุนต่ำสุด ${ciMoney(t.sums[0])} (เริ่มที่${budget.per === "month" ? "เดือนละ" : "ปีละ"} ${formatBaht(first.total)} บาท)${floor}`;
}

function rowOf(s: Ci123Stage, sum: number): Ci123Row {
  return {
    key: s.key, label: s.label, short: SHORT[s.key] ?? s.label, count: s.count,
    share: s.cap !== null ? `${pct(s.share)} ไม่เกิน ${ciMoney(s.cap)}` : pct(s.share),
    amount: Math.round(stagePays(s, sum)),
    ...(s.key === "juvenile ci" ? { note: `อายุ 1 เดือน – ${CI123_JUVENILE_TO} ปี คุ้มครองถึงอายุ ${CI123_JUVENILE_TO + 1}` } : {}),
    ...(s.key === "critical care benefit" ? { note: "นับรวมวงเงินเดียวกับระยะรุนแรง" } : {}),
  };
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function ci123VideoFacts(v: Ci123VideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const ok = checkedCi123(v, today);
  if (typeof ok === "string") return undefined;
  const t = ci123Table(today);
  if (t.expired) return undefined;
  const tier = t.sums.indexOf(ok.sumAssured) + 1;
  const modes = pricesOf(t, tier, ok.age, ok.sex);
  const annual = modes?.find((m) => m.mode === "annual");
  if (!modes || !annual) return undefined;
  const juvenile = ok.age <= CI123_JUVENILE_TO;
  const byKey = (k: string) => t.stages.find((s) => s.key === k);
  const stairs = STAIRS.flatMap((k) => { const s = byKey(k); return s ? [rowOf(s, ok.sumAssured)] : []; });
  const more = MORE.filter((k) => k !== "juvenile ci" || juvenile).flatMap((k) => { const s = byKey(k); return s ? [rowOf(s, ok.sumAssured)] : []; });
  if (stairs.length !== STAIRS.length) return undefined;
  const d = t.death;
  // the page's own rows (Ci123Calculator.tsx): before the booster age only for someone still under it
  const deathRows: Ci123DeathRow[] = ok.age < d.beforeAge
    ? [{ label: `ก่อนอายุ ${d.beforeAge}`, amount: d.sumBefore, on: true }, { label: `ตั้งแต่อายุ ${d.beforeAge}`, amount: d.sumFrom, on: false }]
    : [{ label: "ตลอดสัญญา", amount: d.sumFrom, on: true }];
  const perDay = perDayText(annual.total);
  // the yearly instalment first, as the page's headline reads where the monthly one is not taken; the monthly one only where it is
  const prices = modes
    .filter((m) => !m.belowMinimum)
    .map((m) => ({ label: PAY_MODE_LABEL[m.mode], amount: formatBaht(m.total), main: m.mode === "annual" }));
  const g: Ci123VideoFacts = {
    sum: ok.sumAssured, tier, diseaseCount: t.diseaseCount, stairs, more, juvenile,
    baseSum: t.baseSum, death: { ...d }, deathRows, annual: formatBaht(annual.total), perDay,
  };
  const who = `${ok.sex === "F" ? "หญิง" : "ชาย"} ${ok.age} ปี`;
  return {
    product: "CI123",
    planLine: CI123_NAME,
    insuredWho: who,
    insuredLine: `ทุน ${ciMoney(ok.sumAssured)} · คู่ Life Protect x2`,
    sex: ok.sex,
    age: ok.age,
    lead: { label: "เงินก้อนเมื่อพบโรคร้ายแรง", amount: ciMoney(ok.sumAssured), baht: ok.sumAssured },
    leadMark: `${t.diseaseCount} โรค จ่ายตามระยะ`,
    leadPill: "เริ่มจ่ายตั้งแต่ระยะก่อนเริ่มต้น",
    contactLine: "วางแผนไว้ก่อน ไม่ต้องห่วงค่ารักษา",
    priceMark: `ตกวันละ ${perDay} บาท`,
    priceBig: { label: "ออมปีละ", amount: g.annual, unit: "บาท" },
    perDayAmount: perDay,
    priceTitle: "ยอดออมปีแรก",
    prices,
    spokenPrice: { per: "ปีละ", amount: g.annual },
    // the mockup's two pills: the day's price, and that the price is the set's
    pills: [`ตกวันละ ${perDay} บาท`, "รวมแบบหลัก Life Protect x2"],
    priceNotes: ["ส่วน CI 123 คิดตามอายุ ปรับขึ้นในปีถัดไป"],
    coverTitle: "คุ้มครองเพิ่มอีก",
    // what else it pays, for the writer and the figures a written line may say (the drawers draw g.more)
    cover: more.map((r) => ({ label: r.label, amount: ciMoney(r.amount), mark: r.key === "critical care benefit" })),
    coverStyle: "rows",
    coverNote: more.find((r) => r.key === "critical care benefit")?.note,
    coverToAge: 99,
    footNote: `ยอดออมปีแรก ส่วน CI 123 คิดตามอายุ จึงปรับขึ้นในปีถัดไป · โรคร้ายแรงเป็นไปตามคำนิยามในกรมธรรม์`,
    ci123: g,
  };
}

/** the CI stage a picture names: "ระยะก่อนเริ่มต้น" for the stairs' first, the page's own words otherwise */
const saidStage = (r: Ci123Row) => (r.key === "pre-early ci" ? "ระยะก่อนเริ่มต้น" : r.key === "early to intermediate ci" ? "ระยะเริ่มต้นถึงปานกลาง" : r.key === "major ci" ? "ระยะรุนแรง" : r.label);

/** "ถ้าวันหนึ่งตรวจพบโรคร้ายแรง เงินก้อนช่วยให้รักษาได้เต็มที่ CI 123 คุ้มครองโรคร้ายแรง 122 โรค ทุน 1 ล้านบาทค่ะ" */
export const ciLeadLine = (g: Ci123VideoFacts, said: (baht: number) => string): string =>
  `CI 123 คุ้มครองโรคร้ายแรง ${g.diseaseCount} โรค ทุน ${said(g.sum)}ค่ะ`;

/** "สำหรับคุณผู้ชายอายุ 35 ปี ออมปีแรก 6,911.50 บาท ตกวันละ 19 บาท รวมแบบหลักไว้แล้วค่ะ" */
export function ciPriceLine(f: QuoteVideoFacts, g: Ci123VideoFacts, who: string): string {
  const yearly = f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual;
  // a newborn is "แรกเกิด", not "อายุ 0 ปี"
  const forWho = f.age === 0 ? "เด็กแรกเกิด" : `${who} ปี`;
  return `สำหรับ${forWho} ออมปีแรก ${yearly} บาท ตกวันละ ${g.perDay} บาท รวมแบบหลักไว้แล้วค่ะ`;
}

/** "เจอเร็วก็ได้เร็ว ระยะก่อนเริ่มต้นรับ 100,000 บาท … และระยะรุนแรงรับเต็มทุน 1 ล้านบาท หักส่วนที่รับไปแล้วค่ะ" */
export function ciStairsLine(g: Ci123VideoFacts, said: (baht: number) => string): string {
  const [first, ...rest] = g.stairs;
  const top = rest[rest.length - 1];
  const middle = rest.slice(0, -1).map((r) => ` ${saidStage(r)}รับ ${said(r.amount)}`).join("");
  return `เจอเร็วก็ได้เร็ว ${saidStage(first)}รับ ${said(first.amount)}${middle} และ${saidStage(top)}รับเต็มทุน ${said(top.amount)} หักส่วนที่รับไปแล้วค่ะ`;
}

/** "นอกจากนี้ยังมีโรคภายใต้เงื่อนไขพิเศษ รับ 100,000 บาท และภาวะวิกฤต รับ 250,000 บาทค่ะ" */
export function ciMoreLine(g: Ci123VideoFacts, said: (baht: number) => string): string {
  const name = (r: Ci123Row) => (r.key === "special conditions" ? "โรคภายใต้เงื่อนไขพิเศษ" : r.label);
  const parts = g.more.map((r) => `${name(r)} รับ ${said(r.amount)}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(" ")} และ${parts[parts.length - 1]}` : parts[0] ?? "";
  return `นอกจากนี้ยังมี${list}ค่ะ`;
}

/** "และยังมีแบบหลักคุ้มครองชีวิต ถ้าจากไปก่อนอายุ 60 ครอบครัวได้ 300,000 บาทค่ะ"; from 60, the sum for the rest of the contract */
export function ciBaseLine(g: Ci123VideoFacts, age: number, said: (baht: number) => string): string {
  return age < g.death.beforeAge
    ? `และยังมีแบบหลักคุ้มครองชีวิต ถ้าจากไปก่อนอายุ ${g.death.beforeAge} ครอบครัวได้ ${said(g.death.sumBefore)}ค่ะ`
    : `และยังมีแบบหลักคุ้มครองชีวิต ถ้าจากไป ครอบครัวได้ ${said(g.death.sumFrom)}ค่ะ`;
}
