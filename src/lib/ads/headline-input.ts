import type { HeadlinePick } from "@/lib/content/premium-table";

/**
 * How an ad round's table age and headline pick are read from the browser (moved here from the
 * round, 2026-10-05, so the create drawer's figure preview cleans them exactly as the round does).
 */

/** the ages a premium table is priced at, and the one taken when none is given */
const AGE_MIN = 0;
const AGE_MAX = 80;
const AGE_DEFAULT = 30;

/** an age as sent, as a whole year in range: 31.7 is 31, anything not a number is 30 */
export function adAge(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(AGE_MAX, Math.max(AGE_MIN, Math.floor(n))) : AGE_DEFAULT;
}

/** an ad's headline pick as sent: "M" or a woman; a whole row index, or none (the middle row) */
export function adPick(sex: unknown, rung: unknown): Partial<HeadlinePick> {
  return { sex: sex === "M" ? "M" : "F", ...(typeof rung === "number" && Number.isInteger(rung) ? { rung } : {}) };
}
