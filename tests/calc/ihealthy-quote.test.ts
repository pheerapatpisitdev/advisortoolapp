import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, deathBenefitOf, iHealthyPricing, ihuKey, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import type { RiderInput, Sex } from "@/calc/types";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);

/** A small seeded generator, so a failing case can be re-run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUMS = [150_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

/**
 * What the page actually buys at this age: the health rider, and the daily cash the agency
 * attaches as standard wherever the company still writes it. The engine has to be asked for
 * the same arrangement the browser priced, or the two are answering different questions.
 */
function attachedAt(age: number, health: RiderInput): RiderInput[] {
  const plan = table.standard.plan[age - table.ageMin];
  return plan === null ? [health] : [health, { code: table.standard.code, plan }];
}
/** the seed the sweep runs from, quoted in its failures so a case can be re-run */
const SEED = 20260912;

/**
 * Whether the company has a rate for this key at this age, read straight off the table.
 * Either sex answers for both, the assumption the filters are built on and that
 * ihealthy-table.test.ts asserts across all 28 keys.
 */
function sold(key: string, age: number): boolean {
  const rates = table.riderRates[key];
  const i = age - table.ageMin;
  return rates !== undefined && (rates.M[i] !== null || rates.F[i] !== null);
}

describe("ihuKey", () => {
  it("builds the workbook's key", () => {
    expect(ihuKey(table, "PLATINUM", 35, "ประเทศไทย", "Full Coverage")).toBe("MHP6S");
    expect(ihuKey(table, "SMART", 8, "ประเทศไทย", "Full Coverage")).toBe("MHP1J");
    expect(ihuKey(table, "DIAMOND", 30, "เอเชีย", "Full Coverage")).toBe("MHP5SA");
    expect(ihuKey(table, "PLATINUM", 30, "ประเทศไทย", "Deductible")).toBe("MHPD6S");
  });

  /**
   * The switch is at the eleventh birthday, and nothing else in the suite can see it: the
   * juvenile and standard tables charge the same premium at 11, so a price cannot tell them
   * apart, and the key set below is a union across ages.
   */
  it("reads the juvenile table up to the day before 11", () => {
    expect(ihuKey(table, "SMART", 10, "ประเทศไทย", "Full Coverage")).toBe("MHP1J");
    expect(ihuKey(table, "SMART", 11, "ประเทศไทย", "Full Coverage")).toBe("MHP1S");
  });
});

