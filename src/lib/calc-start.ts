/**
 * The figures a link may open a calculator with: `?age=38&sex=F&premium=36000`. สำรวจความคุ้มครอง's
 * "สรุปก่อนนัด" sends these to Global Savings and บำนาญ 95 (owner, 2026-10-22). Each value is
 * taken only when it is a plain whole number in range, or M / F; anything else is left out and the
 * calculator keeps its own start value for it.
 */
export interface CalcStart {
  age?: number;
  sex?: "M" | "F";
  premium?: number;
}

export function readCalcStart(search: string, ages: { min: number; max: number }, premiums: { min: number; max: number }): CalcStart {
  const q = new URLSearchParams(search);
  const once = (k: string) => {
    const all = q.getAll(k);
    return all.length === 1 ? all[0] : undefined;
  };
  const whole = (v: string | undefined, lo: number, hi: number) =>
    v !== undefined && /^\d{1,9}$/.test(v) && Number(v) >= lo && Number(v) <= hi ? Number(v) : undefined;
  const sex = once("sex");
  const out: CalcStart = {};
  const age = whole(once("age"), ages.min, ages.max);
  if (age !== undefined) out.age = age;
  if (sex === "M" || sex === "F") out.sex = sex;
  // a budget under the plan's least premium opens at that least premium
  const raw = whole(once("premium"), 1, premiums.max);
  if (raw !== undefined) out.premium = Math.max(raw, premiums.min);
  return out;
}
