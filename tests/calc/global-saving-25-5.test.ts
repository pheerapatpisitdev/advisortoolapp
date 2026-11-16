import { describe, expect, it } from "vitest";
import {
  deathBonusShare, premiumFromSa, quoteGlobalSaving255, saFromPremium,
} from "@/calc/global-saving/engine-25-5";

/**
 * The figures AdvisorZone 6.33 showed for this plan on 2026-11-16: male, entry age 2, sum
 * 100,000, premium 99,500 a year. The engine has to land on the company's own illustration.
 */
describe("Global Savings Plus 25/5, against AdvisorZone's illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 2 });
  const low = q.scenarios[0];

  it("charges 99,500 a year for 100,000 and 990 per 1,000 from 500,000", () => {
    expect(q.premium).toBe(99_500);
    expect(premiumFromSa(1_000_500, 2)).toBeCloseTo(990_495, 6);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("pays 1,000 a year for 24 years and 501,000 at maturity: 525% in all", () => {
    expect(low.rows.slice(0, 24).every((r) => r.payback === 1_000)).toBe(true);
    expect(low.rows[24].payback).toBeCloseTo(501_000, 6);
    expect(q.guaranteed).toBeCloseTo(525_000, 6);
  });

  it("steps the death benefit 102% of premiums, 315%, 420%, then 535% of the sum", () => {
    expect(low.rows.slice(0, 6).map((r) => Math.round(r.death)))
      .toEqual([101_490, 202_980, 315_000, 420_000, 535_000, 535_000]);
    expect(Math.round(low.rows[24].death)).toBe(535_000);
  });

  it("reads the surrender column as shown", () => {
    const at = (y: number) => Math.round(low.rows[y - 1].surrender);
    expect([1, 2, 3, 4, 5, 10, 15, 20, 25].map(at))
      .toEqual([0, 0, 71_000, 170_700, 293_600, 334_500, 381_800, 436_500, 501_000]);
  });

  it("returns 0.24% a year when the index falls 1% a year, with no bonus", () => {
    expect(low.bonuses.every((b) => b.value === 0)).toBe(true);
    expect(low.irr.toFixed(2)).toBe("0.24");
  });
});

/** The same screen at entry age 66, sum 1,000,000: the senior rate and its own surrender column. */
describe("from age 66, against AdvisorZone's illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 1_000_000, age: 66 });
  const low = q.scenarios[0];

  it("charges 1,000 per 1,000 of sum, where 65 pays 990", () => {
    expect(q.premium).toBe(1_000_000);
    expect(premiumFromSa(1_000_000, 65)).toBe(990_000);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("keeps the same death steps on the dearer premium", () => {
    expect(low.rows.slice(0, 5).map((r) => Math.round(r.death)))
      .toEqual([1_020_000, 2_040_000, 3_150_000, 4_200_000, 5_350_000]);
  });

  it("reads its own surrender column", () => {
    const at = (y: number) => Math.round(low.rows[y - 1].surrender);
    expect([1, 2, 3, 4, 5, 10, 15, 20, 24, 25].map(at))
      .toEqual([0, 410_000, 1_362_000, 2_408_000, 3_675_000, 3_998_000, 4_324_000, 4_619_000, 4_909_000, 5_010_000]);
  });

  it("returns 0.22% a year when the index falls 1% a year", () => {
    expect(low.irr.toFixed(2)).toBe("0.22");
  });
});

/** Entry age 65, sum 200,000, example 2 (index +3% a year): still the younger rate, and every index figure. */
describe("at age 65 with the index at 3%, against AdvisorZone's illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 200_000, age: 65 });
  const mid = q.scenarios[2];
  const row = (y: number) => mid.rows[y - 1];

  it("still charges 995 per 1,000", () => {
    expect(q.premium).toBe(199_000);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("pays the bonuses the illustration shows", () => {
    expect(mid.bonuses.map((b) => b.value)).toEqual([15_398.84, 49_965.95, 108_280.86, 685_634.74]);
    expect(mid.irr.toFixed(2)).toBe("3.02");
  });

  it("adds the index share to death from year 2 and to surrender from year 6", () => {
    expect(row(2).death + row(2).deathBonus).toBeCloseTo(427_774.38, 2);
    expect(row(5).death + row(5).deathBonus).toBeCloseTo(1_212_629.87, 2);
    expect(row(5).surrender + row(5).surrenderBonus).toBeCloseTo(724_200, 6);
    expect(row(6).surrender + row(6).surrenderBonus).toBeCloseTo(739_137.74, 2);
  });

  it("reads its own surrender column", () => {
    expect([2, 3, 4, 5, 10, 15, 20, 24, 25].map((y) => Math.round(row(y).surrender)))
      .toEqual([62_800, 253_800, 466_400, 724_200, 790_200, 856_800, 920_400, 981_000, 1_002_000]);
  });
});

/** A woman of 30, sum 200,000: the same premium as a man, and a surrender column of her own age. */
describe("at age 30, against AdvisorZone's illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 200_000, age: 30 });
  const low = q.scenarios[0];

  it("charges 995 per 1,000 and returns 0.24% when the index falls", () => {
    expect(q.premium).toBe(199_000);
    expect(low.irr.toFixed(2)).toBe("0.24");
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("reads its own surrender column", () => {
    expect([2, 3, 4, 5, 10, 15, 20, 23].map((y) => Math.round(low.rows[y - 1].surrender)))
      .toEqual([0, 143_000, 342_600, 588_400, 669_800, 764_000, 873_200, 947_000]);
  });
});

/**
 * The printed illustration for a man of 40, sum 100,000 (the owner's 40.pdf, AdvisorZone 6.33,
 * 2026-11-16): all three examples, with the bonus worked through to the satang.
 */
describe("at age 40, against the printed illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 40 });
  const [low, , mid, , high] = q.scenarios;

  it("returns 0.24%, 3.02% and 5.04% a year", () => {
    expect(q.premium).toBe(99_500);
    expect([low, mid, high].map((s) => s.irr.toFixed(2))).toEqual(["0.24", "3.02", "5.04"]);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("pays the bonuses at the end of years 10, 15, 20 and at maturity, to the satang", () => {
    expect(low.bonuses.map((b) => b.value)).toEqual([0, 0, 0, 0]);
    expect(mid.bonuses.map((b) => [b.year, b.share, b.value]))
      .toEqual([[10, 0.05, 7_699.42], [15, 0.1, 24_982.97], [20, 0.15, 54_140.43], [25, 0.7, 342_817.37]]);
    expect(high.bonuses.map((b) => b.value)).toEqual([14_079.39, 48_309.0, 111_039.63, 747_943.32]);
  });

  it("totals what the summary table shows", () => {
    expect(q.guaranteed).toBeCloseTo(525_000, 6);
    expect(mid.total).toBeCloseTo(954_640.19, 2);
    expect(high.total).toBeCloseTo(1_446_371.34, 2);
  });

  it("adds the index share to the death benefit from year 2", () => {
    const withBonus = (y: number) => mid.rows[y - 1].death + mid.rows[y - 1].deathBonus;
    expect(mid.rows[0].deathBonus).toBe(0);
    // death in year 4: the four premiums paid so far, in full
    expect(mid.rows[3].deathBonus).toBe(44_957.32);
    expect([2, 5, 10, 11, 16, 21, 25].map((y) => withBonus(y).toFixed(2)))
      .toEqual(["213887.19", "606314.93", "688988.39", "698438.73", "765143.54", "804637.96", "877817.37"]);
    expect([1, 2, 10, 11, 15, 16, 20, 21, 25].map(deathBonusShare)).toEqual([0, 1, 1, 0.95, 0.95, 0.85, 0.85, 0.7, 0.7]);
  });

  it("adds it to the surrender value only from year 6", () => {
    const withBonus = (y: number) => mid.rows[y - 1].surrender + mid.rows[y - 1].surrenderBonus;
    expect(mid.rows[4].surrenderBonus).toBe(0);
    expect(mid.rows[16].surrenderBonus).toBe(35_077.52);
    expect([5, 6, 10, 17, 20, 21, 24, 25].map((y) => withBonus(y).toFixed(2)))
      .toEqual(["300200.00", "308468.87", "347299.42", "440377.52", "492140.43", "565159.13", "787381.78", "843817.37"]);
    expect(high.rows[16].surrenderBonus).toBe(69_420.13);
  });

  it("reads its own surrender column", () => {
    expect([1, 2, 3, 4, 5, 10, 15, 20, 24, 25].map((y) => Math.round(low.rows[y - 1].surrender)))
      .toEqual([0, 2_300, 76_600, 176_900, 300_200, 339_600, 385_100, 438_000, 486_800, 501_000]);
  });
});

/** The printed illustration for a man of 50, sum 100,000 (the owner's 50.pdf): 40's premium and bonuses, its own surrender column. */
describe("at age 50, against the printed illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 50 });
  const [low, , , , high] = q.scenarios;

  it("charges 99,500 and returns 0.24% and 5.04%", () => {
    expect(q.premium).toBe(99_500);
    expect([low, high].map((s) => s.irr.toFixed(2))).toEqual(["0.24", "5.04"]);
    expect([0, 2, 4].map((i) => q.scenarios[i].total.toFixed(2))).toEqual(["525000.00", "954640.19", "1446371.34"]);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("reads its own surrender column, with and without the index share", () => {
    expect([1, 2, 3, 4, 5, 10, 15, 20, 24, 25].map((y) => Math.round(low.rows[y - 1].surrender)))
      .toEqual([0, 7_400, 84_700, 185_900, 310_100, 348_400, 391_800, 441_300, 487_300, 501_000]);
    const withBonus = (y: number) => high.rows[y - 1].surrender + high.rows[y - 1].surrenderBonus;
    expect([6, 17, 21, 25].map((y) => withBonus(y).toFixed(2))).toEqual(["318922.78", "480220.13", "692099.48", "1248943.32"]);
  });
});

/** The printed illustration for a man of 70, sum 100,000 (the owner's 70.pdf): the senior rate at a small sum. */
describe("at age 70, against the printed illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 70 });
  const [low, , mid, , high] = q.scenarios;

  it("charges 1,000 per 1,000 with no size discount, and returns 0.22% and 3.01%", () => {
    expect(q.premium).toBe(100_000);
    expect([low, mid].map((s) => s.irr.toFixed(2))).toEqual(["0.22", "3.01"]);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("pays the bonuses and totals the summary table shows", () => {
    expect(mid.bonuses.map((b) => b.value)).toEqual([7_738.11, 25_108.52, 54_412.49, 344_540.07]);
    expect(mid.total).toBeCloseTo(956_799.19, 2);
    expect(high.total).toBeCloseTo(1_451_001.35, 2);
  });

  it("reads its own surrender column, with and without the index share", () => {
    expect([1, 2, 3, 4, 5, 10, 15, 20, 24, 25].map((y) => Math.round(low.rows[y - 1].surrender)))
      .toEqual([0, 64_200, 155_600, 261_900, 390_300, 419_700, 445_400, 470_200, 492_700, 501_000]);
    const withBonus = (y: number) => mid.rows[y - 1].surrender + mid.rows[y - 1].surrenderBonus;
    expect([6, 17, 21, 25].map((y) => withBonus(y).toFixed(2))).toEqual(["397073.23", "490353.79", "591439.83", "845540.07"]);
    expect((mid.rows[1].death + mid.rows[1].deathBonus).toFixed(2)).toBe("214962.00");
  });
});

/** The printed illustrations for men of 55 and 60, sum 100,000 (55.pdf, 60.pdf): the surrender column on the way up to 65. */
describe("at ages 55 and 60, against the printed illustrations", () => {
  const at = (age: number) => {
    const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age });
    expect(q.premium).toBe(99_500);
    expect(q.scenarios[0].irr.toFixed(2)).toBe("0.24");
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
    return [1, 2, 3, 4, 5, 10, 15, 20, 24, 25].map((y) => Math.round(q.scenarios[0].rows[y - 1].surrender));
  };

  it("read their own surrender columns", () => {
    expect(at(55)).toEqual([0, 12_700, 93_200, 195_400, 320_600, 357_800, 398_800, 444_800, 487_800, 501_000]);
    expect(at(60)).toEqual([0, 21_500, 107_200, 211_100, 337_900, 373_400, 411_000, 452_300, 489_200, 501_000]);
  });
});

/** The printed illustration for a man of 75, sum 200,000 (75.pdf, plan code E25G5AS): the oldest entry age. */
describe("at age 75, against the printed illustration", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 200_000, age: 75 });
  const [low, , , , high] = q.scenarios;

  it("charges 200,000 and returns 0.22% and 5.03%", () => {
    expect(q.premium).toBe(200_000);
    expect([low, high].map((s) => s.irr.toFixed(2))).toEqual(["0.22", "5.03"]);
    expect(high.bonuses.map((b) => b.value)).toEqual([28_300.28, 97_103.52, 223_195.23, 1_503_403.65]);
    expect(q.warnings.concat(q.notes)).toHaveLength(0);
  });

  it("has a surrender value from year 1, above the maturity amount in year 24", () => {
    expect([1, 2, 3, 4, 5, 10, 15, 20, 23, 24, 25].map((y) => Math.round(low.rows[y - 1].surrender)))
      .toEqual([34_200, 169_400, 359_600, 576_200, 837_000, 885_400, 929_800, 970_600, 1_000_400, 1_014_400, 1_002_000]);
    const withBonus = (y: number) => high.rows[y - 1].surrender + high.rows[y - 1].surrenderBonus;
    expect([6, 17, 24, 25].map((y) => withBonus(y).toFixed(2))).toEqual(["850860.86", "1085737.94", "2316083.50", "2505403.65"]);
    expect([2, 5, 21].map((y) => (high.rows[y - 1].death + high.rows[y - 1].deathBonus).toFixed(2)))
      .toEqual(["444900.00", "1318653.80", "2195156.69"]);
  });
});

describe("the two returns the company does not print", () => {
  const q = quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 40 });

  it("sit between the printed ones, by the same formula", () => {
    expect(q.scenarios.map((s) => s.rate)).toEqual([-0.01, 0.02, 0.03, 0.04, 0.05]);
    const totals = q.scenarios.map((s) => s.total);
    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
    const irrs = q.scenarios.map((s) => s.irr);
    expect([...irrs].sort((a, b) => a - b)).toEqual(irrs);
    // 2% a year for 10 years: the level cut to four places is 121.8994
    expect(q.scenarios[1].bonuses[0].value).toBe(Math.round(Math.round(497_500 * 0.218994 * 0.9 * 100) / 100 * 0.05 * 100) / 100);
  });
});

