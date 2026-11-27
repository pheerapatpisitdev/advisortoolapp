import { medicalPlansAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectIllness, type LifeProtectSharedCap, type LifeProtectTable } from "@/lib/lifeprotect-table";

/**
 * What the วิดีโอนำเสนอ form needs to offer Life Protect's riders itself (owner, 2026-11-18, ข):
 * the names, ages and sums the /lifeprotect page offers, without the rate tables — the form
 * prices nothing, the server does (actions.ts), so a few hundred bytes stand in for the table.
 */
export interface LpRiderMenu {
  /** the plan's youngest age, which `medical.maxAt` counts from */
  ageMin: number;
  waiver?: { code: string; ageMin: number; ageMax: number; options: { code: string; word: string }[] };
  medical?: { ageMin: number; ageMax: number; plans: number[]; /** the largest plan each age may buy, [age - ageMin]; 0 = none */ maxAt: number[] };
  /** critical illness, then accident, in the page's order */
  illness: Pick<LifeProtectIllness, "code" | "short" | "group" | "ageMin" | "ageMax" | "saMin" | "saMax" | "baseLimit">[];
  accidentCap?: LifeProtectSharedCap;
}

/** `t`: the table whose riders are offered — Life Protect's, or 12 พีแอล's (owner, 2026-11-26), whose page sells the same ones */
export function lpRiderMenu(today: Date = new Date(), t: LifeProtectTable = lifeProtectTable(today)): LpRiderMenu {
  const wp = t.riders[0];
  const meb = t.medical;
  return {
    ageMin: t.ageMin,
    ...(wp ? {
      waiver: {
        code: wp.code, ageMin: wp.ageMin, ageMax: wp.ageMax,
        // "สัญญาเพิ่มเติมดับบลิวพี ฟิต" → "ฟิต", as the page's buttons say it
        options: wp.options.map((o) => ({ code: o.code, word: o.name.replace(wp.name.split(" (")[0], "").trim() || o.name })),
      },
    } : {}),
    ...(meb ? {
      medical: {
        ageMin: meb.ageMin, ageMax: meb.ageMax, plans: meb.plans,
        maxAt: Array.from({ length: t.ageMax - t.ageMin + 1 }, (_, i) => Math.max(0, ...medicalPlansAt(t, meb, t.ageMin + i))),
      },
    } : {}),
    illness: t.illness.map(({ code, short, group, ageMin, ageMax, saMin, saMax, baseLimit }) => ({
      code, short, group, ageMin, ageMax, saMin, saMax, ...(baseLimit ? { baseLimit } : {}),
    })),
    ...(t.accidentCap ? { accidentCap: t.accidentCap } : {}),
  };
}
