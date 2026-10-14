import { formatBaht } from "@/calc/money";
import type { DeathBenefit } from "@/calc/types";
import { PAY_MODE_LABEL, type PayMode } from "@/calc/types";
import { perDayText } from "@/lib/legacy-cta";
import { legacyFromDeath } from "@/lib/legacy-headline";
import { legacyTable, type LegacyTable } from "@/lib/legacy-table";
import type { QuoteVideoFacts, VideoInput } from "./script";

/**
 * มรดกเพื่อครอบครัว in วิดีโอนำเสนอ (owner, 2026-10-14, mockup
 * https://claude.ai/artifact/55oEG3PjdupXzKPkTHbU75): the fifth plan, the LEGACY_FAMILY bundle the
 * /legacy page sells — a tier of 1–10 (the millions the family receives), an age and a sex. Every
 * figure is the page's own table (src/lib/legacy-table.ts), read the way LegacyCalculator.tsx
 * reads it, so the clip and the page cannot disagree.
 *
 * Its words (owner's choices on the mockup): "ค่าใช้จ่าย" for what is paid, as iHealthy — never
 * "ออม" (most of it is the critical-illness rider, which builds no value and rises with age) and
 * never "เบี้ย" or "เสียชีวิต" in the voice. The price is the first year's; the clip says it rises
 * with age without giving next year's figure. Its fourth scene is the critical-illness lump sum
 * (scene key "critical") where the other plans have their value table.
 */

export type LegacyVideoInput = Extract<VideoInput, { product: "LEGACY" }>;

export const LEGACY_NAME = "มรดกเพื่อครอบครัว";
export const LEGACY_PAGE = "/legacy";

/** one stretch of ages the family receives one sum in, ages inclusive */
export interface LegacyBand { from: number; to: number; amount: number }

/** มรดก's part of the facts: what the cover and critical-illness scenes are drawn from */
export interface LegacyVideoFacts {
  /** the tier, which is the round millions: 1 → "มรดก 1 ล้าน" */
  tier: number;
  /** the death benefit by age from the insured's own age, bands already passed left out */
  bands: LegacyBand[];
  /** the rider's sum, paid once on a critical illness */
  critical: number;
  diseaseCount: number;
  /** the age the critical-illness cover stops at, and the base policy's */
  criticalToAge: number;
  coverToAge: number;
  /** "12": the first year's yearly total as whole baht a day, as the page rounds it */
  perDay: string;
  /** "4,123": the first year's yearly total */
  annual: string;
  /** "1,234": the first year's monthly instalment, only where the company takes it monthly */
  monthly?: string;
}

/** the order the server packed each row of prices in (legacy-table.ts) */
const ROW_MODES: PayMode[] = ["annual", "semi", "monthly"];

/** one person's prices off the page's table: satang by mode, the monthly one flagged when under the minimum */
function pricesOf(t: LegacyTable, tier: number, age: number, sex: "M" | "F") {
  const row = t.premiums[sex]?.[tier - 1]?.[age - t.ageMin];
  if (!row) return undefined;
  return ROW_MODES.map((mode, i) => ({ mode, total: row[i], belowMinimum: mode === "monthly" && row[3] === 1 }));
}

/** the bands as the page picks them: the set at or past the booster age once the insured is */
function deathOf(t: LegacyTable, tier: number, age: number): DeathBenefit {
  const d = t.death[tier - 1];
  return age >= d.under.beforeAge ? d.from : d.under;
}

/**
 * The death benefit as ages and sums, from the insured's age on — the same bands deathBenefitRows
 * says in words, with each band's first and last age, so a staircase can be drawn in proportion.
 */
export function legacyBands(db: DeathBenefit, age: number, coverToAge: number): LegacyBand[] {
  const ends = db.riderCoverEnds;
  const last = coverToAge;
  const bands: LegacyBand[] = db.alreadyPastAge
    ? [{ from: age, to: ends ? ends.age - 1 : last, amount: db.sumFrom }]
    : [
      { from: age, to: db.beforeAge - 1, amount: db.sumBefore },
      { from: db.beforeAge, to: ends ? ends.age - 1 : last, amount: db.sumFrom },
    ];
  if (ends) bands.push({ from: ends.age, to: last, amount: ends.sum });
  // an age already past a band's end has nothing left in it
  return bands.filter((b) => b.to >= age).map((b) => ({ ...b, from: Math.max(b.from, age) }));
}

