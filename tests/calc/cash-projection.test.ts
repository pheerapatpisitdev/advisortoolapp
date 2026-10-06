import { describe, expect, it } from "vitest";
import { cashProjection } from "@/lib/cash-projection";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { deathBenefitOf, lifeProtectModes, payYears, termAt } from "@/lib/lifeprotect-quote";

const table = lifeProtectTable(new Date("2026-09-05"));
const SUM = 1_000_000;

/** ชาย · ทุน 1 ล้าน, on whichever payment term and issue age is asked for. */
function project(variant: string, withPrice = true, age = 35) {
  const term = termAt(table, variant);
  const factors = term.schedule.M[age - table.ageMin]!;
  const annualSatang = withPrice
    ? lifeProtectModes(table, term, { sex: "M", age, sumAssured: SUM })!
        .find((m) => m.mode === "annual")!.total
    : null;
  return cashProjection({
    factors, age, sumAssured: SUM, annualSatang,
    payYears: payYears(term, age), death: deathBenefitOf(table, age, SUM),
    topUp: { premiumPercent: 101, includeCashValue: true },
  });
}

describe("cashProjection · จ่าย 9 ปี", () => {
  const p = project("WLF09H");

  it("counts policy years, ages and surrender values off the company table", () => {
    expect(p.rows).toHaveLength(64);
    expect(p.maturityAge).toBe(99);
    expect(p.rows[0]).toEqual({
      policyYear: 1, age: 35, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 5_460_000, cashValue: 0,
    });
    expect(p.rows[8]).toEqual({
      policyYear: 9, age: 43, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 49_140_000, cashValue: 36_500_000,
    });
  });

  it("stops collecting premium once the paying term is over", () => {
    expect(p.rows[9]).toEqual({
      policyYear: 10, age: 44, cover: 200_000_000,
      premiumDue: 0, premiumPaid: 49_140_000, cashValue: 37_300_000,
    });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(49_140_000);
  });

  it("drops the cover to the sum assured at 60", () => {
    expect(p.rows.find((r) => r.age === 59)!.cover).toBe(200_000_000);
    expect(p.rows.find((r) => r.age === 60)!.cover).toBe(100_000_000);
  });

  it("breaks even in policy year 25, at 59", () => {
    expect(p.breakEven).toMatchObject({ policyYear: 25, age: 59, cashValue: 49_200_000 });
  });

  it("is worth nothing for the first year only", () => {
    expect(p.zeroYears).toBe(1);
  });
});

