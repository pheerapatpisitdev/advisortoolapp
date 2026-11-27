import { formatBaht } from "@/calc/money";
import type { ModePremium } from "@/calc/mode-premiums";
import { PAY_MODE_LABEL, type PayMode } from "@/calc/types";
import { budgetFit } from "@/lib/budget-sum";
import { CPR_STAGES, HIC_INVASIVE_EXTRA_DAYS, HIC_MAX_DAYS, cancerDeathTotals, cprStagePays } from "@/lib/cancer-benefits";
import { cancerTable, type CancerTable } from "@/lib/cancer-table";
import { sumWords } from "@/lib/ci123-cta";
import { perDayText } from "@/lib/legacy-cta";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * ประกันมะเร็ง in วิดีโอนำเสนอ (owner, 2026-11-26, mockup https://claude.ai/artifact/K8A3uLFEDt1XqYnUKnqr3p, "ca"): the
 * twelfth plan, the /cancer page's set — CPR, paid by the stage of a cancer, and HIC, a daily sum in hospital, on a
 * Life Protect x2 that rises with CPR — one of the page's eight packages (named by its CPR sum), an age, a sex.
 * Every figure is the page's own table (src/lib/cancer-table.ts) and payout sheet (src/lib/cancer-benefits.ts), read
 * as CancerCalculator.tsx reads them, so the clip and the page cannot disagree.
 *
 * Its scenes: the four stages as stairs (scene key "critical"), the daily sum (key "cover"), and what every contract
 * pays together (key "family", cancerDeathTotals). The price is the first year's for the set as a whole: CPR and
 * HIC are yearly contracts priced on attained age, and the screen says so.
 */

export type CancerVideoInput = Extract<VideoInput, { product: "CANCER" }>;
/** the page's own name for the plan (its title, the chat's CANCER_LABEL) */
export const CANCER_NAME = "ประกันมะเร็ง";

/** one stage as the clip shows it */
export interface CancerStage {
  /** 1 to 4 */
  no: number;
  /** the payout sheet's name, "ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น" */
  label: string;
  /** under the stair: "ไม่ลุกลาม" over "ขั้นต้น" */
  lines: string[];
  /** "10% ไม่เกิน 50,000", "เต็มทุน" */
  share: string;
  amount: number;
  waitingDays: number;
  repeatable: boolean;
  major: boolean;
}

/** what every contract pays together, as the page's own rows (cancerDeathTotals) */
export interface CancerTotalRow { label: string; sub: string; amount: number; on: boolean }

export interface CancerVideoFacts {
  tier: number;
  cpr: number;
  hic: number;
  baseSum: number;
  death: { beforeAge: number; sumBefore: number; sumFrom: number };
  stages: CancerStage[];
  /** the stages that may be claimed again, "2–3" */
  repeatNos: string;
  /** the shortest and longest waits before a stage is covered, in days */
  waiting: { min: number; max: number };
  hicDays: number;
  hicExtraDays: number;
  /** the age the base's sum steps down at, when this person is under it */
  beforeAge?: number;
  totals: CancerTotalRow[];
  /** the first year's yearly total, as the page prints it, and as whole baht a day */
  annual: string;
  perDay: string;
}

/** the words under each stair, by stage: the sheet's names said short */
const LINES: Record<number, string[]> = { 1: ["ไม่ลุกลาม", "ขั้นต้น"], 2: ["ไม่ลุกลาม"], 3: ["ผ่าตัด", "อวัยวะออก"], 4: ["ลุกลาม"] };
export const caMoney = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (share: number) => `${Math.round(share * 100)}%`;

/** "2–3": the run of stage numbers a list holds */
function run(nos: number[]): string {
  if (!nos.length) return "";
  return nos.length === 1 ? String(nos[0]) : `${nos[0]}–${nos[nos.length - 1]}`;
}

const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];
/** one person's prices off the page's table: satang by mode, the monthly one flagged when under the minimum */
function pricesOf(t: CancerTable, tier: number, age: number, sex: "M" | "F"): ModePremium[] | undefined {
  const row = t.premiums[sex]?.[tier - 1]?.[age - t.ageMin];
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({ mode, total: row[i], belowMinimum: mode === "monthly" && row[3] === 1 }));
}

const tierOf = (t: CancerTable, cpr: number) => t.tiers.findIndex((x) => x.cpr === cpr) + 1;