/** What the form sent, checked: an age and tier the bundle takes. The words for what is wrong otherwise. */
export function checkedLegacy(v: LegacyVideoInput, today: Date = new Date()): LegacyVideoInput | string {
  const t = legacyTable(today);
  if (!Number.isInteger(v.tier) || v.tier < 1 || v.tier > t.tiers) return `เลือกขนาดมรดก 1–${t.tiers} ล้าน`;
  if (!Number.isInteger(v.age) || v.age < t.ageMin || v.age > t.ageMax) return `แบบนี้รับประกันอายุ ${t.ageMin}–${t.ageMax} ปี`;
  return { product: "LEGACY", sex: v.sex, age: v.age, tier: v.tier };
}

/**
 * The largest legacy a budget buys: the biggest tier whose instalment, in the mode the customer
 * named, is within it. A monthly budget only buys a tier the company takes monthly (the page's
 * own rule: under the monthly minimum the monthly instalment is not offered at all).
 */
export function legacyFromBudget(v: LegacyVideoInput, budget: { baht: number; per: "month" | "year" }, today: Date = new Date()): LegacyVideoInput | string {
  const t = legacyTable(today);
  if (t.expired) return "ตารางเบี้ยของแบบนี้หมดอายุแล้ว ขอราคาปัจจุบันจากบริษัทก่อน";
  const mode: PayMode = budget.per === "month" ? "monthly" : "annual";
  const cost = (tier: number) => {
    const m = pricesOf(t, tier, v.age, v.sex)?.find((x) => x.mode === mode);
    return m && !m.belowMinimum ? Math.floor(m.total / 100) : undefined;
  };
  let best = 0;
  for (let tier = 1; tier <= t.tiers; tier++) {
    const c = cost(tier);
    if (c !== undefined && c <= budget.baht) best = tier;
  }
  if (best) return { ...v, tier: best, budget };
  const word = budget.per === "month" ? "เดือนละ" : "ปีละ";
  const first = Array.from({ length: t.tiers }, (_, i) => i + 1).find((tier) => cost(tier) !== undefined);
  if (first === undefined) return "แบบนี้คิดราคาไม่ได้ในอายุนี้";
  const why = budget.per === "month" && first > 1 ? ` (รายเดือนขั้นต่ำ ${t.minMonthlyTotal.toLocaleString("en-US")} บาท)` : "";
  return `งบนี้ยังไม่พอสำหรับมรดก ${first} ล้าน (เริ่มที่${word} ${cost(first)!.toLocaleString("en-US")} บาท)${why}`;
}

