import { describe, expect, it } from "vitest";
import { EXPAT_NUMBERS_PLANS, NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import {
  hasLadder, headlineFigures, headlineOwner, otherPeople, premiumTable, premiumTableOf, restatedFigures, tableCells, tableText,
} from "@/lib/content/premium-table";
import { IHEALTHY_RUNGS } from "@/lib/content/ihealthy-ad";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { baseAt, iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { displayPremium } from "@/lib/legacy-cta";

/**
 * The English premium table of an Expat Page's iHealthy Ultra campaign (spec 2026-10-06): the
 * same rungs and the same engine as the Thai one, so every figure is the Thai table's, said in
 * English — whole THB with commas, then the engine's monthly-mode premium (owner, 2026-10-06)
 * where the company takes it monthly, and no month at all where it does not.
 */

const today = new Date("2026-10-06");
const HREF = "/ihealthy-ultra";

/** the Health Ultra Package's monthly-mode premium for a rung, in baht, as the engine prices it; null under the floor */
function ihMonth(rung: number, sex: "F" | "M", age: number): number | null {
  const table = iHealthyTable(today);
  const base = baseAt(table, "WLF99HX");
  const priced = iHealthyPricing(table, {
    base: "WLF99HX", sex, age, sumAssured: base.fixedSum ?? base.saMin, plan: IHEALTHY_RUNGS[rung],
    territory: IHEALTHY_OPENING.territory, coverage: IHEALTHY_OPENING.coverage,
  });
  const shown = displayPremium(priced?.total, false);
  return shown?.mode === "monthly" ? shown.total / 100 : null;
}
const n = (x: number) => x.toLocaleString("en-US", Number.isInteger(x) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** an English cell's figures: the year, then the month where there is a monthly mode */
const yearEn = (annual: number, month: number | null) => `${n(annual)} THB/yr${month === null ? "" : ` (${n(month)} THB a month)`}`;

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
    const month = ihMonth(0, "F", 30);
    expect(tableText(th)).toContain(`🙆‍♀️ หญิง = 19,415 บาท/ปี${month === null ? "" : ` (ตกเดือนละ ${n(month)})`}`);
  });
});

describe("iHealthy's table says no pay or cover period (owner, 2026-10-06)", () => {
  it("heads with the first-year premium and the age only, in both languages", () => {
    const today = new Date("2026-10-06");
    expect(tableText(premiumTable("/ihealthy-ultra", 30, today, "en")!).split("\n")[0]).toBe("First-year premium (age 30)");
    expect(tableText(premiumTable("/ihealthy-ultra", 30, today)!).split("\n")[0]).toBe("เบี้ยปีแรก (อายุ 30 ปี)");
  });
});

