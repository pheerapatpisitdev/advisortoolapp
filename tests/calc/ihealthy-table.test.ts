import { describe, expect, it } from "vitest";
import { getPlan } from "@/calc/plans/registry";
import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import { iHealthyTable } from "@/lib/ihealthy-table";
import type { Sex } from "@/calc/types";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-12");
const SEXES = ["M", "F"] as const;
/** ages 6 to 80, the range the rider is issued over */
const AGE_COUNT = 75;

/** Every key the workbook prices, sorted; only 28 of the 108 the letters can spell exist. */
const KEYS = [
  "MHP1J", "MHP1S", "MHP2J", "MHP2S", "MHP3S", "MHP4S",
  "MHP5S", "MHP5SA", "MHP5SW", "MHP6S", "MHP6SA", "MHP6SW",
  "MHPC1J", "MHPC1S", "MHPC2J", "MHPC2S", "MHPC3S", "MHPC4S", "MHPC5S", "MHPC6S",
  "MHPD1J", "MHPD1S", "MHPD2J", "MHPD2S", "MHPD3S", "MHPD4S", "MHPD5S", "MHPD6S",
];

describe("iHealthyTable", () => {
  it("offers the bases the page sells, in order", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    // x 1.5 is deliberately absent: the rate table still carries it and the back-office
    // calculator still sells it, but this page does not offer that choice
    expect(t.bases.map((b) => [b.variant, b.group, b.short, b.booster, b.fixedSum, b.saMin])).toEqual([
      ["WLF99H", "WLF99H", "x 2", 1, undefined, 150_000],
      ["WLF99HX", "WLF99HX", "แพ็กเกจสุขภาพ", 1, 50_000, 50_000],
      ["WLF09H", "WLF99H", "x 2", 1, undefined, 150_000],
      ["WLF19H", "WLF99H", "x 2", 1, undefined, 150_000],
    ]);
    // the package pins the sum, so its button subtitle comes from fixedSum rather than prose
    expect(t.bases.map((b) => b.note)).toEqual(["ตั้งทุนเอง", undefined, "ตั้งทุนเอง", "ตั้งทุนเอง"]);
  });

  it("says how long each base is paid for (owner, 2026-11-16)", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    expect(t.bases.map((b) => [b.variant, b.payYears, b.payToAge, b.label])).toEqual([
      ["WLF99H", undefined, 99, "ไลฟ์ โพรเทค+ x 2"],
      ["WLF99HX", undefined, 99, "Health Ultra Package"],
      ["WLF09H", 9, undefined, "ไลฟ์ โพรเทค+ x 2 จ่าย 9 ปี"],
      ["WLF19H", 19, undefined, "ไลฟ์ โพรเทค+ x 2 จ่าย 19 ปี"],
    ]);
  });

  it("takes the age range from the health rider, not the base plan", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    // the base plan issues from birth; the rider does not, and nothing here sells without it
    expect(t.ageMin).toBe(6);
    expect(t.ageMax).toBe(80);
  });

  it("says which plan it prices and which rate table it priced from", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      planCode: "LIFEPROTECT", ageMin: 6, ageMax: 80, juvenileBelowAge: 11,
      expired: false, expiresOn: "2027-03-31", rateVersion: "A2026-1",
      minMonthly: 1000, boosterBeforeAge: 60,
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    // the engine's own switch, not a copy of it
    expect(t.juvenileBelowAge).toBe(JUVENILE_BELOW_AGE);
  });

  it("carries the letters the rate key is spelled from", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    // the default of each is the empty letter, so a truthiness check would drop it
    expect(t.territories).toEqual({ ประเทศไทย: "", เอเชีย: "A", ทั่วโลก: "W" });
    expect(t.coverages).toEqual({ "Full Coverage": "", Deductible: "D", "Co-Payment": "C" });
  });

  it("carries the six plans, numbered the way the rate keys number them", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    expect(t.plans.map((p) => [p.code, p.name, p.planNo, p.annualMax, p.deductible])).toEqual([
      ["SMART", "สมาร์ท", 1, 3_000_000, 30_000],
      ["BRONZE", "บรอนซ์", 2, 10_000_000, 30_000],
      ["SILVER", "ซิลเวอร์", 3, 15_000_000, 50_000],
      ["GOLD", "โกลด์", 4, 25_000_000, 50_000],
      ["DIAMOND", "ไดมอนด์", 5, 70_000_000, 100_000],
      ["PLATINUM", "แพลทินั่ม", 6, 100_000_000, 100_000],
    ]);
  });

  it("holds a rate for every key the workbook has and nothing else", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    expect(Object.keys(t.riderRates).sort()).toEqual(KEYS);
    for (const key of KEYS) {
      for (const sex of SEXES) expect(t.riderRates[key]![sex], `${key} ${sex}`).toHaveLength(AGE_COUNT);
    }
  });

  /**
   * The page's filters offer a plan before the customer has said who they are, so they read
   * one sex and trust it for both. That holds only while the company charges a man and a
   * woman at every age it sells a key at — if a revision ever splits them, this fails and
   * the filters need the sex rather than quietly offering a plan with no price behind it.
   */
  it("sells every key to both sexes at the same ages", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    for (const key of KEYS) {
      const rates = t.riderRates[key]!;
      const agesFor = (sex: Sex) =>
        rates[sex].map((r, i) => (r === null ? null : i + t.ageMin)).filter((a) => a !== null);
      expect(agesFor("F"), key).toEqual(agesFor("M"));
    }
  });

  it("reads the rider premium by key, sex and age", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    const premium = (key: string, sex: Sex, age: number) => t.riderRates[key]![sex][age - t.ageMin];
    // แพลทินั่ม หญิง 35 in Thailand is 170,500 a year in the workbook
    expect(premium("MHP6S", "F", 35)).toBe(170_500);
    expect(premium("MHP2S", "F", 45)).toBe(26_700);
    // the juvenile table is the only one that sells at 6
    expect(premium("MHP1J", "M", 6)).toBe(46_700);
    expect(premium("MHP6S", "F", 8)).toBeNull();
  });

  it("carries the base rate per thousand for each variant", () => {
    const t = iHealthyTable(WHILE_CURRENT);
    const rates = getPlan("LIFEPROTECT")!.rates;
    for (const base of t.bases) {
      for (const sex of SEXES) {
        expect(base.rates[sex], base.variant).toHaveLength(AGE_COUNT);
        expect(base.rates[sex].every((r) => typeof r === "number"), base.variant).toBe(true);
        for (const age of [6, 35, 80]) {
          expect(base.rates[sex][age - t.ageMin], `${base.variant} ${sex} ${age}`)
            .toBe(rates.base.rates[base.variant][sex][String(age)]);
        }
      }
    }
  });

  it("re-asks the expiry on every call rather than latching it", () => {
    expect(iHealthyTable(WHILE_CURRENT).expired).toBe(false);
    expect(iHealthyTable(new Date("2027-04-01")).expired).toBe(true);
    expect(iHealthyTable(WHILE_CURRENT).expired).toBe(false);
  });
});
