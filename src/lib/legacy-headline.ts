import type { DeathBenefit } from "@/calc/types";

/**
 * The figure a quote leads with: what the family inherits, in the largest type, with the
 * premium in the box beneath it (owner, 2026-10-06: "อยากให้ลูกค้าเห็นทุนตัวใหญ่นำสายตา").
 *
 * Written once for the sales pages and the cards that picture them, so a page and its card
 * lead with the same figure and say the same thing under it.
 */
export interface Legacy {
  /** the most the family can receive on death, in baht */
  amount: number;
  /** when that figure is paid, or how it is built, under it; absent when there is nothing to qualify */
  note?: string;
}

/** 2 → "2", 1.5 → "1.5" */
const times = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/**
 * A death benefit that steps down at an age, as Life Protect's does and the sets built on it.
 *
 * The figure is the larger band while the insured is still under the age it stops at. With a
 * `sumAssured` the note says how the figure is built from it ("ทุน 1,000,000 · 2 เท่าก่อนอายุ
 * 60"); a set, which has no one sum to multiply, says only when it is paid.
 */
export function legacyFromDeath(death: DeathBenefit, sumAssured?: number): Legacy {
  const stepped = !death.alreadyPastAge && death.sumBefore > death.sumFrom;
  if (!stepped) return { amount: death.sumFrom };
  return {
    amount: death.sumBefore,
    note: sumAssured
      ? `ทุน ${sumAssured.toLocaleString("en-US")} · ${times(death.sumBefore / sumAssured)} เท่าก่อนอายุ ${death.beforeAge}`
      : `เมื่อเสียชีวิตก่อนอายุ ${death.beforeAge}`,
  };
}

/** A death benefit that is the sum assured throughout, with the page's own words for how long. */
export function legacyLevel(sumAssured: number, note?: string): Legacy {
  return { amount: sumAssured, ...(note ? { note } : {}) };
}