describe("the English table's words", () => {
  const t = premiumTable(HREF, 30, today, "en")!;

  it("are the golden text at 30", () => {
    expect(tableText(t)).toBe([
      "First-year premium (age 30)",
      "",
      "Medical cover up to 3,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      `🙆‍♀️ Female = ${yearEn(19_415, ihMonth(0, "F", 30))}`,
      `🕵️‍♂️ Male = ${yearEn(16_720, ihMonth(0, "M", 30))}`,
      "",
      "Medical cover up to 10,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      `🙆‍♀️ Female = ${yearEn(22_715, ihMonth(1, "F", 30))}`,
      `🕵️‍♂️ Male = ${yearEn(19_420, ihMonth(1, "M", 30))}`,
      "",
      "Medical cover up to 15,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      `🙆‍♀️ Female = ${yearEn(33_915, ihMonth(2, "F", 30))}`,
      `🕵️‍♂️ Male = ${yearEn(29_020, ihMonth(2, "M", 30))}`,
      "",
      "Medical cover up to 25,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      `🙆‍♀️ Female = ${yearEn(43_415, ihMonth(3, "F", 30))}`,
      `🕵️‍♂️ Male = ${yearEn(37_020, ihMonth(3, "M", 30))}`,
    ].join("\n"));
  });

  it("head the ad with the picked row and sex: the middle row and a woman by default", () => {
    expect(headlineFigures(t)).toBe([
      "iHealthy Ultra",
      "💁‍♀️ Medical cover up to 10,000,000 THB a year (A package with life cover of 50,000 THB and daily cash)",
      `💰 First-year premium ${yearEn(22_715, ihMonth(1, "F", 30))} (Female, 30)`,
    ].join("\n"));
    expect(headlineFigures(t, { sex: "M", rung: 3 }).split("\n")[2]).toBe(`💰 First-year premium ${yearEn(37_020, ihMonth(3, "M", 30))} (Male, 30)`);
    expect(headlineOwner(t, { sex: "F", rung: 3 })).toEqual({
      sex: "F", rung: 3, heading: "Medical cover up to 25,000,000 THB a year",
      line: "Female, 30 · Medical cover up to 25,000,000 THB a year (A package with life cover of 50,000 THB and daily cash)",
    });
  });

  it("say every amount one way, the number then THB — the sheets keep their own wording for Organic's posts", () => {
    expect(tableText(t)).not.toMatch(/THB \d/);
    expect(headlineFigures(t)).not.toMatch(/THB \d/);
    expect(EXPAT_NUMBERS_PLANS[HREF].ladder!.price(3, "F", 30, today)!.sumLine).toBe("Medical cover up to THB 25,000,000 a year");
  });

  it("has no table, English or Thai, at an age the engine does not sell (5, 81)", () => {
    for (const age of [5, 81]) {
      expect(premiumTable(HREF, age, today, "en"), `en ${age}`).toBeNull();
      expect(premiumTable(HREF, age, today), `th ${age}`).toBeNull();
    }
  });

  it("leaves out a sex the engine will not price, and the headline gives way to the other", () => {
    const sheet = { product: "X", sumLine: "Cover up to THB 1,000,000 a year", premiumLine: "", perDayLine: "", claims: [], annualSatang: 1_000_000, monthlySatang: 87_500, who: "", poster: { big: "", small: "" } };
    const plan = {
      ...EXPAT_NUMBERS_PLANS[HREF],
      ladder: { term: "renewable up to age 98", firstYear: true, rungs: 1, price: (_r: number, sex: "M" | "F") => (sex === "F" ? sheet : null) },
    };
    const s = premiumTableOf(plan, 30, today, "en")!;
    expect(s.rows[0].male).toBeNull();
    expect(tableText(s)).not.toContain("Male");
    expect(tableText(s)).toContain("Cover up to 1,000,000 THB a year\n🙆‍♀️ Female = 10,000 THB/yr (875 THB a month)");
    expect(headlineFigures(s, { sex: "M" }).split("\n")[2]).toBe("💰 First-year premium 10,000 THB/yr (875 THB a month) (Female, 30)");
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
    // no monthly mode on this sheet (under the floor): the year alone, no month
    expect(tableText(s)).toBe("Renewable up to age 98 (age 40)\n\nCover\n🙆‍♀️ Female = 2,176.29 THB/yr\n🕵️‍♂️ Male = 2,176.29 THB/yr");
    expect(headlineFigures(s).split("\n")[2]).toBe("💰 Premium 2,176.29 THB/yr (Female, 40)");
    expect(tableText(s)).not.toContain("a month");
  });

  it("say a month with satang as the engine prices it", () => {
    const plan = {
      ...EXPAT_NUMBERS_PLANS[HREF],
      ladder: {
        term: "renewable up to age 98", firstYear: false, rungs: 1,
        price: () => ({ product: "X", sumLine: "Cover", premiumLine: "", perDayLine: "", claims: [], annualSatang: 2_870_000, monthlySatang: 258_340, who: "", poster: { big: "", small: "" } }),
      },
    };
    const s = premiumTableOf(plan, 40, today, "en")!;
    expect(tableText(s)).toContain("🙆‍♀️ Female = 28,700 THB/yr (2,583.40 THB a month)");
    expect(tableText(s)).not.toContain("about");
  });

  it("hold the writer's own words to the English premium and person phrases", () => {
    expect(restatedFigures("Only 89 THB a day for peace of mind", "", t)).toEqual(["89 THB"]);
    expect(restatedFigures("Cover up to THB 10,000,000 a year", "", t)).toEqual([]);
    expect(restatedFigures("Cover up to 10,000,000 THB a year", "", t)).toEqual([]);
    expect(otherPeople("Perfect for a 35-year-old woman", "F", 30, "en")).toEqual(["35-year-old woman"]);
    expect(otherPeople("Perfect for a 30-year-old woman", "F", 30, "en")).toEqual([]);
  });
});

describe("an English ad's own words", () => {
  it("say money as the table does: the number, then THB", async () => {
    const { assembleLongAd, AD_MONEY_EN, adOwnerLines, longAdMessages } = await import("@/lib/content/ads");
    const ad = {
      opening: "Medical cover up to THB 25,000,000 a year", bullets: ["🥇 Life cover of THB 50,000 included"], cta: "Message us",
      hashtags: ["#Expat"], headline: "Up to THB 25,000,000", description: "", imagePrompt: "", poster: null,
    };
    const en = assembleLongAd(ad, { headline: "H", table: "T", contact: "C" }, "en");
    expect(en).toContain("Medical cover up to 25,000,000 THB a year");
    expect(en).toContain("🥇 Life cover of 50,000 THB included");
    expect(en).not.toMatch(/THB \d/);
    // a Thai ad, and an ad assembled without a language, are as written
    expect(assembleLongAd(ad, { headline: "H", table: "T", contact: "C" })).toContain("up to THB 25,000,000");
    expect(adOwnerLines("Female, 30", "en")).toContain(AD_MONEY_EN);
    expect(adOwnerLines("หญิง อายุ 30 ปี")).not.toContain(AD_MONEY_EN);
    const [system] = longAdMessages("brief", { angle: "a", hook: "h" }, { table: "T", headline: "H", owner: "Female, 30", reader: "", focus: "", voice: "" }, "en");
    expect(system.content.trim().endsWith(AD_MONEY_EN)).toBe(true);
  });
});