describe("the option filters", () => {
  it("offers a child two plans, Thailand only", () => {
    expect(plansFor(table, 8).map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect(territoriesFor(table, "SMART", 8)).toEqual(["ประเทศไทย"]);
  });

  it("offers an adult all six, but only the top two travel", () => {
    expect(plansFor(table, 35)).toHaveLength(6);
    expect(territoriesFor(table, "GOLD", 35)).toEqual(["ประเทศไทย"]);
    expect(territoriesFor(table, "PLATINUM", 35)).toEqual(["ประเทศไทย", "เอเชีย", "ทั่วโลก"]);
  });

  it("opens the other four plans on the eleventh birthday", () => {
    expect(plansFor(table, 10).map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect(plansFor(table, 11).map((p) => p.code))
      .toEqual(["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"]);
  });

  it("sells the deductible and the co-payment in Thailand only", () => {
    expect(coveragesFor(table, "ประเทศไทย", 35)).toEqual(["Full Coverage", "Deductible", "Co-Payment"]);
    expect(coveragesFor(table, "เอเชีย", 35)).toEqual(["Full Coverage"]);
    // a child's two plans are sold all three ways, and none of them abroad
    expect(coveragesFor(table, "ประเทศไทย", 8)).toEqual(["Full Coverage", "Deductible", "Co-Payment"]);
    expect(coveragesFor(table, "เอเชีย", 8)).toEqual([]);
  });

  it("probes with whatever label carries the empty letter, not with a spelling of it", () => {
    // the Thai labels are the workbook's marketing copy; the letters beside them are the data
    const renamed = {
      ...table,
      territories: { "ใน ปท.": "", เอเชีย: "A", ทั่วโลก: "W" },
      coverages: { เต็มจำนวน: "", Deductible: "D", "Co-Payment": "C" },
    };
    expect(plansFor(renamed, 35)).toHaveLength(6);
    expect(territoriesFor(renamed, "PLATINUM", 35)).toEqual(["ใน ปท.", "เอเชีย", "ทั่วโลก"]);
    expect(coveragesFor(renamed, "ใน ปท.", 35)).toEqual(["เต็มจำนวน", "Deductible", "Co-Payment"]);
  });

  it("offers nothing at an age the table does not reach", () => {
    // undefined past the end of a rate array is not a third kind of absence, and not a sale
    expect(plansFor(table, table.ageMax + 1)).toEqual([]);
    expect(plansFor(table, table.ageMin - 1)).toEqual([]);
    expect(plansFor(table, Number.NaN)).toEqual([]);
    expect(territoriesFor(table, "PLATINUM", table.ageMax + 1)).toEqual([]);
    expect(coveragesFor(table, "ประเทศไทย", table.ageMax + 1)).toEqual([]);
  });

  /**
   * Age by age, because a union across ages cannot see a filter that drops an arrangement at
   * one age and keeps it at another. The expectation is the whole cross-product of plan,
   * territory and coverage sieved through the rate table, so it is the company's answer
   * rather than the filters' own answer read back.
   */
  it("offers, at every age, exactly the arrangements the company sells at that age", () => {
    const reached = new Set<string>();
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      const offered: string[] = [];
      for (const p of plansFor(table, age)) {
        for (const t of territoriesFor(table, p.code, age)) {
          for (const c of coveragesFor(table, t, age)) {
            offered.push(`${p.code}|${t}|${c}`);
            reached.add(ihuKey(table, p.code, age, t, c)!);
          }
        }
      }
      const onSale: string[] = [];
      for (const p of table.plans) {
        for (const t of Object.keys(table.territories)) {
          for (const c of Object.keys(table.coverages)) {
            const key = ihuKey(table, p.code, age, t, c);
            if (key !== undefined && sold(key, age)) onSale.push(`${p.code}|${t}|${c}`);
          }
        }
      }
      expect(offered.sort(), `age ${age}`).toEqual(onSale.sort());
    }
    // and between them the ages reach every key the company sells: none is unofferable
    expect([...reached].sort()).toEqual(Object.keys(table.riderRates).sort());
  });
});

describe("iHealthyPricing", () => {
  it("prices the workbook's own example — หญิง 45 บรอนซ์ ประเทศไทย", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 45, sumAssured: 1_000_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(2_670_000);
  });

  /**
   * The browser's arithmetic is the page's only source of prices for the base plan and the
   * health rider, so it has to be the engine's arithmetic.
   */
  it("agrees with the engine in every mode across random arrangements", () => {
    const next = rng(SEED);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const base = pick(table.bases);
      const sex: Sex = pick(["M", "F"] as const);
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const plan = pick(plansFor(table, age));
      const territory = pick(territoriesFor(table, plan.code, age));
      const coverage = pick(coveragesFor(table, territory, age));
      const sumAssured = base.fixedSum ?? pick(SUMS);
      const choice = { base: base.variant, sex, age, sumAssured, plan: plan.code, territory, coverage };
      const priced = iHealthyPricing(table, choice);
      if (!priced) continue;
      checked++;
      for (const m of priced.total) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: base.variant, age, sex, mode: m.mode,
          basis: "sumAssured", sumAssured,
          riders: attachedAt(age, { code: "IHU", option: plan.code, territory, coverage }),
        }, WHILE_CURRENT);
        const label = `seed ${SEED} · ${base.variant} ${plan.code} ${territory} ${coverage} ${sex} ${age} ${sumAssured} ${m.mode}`;
        expect(q.totalModal, label).toBe(m.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label).toBe(m.belowMinimum);
      }
    }
    expect(checked).toBe(200);
  });

  /**
   * The company's monthly floor is out of reach now that the daily cash is attached as
   * standard: the cheapest thing this page can sell is 1,062 a month against a floor of
   * 1,000. So the cheapest is pinned, and the check itself is exercised against a floor
   * raised above it — otherwise `belowMinimum` would only ever be asserted false and could
   * be deleted unnoticed, which is how it slipped through once already.
   */
  it("judges the monthly floor on the whole total, and nothing dearer", () => {
    const cheapest = {
      base: "WLF99HX", sex: "M" as Sex, age: 18, sumAssured: 50_000,
      plan: "SMART", territory: "ประเทศไทย", coverage: "Deductible",
    };
    // 45 baht of base, 900 of health cover and 117 of daily cash
    const p = iHealthyPricing(table, cheapest)!;
    expect(p.total.find((m) => m.mode === "monthly")).toEqual({ mode: "monthly", total: 106_200, belowMinimum: false });
    const q = quote({
      planCode: "LIFEPROTECT", variant: cheapest.base, age: cheapest.age, sex: cheapest.sex, mode: "monthly",
      basis: "sumAssured", sumAssured: cheapest.sumAssured,
      riders: attachedAt(cheapest.age, {
        code: "IHU", option: cheapest.plan, territory: cheapest.territory, coverage: cheapest.coverage,
      }),
    }, WHILE_CURRENT);
    expect(q.totalModal).toBe(106_200);
    expect(q.warnings.some((w) => w.code === "MIN_MONTHLY")).toBe(false);

    // the same arrangement under a company that would not take 1,062
    const strict = iHealthyPricing({ ...table, minMonthly: 1_200 }, cheapest)!;
    expect(strict.total.find((m) => m.mode === "monthly")!.belowMinimum).toBe(true);
    expect(strict.total.filter((m) => m.belowMinimum).map((m) => m.mode)).toEqual(["monthly"]);
  });

  it("prices a child on the health package the way the engine does", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99HX", sex: "M", age: 8, sumAssured: 50_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.base.find((m) => m.mode === "annual")!.total).toBe(38_000);
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(3_860_000);
    // a child is sold the 500 plan of the daily cash, not the 1,000 the agency asks for
    expect(p.standard!.label).toBe("ค่าชดเชยรายวัน 500 บาท");
    expect(p.standard!.premiums.find((m) => m.mode === "annual")!.total).toBe(47_500);
    expect(p.total.find((m) => m.mode === "annual")!.total).toBe(3_945_500);
  });

  it("refuses a base the table does not carry rather than pricing a stale one", () => {
    // a real LIFEPROTECT variant (x 1.5), but not one this page sells
    const stale = {
      base: "WLF19L", sex: "F" as Sex, age: 35, sumAssured: 1_000_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    };
    expect(() => iHealthyPricing(table, stale)).toThrow("Unknown base: WLF19L");
    // and the cover figure does not answer where the premium panel cannot
    expect(() => deathBenefitOf(table, "WLF19L", 35, 1_000_000)).toThrow("Unknown base: WLF19L");
  });

  it("has no price for a combination the company does not sell", () => {
    expect(iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 1_000_000,
      plan: "GOLD", territory: "เอเชีย", coverage: "Full Coverage",
    })).toBeUndefined();
  });
});

describe("deathBenefitOf", () => {
  it("matches the engine on both sides of the booster age, on every base", () => {
    for (const base of table.bases) {
      const sumAssured = base.fixedSum ?? 1_000_000;
      for (const age of [35, 59, 60, 80]) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: base.variant, age, sex: "F", mode: "annual",
          basis: "sumAssured", sumAssured,
          riders: attachedAt(age, { code: "IHU", option: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage" }),
        }, WHILE_CURRENT);
        expect(deathBenefitOf(table, base.variant, age, sumAssured), `${base.variant} ${age}`)
          .toEqual(q.deathBenefit);
      }
    }
  });

  it("pays double before 60 and the sum alone from then on", () => {
    expect(deathBenefitOf(table, "WLF99H", 35, 1_000_000)).toEqual({
      beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false,
    });
    expect(deathBenefitOf(table, "WLF99H", 60, 1_000_000)).toEqual({
      beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true,
    });
  });
});