describe("against a bank", () => {
  it("compounds the five premiums to the end of year 25", () => {
    const [saving, fixed] = quoteGlobalSaving255({ basis: "premium", amount: 100_000, age: 40 }).banks;
    expect(saving.principal).toBe(500_000);
    expect(saving.total).toBeCloseTo([25, 24, 23, 22, 21].reduce((s, n) => s + 100_000 * Math.pow(1.0025, n), 0), 6);
    expect(fixed.total).toBeGreaterThan(saving.total);
  });
});

describe("premium and sum", () => {
  it("go round trip through the rate bands", () => {
    for (const age of [0, 35, 66, 75]) {
      for (const sa of [60_000, 300_000, 1_000_000]) {
        expect(saFromPremium(premiumFromSa(sa, age), age)).toBeCloseTo(sa, 6);
      }
    }
  });

  it("warns outside the sum limits and where a figure is not confirmed", () => {
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 19_999, age: 2 }).warnings.join()).toContain("20,000");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 20_000_001, age: 2 }).warnings.join()).toContain("20,000,000");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 150_000, age: 72 }).warnings.join()).toContain("200,000");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 35 }).notes.join()).toContain("ตารางอายุ 30 ปี");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 64 }).notes.join()).toContain("ตารางอายุ 60 ปี");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 50_000, age: 40 }).notes.join()).toContain("ยังไม่ได้ยืนยัน");
    expect(quoteGlobalSaving255({ basis: "sumAssured", amount: 100_000, age: 35 }).warnings).toHaveLength(0);
  });
});