/** What the form sent, checked; the words for what is wrong otherwise. */
export function checkedCancer(v: CancerVideoInput, today: Date = new Date()): CancerVideoInput | string {
  const t = cancerTable(today);
  if (!Number.isInteger(v.age) || v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  if (!tierOf(t, v.sumAssured)) return `ทุนมะเร็ง ${t.tiers.map((x) => sumWords(x.cpr)).join(" ")} ตามแพ็กของหน้าประกันมะเร็ง`;
  return { product: "CANCER", age: v.age, sex: v.sex, sumAssured: v.sumAssured };
}

/** The biggest of the page's packages whose instalment fits; the words for why none does otherwise. */
export function cancerFromBudget(v: CancerVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): CancerVideoInput | string {
  const t = cancerTable(today);
  const none = "แผนนี้คิดราคาไม่ได้ในอายุนี้ ลองเปลี่ยนอายุหรือแผน";
  if (t.expired || v.age < t.ageMin || v.age > t.ageMax) return none;
  const sums = t.tiers.map((x) => x.cpr);
  const price = (sum: number) => pricesOf(t, tierOf(t, sum), v.age, v.sex);
  const fit = budgetFit(sums, price, budget);
  if (fit) return { ...v, sumAssured: fit.sum, budget };
  const first = price(sums[0])?.find((m) => m.mode === (budget.per === "month" ? "monthly" : "annual"));
  if (!first) return none;
  const floor = budget.per === "month" && first.belowMinimum ? ` (รายเดือนขั้นต่ำ ${t.minMonthlyTotal.toLocaleString("en-US")} บาท)` : "";
  return `งบนี้ยังไม่พอสำหรับแพ็กเล็กสุด ทุน ${caMoney(sums[0])} (เริ่มที่${budget.per === "month" ? "เดือนละ" : "ปีละ"} ${formatBaht(first.total)} บาท)${floor}`;
}

/** The facts the scenes are drawn and spoken from; undefined for anything the page would refuse. */
export function cancerVideoFacts(v: CancerVideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const ok = checkedCancer(v, today);
  if (typeof ok === "string") return undefined;
  const t = cancerTable(today);
  if (t.expired) return undefined;
  const tier = tierOf(t, ok.sumAssured);
  const x = t.tiers[tier - 1];
  const modes = pricesOf(t, tier, ok.age, ok.sex);
  const annual = modes?.find((m) => m.mode === "annual");
  if (!modes || !annual) return undefined;
  const stages: CancerStage[] = CPR_STAGES.map((s, i) => {
    const no = Number(s.label.match(/ขั้น\s*(\d)/)?.[1] ?? i + 1);
    return {
      no, label: s.label, lines: LINES[no] ?? [s.label], amount: cprStagePays(s, x.cpr), waitingDays: s.waitingDays,
      share: s.major ? "เต็มทุน" : s.cap !== null ? `${pct(s.share)} ไม่เกิน ${caMoney(s.cap)}` : pct(s.share),
      repeatable: Boolean(s.repeatable), major: Boolean(s.major),
    };
  });
  const days = stages.map((s) => s.waitingDays);
  const d = cancerDeathTotals(x.cpr, x.death, ok.age);
  const [plain, after] = [d.rows.find((r) => !r.mark), d.rows.find((r) => r.mark)];
  if (!plain || !after) return undefined;
  // the page's two rows, in the clip's words: no "เสียชีวิต" on the screen either
  const totals: CancerTotalRow[] = [
    { label: "จากไปทั่วไป", sub: "แบบหลัก", amount: plain.amount, on: false },
    { label: "พบมะเร็งลุกลาม แล้วจากไป", sub: `ทุนมะเร็ง ${caMoney(x.cpr)} + แบบหลัก ${caMoney(plain.amount)}`, amount: after.amount, on: true },
  ];
  const perDay = perDayText(annual.total);
  const prices = modes
    .filter((m) => !m.belowMinimum)
    .map((m) => ({ label: PAY_MODE_LABEL[m.mode], amount: formatBaht(m.total), main: m.mode === "annual" }));
  const g: CancerVideoFacts = {
    tier, cpr: x.cpr, hic: x.hic, baseSum: x.baseSum, death: { ...x.death }, stages,
    repeatNos: run(stages.filter((s) => s.repeatable).map((s) => s.no)),
    waiting: { min: Math.min(...days), max: Math.max(...days) },
    hicDays: HIC_MAX_DAYS, hicExtraDays: HIC_INVASIVE_EXTRA_DAYS,
    ...(d.beforeAge ? { beforeAge: d.beforeAge } : {}),
    totals, annual: formatBaht(annual.total), perDay,
  };
  const who = `${ok.sex === "F" ? "หญิง" : "ชาย"} ${ok.age} ปี`;
  return {
    product: "CANCER",
    planLine: CANCER_NAME,
    insuredWho: who,
    // short enough for the classic portrait header beside the insured's face; the price scene says the base
    insuredLine: `ทุนมะเร็ง ${caMoney(x.cpr)} · วันละ ${caMoney(x.hic)}`,
    sex: ok.sex,
    age: ok.age,
    lead: { label: "เงินก้อนเมื่อพบมะเร็ง", amount: caMoney(x.cpr), baht: x.cpr },
    leadMark: `ชดเชยนอน รพ. วันละ ${caMoney(x.hic)}`,
    leadPill: "จ่ายตั้งแต่ระยะแรก",
    contactLine: "เตรียมไว้ก่อน ใจสบายกว่า",
    priceMark: `ตกวันละ ${perDay} บาท`,
    priceBig: { label: "ออมปีละ", amount: g.annual, unit: "บาท" },
    perDayAmount: perDay,
    priceTitle: "ยอดออมปีแรก",
    prices,
    spokenPrice: { per: "ปีละ", amount: g.annual },
    pills: [`ตกวันละ ${perDay} บาท`, "รวมแบบหลัก Life Protect x2"],
    priceNotes: ["ส่วน CPR และ HIC คิดตามอายุ ปรับขึ้นในปีถัดไป"],
    coverTitle: "นอนโรงพยาบาล ได้รายวัน",
    // the daily sum, for the writer and the figures a written line may say (the drawers draw the stage view)
    cover: [{ label: "ชดเชยนอนโรงพยาบาลต่อวัน", amount: caMoney(x.hic), mark: true }],
    coverStyle: "rows",
    coverNote: `สูงสุด ${HIC_MAX_DAYS} วัน · ระยะลุกลามเพิ่มอีก ${HIC_INVASIVE_EXTRA_DAYS} วัน`,
    coverToAge: 99,
    footNote: "ยอดออมปีแรก ส่วน CPR และ HIC คิดตามอายุ จึงปรับขึ้นในปีถัดไป · โรคมะเร็งเป็นไปตามคำนิยามในกรมธรรม์",
    cancer: g,
  };
}

/** the stages as said: the first three by their order, the last by what it is */
const STAGE_SAID: Record<number, string> = { 1: "ขั้นแรก", 2: "ขั้นสอง", 3: "ขั้นสาม" };

/** "มะเร็งรักษานาน ค่าใช้จ่ายก็สูง ประกันโรคมะเร็งจ่ายเงินก้อนตั้งแต่ระยะแรก ทุน 500,000 บาท พร้อมค่าชดเชยนอนโรงพยาบาลวันละ 2,000 บาทค่ะ" */
export const caLeadLine = (g: CancerVideoFacts, said: (baht: number) => string): string =>
  `ประกันโรคมะเร็งจ่ายเงินก้อนตั้งแต่ระยะแรก ทุน ${said(g.cpr)} พร้อมค่าชดเชยนอนโรงพยาบาลวันละ ${caMoney(g.hic)} บาทค่ะ`;

/** "สำหรับคุณผู้ชายอายุ 40 ปี ออมปีแรก 3,520 บาท ตกวันละ 10 บาท รวมแบบหลักไว้แล้วค่ะ" */
export function caPriceLine(f: QuoteVideoFacts, g: CancerVideoFacts, who: string): string {
  const yearly = f.prices.find((r) => r.label === "รายปี")?.amount ?? g.annual;
  // a newborn is "แรกเกิด", not "อายุ 0 ปี"
  const forWho = f.age === 0 ? "เด็กแรกเกิด" : `${who} ปี`;
  return `สำหรับ${forWho} ออมปีแรก ${yearly} บาท ตกวันละ ${g.perDay} บาท รวมแบบหลักไว้แล้วค่ะ`;
}

/** "ขั้นแรกรับ 50,000 บาท ขั้นสองรับ 75,000 บาท ขั้นสามรับ 150,000 บาท และระยะลุกลามรับเต็มทุน 500,000 บาท หักส่วนที่รับไปแล้วค่ะ" */
export function caStairsLine(g: CancerVideoFacts, said: (baht: number) => string): string {
  const lower = g.stages.filter((s) => !s.major).map((s) => `${STAGE_SAID[s.no] ?? `ขั้น ${s.no}`}รับ ${said(s.amount)}`);
  const top = g.stages.find((s) => s.major);
  return `${lower.join(" ")}${top ? ` และระยะลุกลามรับเต็มทุน ${said(top.amount)} หักส่วนที่รับไปแล้ว` : ""}ค่ะ`;
}

/** "นอนโรงพยาบาลเพราะมะเร็ง รับวันละ 2,000 บาท สูงสุด 365 วัน ถ้าเป็นระยะลุกลามได้เพิ่มอีก 180 วันค่ะ" */
export const caDailyLine = (g: CancerVideoFacts): string =>
  `นอนโรงพยาบาลเพราะมะเร็ง รับวันละ ${caMoney(g.hic)} บาท สูงสุด ${g.hicDays} วัน ถ้าเป็นระยะลุกลามได้เพิ่มอีก ${g.hicExtraDays} วันค่ะ`;

/** "ถ้าตรวจพบมะเร็งระยะลุกลาม แล้วจากไปก่อนอายุ 60 รวมทุกสัญญาครอบครัวได้ 800,000 บาทค่ะ"; from 60, without the age */
export function caTotalLine(g: CancerVideoFacts, said: (baht: number) => string): string {
  const after = g.totals.find((r) => r.on) ?? g.totals[g.totals.length - 1];
  return `ถ้าตรวจพบมะเร็งระยะลุกลาม แล้วจากไป${g.beforeAge ? `ก่อนอายุ ${g.beforeAge} ` : " "}รวมทุกสัญญาครอบครัวได้ ${said(after.amount)}ค่ะ`;
}