describe("cashProjection · the other two terms", () => {
  it("จ่าย 19 ปี breaks even in year 30 and is worth nothing for three years", () => {
    const p = project("WLF19H");
    expect(p.zeroYears).toBe(3);
    expect(p.breakEven).toMatchObject({ policyYear: 30, age: 64 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(54_530_000);
  });

  it("ถึงอายุ 99 breaks even in the last year and is worth nothing for eight", () => {
    const p = project("WLF99H");
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
    expect(p.breakEven).toMatchObject({ policyYear: 64, age: 98, cashValue: 111_200_000 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(110_080_000);
  });
});

/**
 * The company's proposal footnote: it pays the multiple of the sum assured, or the surrender
 * value, or 101% of the premiums paid on the base contract — whichever is greater.
 */
describe("cashProjection · the cover rises with what has been paid", () => {
  it("stays on the plain sum assured while that is still the biggest of the three", () => {
    const p = project("WLF99H");
    expect(p.coverFloor).toBe(100_000_000);
    expect(p.rows.find((r) => r.age === 59)!.cover).toBe(200_000_000);
    expect(p.rows.find((r) => r.age === 60)!.cover).toBe(100_000_000);
    expect(p.rows[56].cover).toBe(100_000_000);
  });

  it("follows 101% of the premiums once they overtake the sum assured", () => {
    const p = project("WLF99H");
    // ปีที่ 58: จ่ายไปแล้ว 997,600 — ร้อยละ 101 คือ 1,007,576 ซึ่งมากกว่าทุน 1 ล้าน
    expect(p.rows[57]).toMatchObject({ policyYear: 58, premiumPaid: 99_760_000, cover: 100_757_600 });
    expect(p.rows[58]).toMatchObject({ policyYear: 59, premiumPaid: 101_480_000, cover: 102_494_800 });
  });

  it("follows the surrender value when that is the biggest of the three", () => {
    const p = project("WLF99H");
    // ปีสุดท้าย: เวนคืน 1,112,000 ชนะทั้งทุน 1 ล้าน และ 101% ของเบี้ย 1,111,808
    expect(p.rows[63]).toMatchObject({ policyYear: 64, cashValue: 111_200_000, cover: 111_200_000 });
  });

  it("carries an old buyer's cover far above the sum assured", () => {
    const p = project("WLF19H", true, 80);
    expect(p.coverFloor).toBe(100_000_000);
    expect(p.rows[5]).toMatchObject({ policyYear: 6, age: 85, premiumPaid: 111_000_000, cover: 112_110_000 });
    expect(p.rows[18]).toMatchObject({ policyYear: 19, age: 98, cashValue: 355_000_000, cover: 355_015_000 });
  });
});

describe("cashProjection when no price may be shown", () => {
  const p = project("WLF99H", false);

  it("carries no premium and no break-even, but still the surrender values", () => {
    expect(p.rows.every((r) => r.premiumDue === null && r.premiumPaid === null)).toBe(true);
    expect(p.breakEven).toBeNull();
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
  });

  it("still lifts the cover to the surrender value, which needs no price", () => {
    expect(p.rows[63].cover).toBe(111_200_000);
    expect(p.rows.find((r) => r.age === 59)!.cover).toBe(200_000_000);
  });
});

/**
 * iShield's own rule, from the sheet that draws its benefit table: the cover is the greater
 * of the sum assured and the premiums paid, and the surrender value is not one of the
 * amounts compared.
 *
 *   F = IF(year + issueAge <= 85, MAX(previous, IF(premiums > sumAssured, premiums, sumAssured)), 0)
 */
describe("cashProjection · a plan whose top-up leaves the surrender value out", () => {
  const flat = { beforeAge: 0, sumBefore: 500_000, sumFrom: 500_000, alreadyPastAge: true };
  const input = {
    // three years of factors per thousand: nothing, then 14, then 46
    factors: [0, 14, 46], age: 11, sumAssured: 500_000,
    annualSatang: 2_210_500, payYears: 10, death: flat,
    topUp: { premiumPercent: 100, includeCashValue: false },
  };

  it("reads the company's own first three years back", () => {
    const p = cashProjection(input);
    expect(p.rows.map((r) => r.cashValue)).toEqual([0, 700_000, 2_300_000]);
    expect(p.rows.map((r) => r.premiumPaid)).toEqual([2_210_500, 4_421_000, 6_631_500]);
    expect(p.rows.map((r) => r.cover)).toEqual([50_000_000, 50_000_000, 50_000_000]);
    expect(p.coverFloor).toBe(50_000_000);
  });

  it("leaves the surrender value out, even once it passes the sum assured", () => {
    // thirty years of factors, paid for ten: the surrender value climbs past the sum, the
    // premiums never do
    const grown = { ...input, factors: Array.from({ length: 30 }, (_, i) => i * 40) };
    const p = cashProjection(grown);
    expect(p.rows[29].cashValue).toBe(58_000_000);
    expect(p.rows[29].premiumPaid).toBe(22_105_000);
    expect(p.rows[29].cover).toBe(50_000_000);
    expect(p.rows[29].cover).toBeLessThan(p.rows[29].cashValue);
  });

  it("lifts the cover to the premiums paid, at 100% rather than 101%", () => {
    // the same contract paid for all thirty years: 23 × 22,105 = 508,415 passes the sum
    const paidThroughout = {
      ...input, payYears: 30, factors: Array.from({ length: 30 }, (_, i) => i * 40),
    };
    const p = cashProjection(paidThroughout);
    expect(p.rows[21]).toMatchObject({ policyYear: 22, premiumPaid: 48_631_000, cover: 50_000_000 });
    expect(p.rows[22]).toMatchObject({ policyYear: 23, premiumPaid: 50_841_500, cover: 50_841_500 });
  });
});

describe("cashProjection · with riders", () => {
  const term = termAt(table, "WLF09H");
  const age = 35;
  const factors = term.schedule.M[age - table.ageMin]!;
  const annualSatang = lifeProtectModes(table, term, { sex: "M", age, sumAssured: SUM })!
    .find((m) => m.mode === "annual")!.total;
  const base = {
    factors, age, sumAssured: SUM, annualSatang, payYears: payYears(term, age),
    death: deathBenefitOf(table, age, SUM), topUp: { premiumPercent: 101, includeCashValue: true },
  };
  const alone = cashProjection(base);
  // a rider of 1,000 a year for the first twelve years: three past the plan's own nine
  const riderDue = Array.from({ length: 12 }, () => 100_000);
  const withRiders = cashProjection({ ...base, riderDue });

  it("keeps what the riders cost beside the plan's premium, and adds it to what has been paid", () => {
    expect(withRiders.rows[0]).toMatchObject({ premiumDue: annualSatang, riderDue: 100_000 });
    expect(withRiders.rows[10]).toMatchObject({ premiumDue: 0, riderDue: 100_000 });
    expect(withRiders.rows[12]).toMatchObject({ premiumDue: 0, riderDue: 0 });
    expect(withRiders.rows[20].premiumPaid).toBe(alone.rows[20].premiumPaid! + 1_200_000);
  });

  it("has no rider column at all without riders", () => {
    expect(alone.rows.some((r) => "riderDue" in r)).toBe(false);
  });

  /** The contract tops the cover up off the plan's own premiums; a rider's buy no extra cover. */
  it("leaves the cover as the plan alone would have it", () => {
    expect(withRiders.rows.map((r) => r.cover)).toEqual(alone.rows.map((r) => r.cover));
  });

  it("breaks even against everything paid, riders included", () => {
    expect(withRiders.breakEven!.policyYear).toBeGreaterThanOrEqual(alone.breakEven!.policyYear);
    expect(withRiders.breakEven!.cashValue).toBeGreaterThanOrEqual(withRiders.breakEven!.premiumPaid!);
  });
});