/** The facts the scenes are drawn and spoken from; undefined when the page would show no price. */
export function legacyVideoFacts(v: LegacyVideoInput, today: Date = new Date()): QuoteVideoFacts | undefined {
  const t = legacyTable(today);
  if (t.expired || v.tier < 1 || v.tier > t.tiers || v.age < t.ageMin || v.age > t.ageMax) return undefined;
  const modes = pricesOf(t, v.tier, v.age, v.sex);
  if (!modes) return undefined;
  const annual = modes.find((m) => m.mode === "annual")!;
  const db = deathOf(t, v.tier, v.age);
  const coverToAge = t.contracts.base.coverToAge;
  const bands = legacyBands(db, v.age, coverToAge);
  const top = legacyFromDeath(db).amount;
  const critical = t.critical[v.tier - 1];
  const perDay = perDayText(annual.total);
  // largest first as the other plans list theirs; the monthly one only where the company takes it
  const prices = modes
    .filter((m) => !m.belowMinimum)
    .map((m) => ({ label: PAY_MODE_LABEL[m.mode], amount: formatBaht(m.total), main: m.mode === "annual" }));
  const monthly = prices.find((p) => p.label === PAY_MODE_LABEL.monthly);
  const who = `${v.sex === "F" ? "หญิง" : "ชาย"} ${v.age} ปี`;
  return {
    product: "LEGACY",
    planLine: LEGACY_NAME,
    insuredWho: who,
    insuredLine: `มรดก ${v.tier} ล้าน · คุ้มครองถึงอายุ ${coverToAge}`,
    sex: v.sex,
    age: v.age,
    lead: { label: "ครอบครัวได้เงินก้อนสูงสุด", amount: top.toLocaleString("en-US"), baht: top },
    leadMark: `ค่าใช้จ่ายปีแรก วันละ ${perDay} บาท`,
    priceMark: `วันละ ${perDay} บาท`,
    perDayAmount: perDay,
    priceTitle: "ค่าใช้จ่ายปีแรก",
    prices,
    spokenPrice: { per: "ปีละ", amount: formatBaht(annual.total) },
    pills: ["ส่วนโรคร้ายแรงปรับตามอายุ"],
    priceNotes: [],
    coverTitle: "ครอบครัวได้รับ ถ้าเป็นอะไรไป",
    // the same amounts as the page's "ครอบครัวได้รับเมื่อเสียชีวิต" (deathBenefitRows), labelled by age
    cover: bands.map((b, i) => ({ label: bandLabel(b, i, bands), amount: b.amount.toLocaleString("en-US"), mark: b.amount === top })),
    coverStyle: "bands",
    coverToAge,
    legacy: {
      tier: v.tier, bands, critical, diseaseCount: t.diseaseCount,
      criticalToAge: t.contracts.rider.coverToAge, coverToAge,
      perDay, annual: formatBaht(annual.total), ...(monthly ? { monthly: monthly.amount } : {}),
    },
    footNote: `ค่าใช้จ่ายปีแรก ส่วนโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป · โรคร้ายแรงเป็นไปตามคำนิยาม 1 ใน ${t.diseaseCount} โรคในกรมธรรม์`,
  };
}

/** "ก่อนอายุ 60", "อายุ 60–74", "อายุ 75–99": a band as the staircase names it */
export function bandLabel(b: LegacyBand, i: number, all: LegacyBand[]): string {
  if (i === 0 && all.length > 1) return `ก่อนอายุ ${b.to + 1}`;
  return `อายุ ${b.from}–${b.to}`;
}

/** "1.15 ล้าน", "10 ล้าน", "150,000": a band's sum, short enough to stand over a narrow bar */
export function shortBaht(baht: number): string {
  if (baht < 1_000_000) return baht.toLocaleString("en-US");
  return `${(Math.round(baht / 10_000) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ล้าน`;
}

/** the band's ages under its bar: "ก่อน 60", "60–74", "75–99" */
export function bandAges(b: LegacyBand, i: number, all: LegacyBand[]): string {
  return i === 0 && all.length > 1 ? `ก่อน ${b.to + 1}` : `${b.from}–${b.to}`;
}

/**
 * The staircase in a w×h box (owner, 2026-10-14): one bar a band, as wide as its years and as tall
 * as its sum against the largest, side by side from the insured's age to the end of the cover.
 * A bar is never thinner than `minW` nor shorter than `minH`, so the last, small band stays seen.
 */
export function stairs(bands: LegacyBand[], w: number, h: number, minW = 0, minH = 0) {
  const years = bands.map((b) => b.to - b.from + 1);
  const room = w - minW * bands.length;
  const total = Math.max(1, years.reduce((a, b) => a + b, 0));
  const top = Math.max(1, ...bands.map((b) => b.amount));
  let x = 0;
  return bands.map((b, i) => {
    const bw = Math.round(minW + (years[i] / total) * room);
    const bh = Math.max(minH, Math.round((b.amount / top) * h));
    const r = { x, w: i === bands.length - 1 ? w - x : bw, h: bh, band: b };
    x += bw;
    return r;
  });
}
