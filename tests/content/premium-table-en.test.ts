import { describe, expect, it } from "vitest";
import { EXPAT_NUMBERS_PLANS, NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import {
  hasLadder, headlineFigures, headlineOwner, otherPeople, premiumTable, premiumTableOf, restatedFigures, tableCells, tableText,
} from "@/lib/content/premium-table";

/**
 * The English premium table of an Expat Page's iHealthy Ultra campaign (spec 2026-10-06): the
 * same rungs and the same engine as the Thai one, so every figure is the Thai table's, said in
 * English — whole THB with commas, "about N a month" the year ÷ 12 rounded up.
 */

const today = new Date("2026-10-06");
const HREF = "/ihealthy-ultra";

describe("the English iHealthy ladder", () => {
  it("has the Thai ladder's rungs; no other plan has an English one", () => {
    expect(EXPAT_NUMBERS_PLANS[HREF].ladder?.rungs).toBe(NUMBERS_PLANS[HREF].ladder?.rungs);
    expect(hasLadder(HREF, "en")).toBe(true);
    expect(hasLadder("/lifeprotect", "en")).toBe(false);
    expect(premiumTable("/lifeprotect", 30, today, "en")).toBeNull();
  });

  it.each([6, 18, 30, 45, 60, 75, 80])("prices every rung and sex as the Thai table does at %i", (age) => {
    const th = premiumTable(HREF, age, today)!;
    const en = premiumTable(HREF, age, today, "en")!;
    expect(th, `th ${age}`).not.toBeNull();
    expect(en.lang).toBe("en");
    expect(en.rows.map((r) => [r.female, r.male])).toEqual(th.rows.map((r) => [r.female, r.male]));
    expect(tableCells(en)).toEqual(tableCells(th));
    expect(en.age).toBe(th.age);
    expect(en.firstYear).toBe(th.firstYear);
  });

  it("leaves the Thai table as it was: no lang on it", () => {
    const th = premiumTable(HREF, 30, today)!;
    expect(th.lang).toBeUndefined();
    expect(premiumTable(HREF, 30, today, "th")).toEqual(th);
    expect(tableText(th)).toContain("🙆‍♀️ หญิง = 19,415 บาท/ปี (ตกเดือนละ 1,618)");
  });
});

describe("the English table's words", () => {
  const t = premiumTable(HREF, 30, today, "en")!;

  it("are the golden text at 30", () => {
    expect(tableText(t)).toBe([
      "First-year premium · renewable up to age 98 (age 30)",
      "",
      "Medical cover up to THB 3,000,000 a year",
      "(A package with life cover of THB 50,000 and daily cash)",
      "🙆‍♀️ Female = 19,415 THB/yr (about 1,618 a month)",
      "🕵️‍♂️ Male = 16,720 THB/yr (about 1,394 a month)",
      "",
      "Medical cover up to THB 10,000,000 a year",
      "(A package with life cover of THB 50,000 and daily cash)",
      "🙆‍♀️ Female = 22,715 THB/yr (about 1,893 a month)",
      "🕵️‍♂️ Male = 19,420 THB/yr (about 1,619 a month)",
      "",
      "Medical cover up to THB 15,000,000 a year",
      "(A package with life cover of THB 50,000 and daily cash)",
      "🙆‍♀️ Female = 33,915 THB/yr (about 2,827 a month)",
      "🕵️‍♂️ Male = 29,020 THB/yr (about 2,419 a month)",
      "",
      "Medical cover up to THB 25,000,000 a year",
      "(A package with life cover of THB 50,000 and daily cash)",
      "🙆‍♀️ Female = 43,415 THB/yr (about 3,618 a month)",
      "🕵️‍♂️ Male = 37,020 THB/yr (about 3,085 a month)",
    ].join("\n"));
  });

  it("head the ad with the picked row and sex: the middle row and a woman by default", () => {
    expect(headlineFigures(t)).toBe([
      "iHealthy Ultra",
      "💁‍♀️ Medical cover up to THB 10,000,000 a year (A package with life cover of THB 50,000 and daily cash)",
      "💰 First-year premium 22,715 THB/yr (about 1,893 a month) (Female, 30)",
    ].join("\n"));
    expect(headlineFigures(t, { sex: "M", rung: 3 }).split("\n")[2]).toBe("💰 First-year premium 37,020 THB/yr (about 3,085 a month) (Male, 30)");
    expect(headlineOwner(t, { sex: "F", rung: 3 })).toEqual({
      sex: "F", rung: 3, heading: "Medical cover up to THB 25,000,000 a year",
      line: "Female, 30 · Medical cover up to THB 25,000,000 a year (A package with life cover of THB 50,000 and daily cash)",
    });
  });

  it("say satang when a premium has them", () => {
    const plan = {
      ...EXPAT_NUMBERS_PLANS[HREF],
      ladder: {
        term: "renewable up to age 98", firstYear: false, rungs: 1,
        price: () => ({ product: "X", sumLine: "Cover", premiumLine: "", perDayLine: "", claims: [], annualSatang: 217_629, who: "", poster: { big: "", small: "" } }),
      },
    };
    const s = premiumTableOf(plan, 40, today, "en")!;
    expect(tableText(s)).toBe("Renewable up to age 98 (age 40)\n\nCover\n🙆‍♀️ Female = 2,176.29 THB/yr (about 182 a month)\n🕵️‍♂️ Male = 2,176.29 THB/yr (about 182 a month)");
    expect(headlineFigures(s).split("\n")[2]).toBe("💰 Premium 2,176.29 THB/yr (about 182 a month) (Female, 40)");
  });

  it("hold the writer's own words to the English premium and person phrases", () => {
    expect(restatedFigures("Only 89 THB a day for peace of mind", "", t)).toEqual(["89 THB"]);
    expect(restatedFigures("Cover up to THB 10,000,000 a year", "", t)).toEqual([]);
    expect(otherPeople("Perfect for a 35-year-old woman", "F", 30, "en")).toEqual(["35-year-old woman"]);
    expect(otherPeople("Perfect for a 30-year-old woman", "F", 30, "en")).toEqual([]);
  });
});
