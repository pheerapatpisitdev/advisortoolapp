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
      "Medical cover up to 3,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      "🙆‍♀️ Female = 19,415 THB/yr (about 1,618 a month)",
      "🕵️‍♂️ Male = 16,720 THB/yr (about 1,394 a month)",
      "",
      "Medical cover up to 10,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      "🙆‍♀️ Female = 22,715 THB/yr (about 1,893 a month)",
      "🕵️‍♂️ Male = 19,420 THB/yr (about 1,619 a month)",
      "",
      "Medical cover up to 15,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      "🙆‍♀️ Female = 33,915 THB/yr (about 2,827 a month)",
      "🕵️‍♂️ Male = 29,020 THB/yr (about 2,419 a month)",
      "",
      "Medical cover up to 25,000,000 THB a year",
      "(A package with life cover of 50,000 THB and daily cash)",
      "🙆‍♀️ Female = 43,415 THB/yr (about 3,618 a month)",
      "🕵️‍♂️ Male = 37,020 THB/yr (about 3,085 a month)",
    ].join("\n"));
  });

  it("head the ad with the picked row and sex: the middle row and a woman by default", () => {
    expect(headlineFigures(t)).toBe([
      "iHealthy Ultra",
      "💁‍♀️ Medical cover up to 10,000,000 THB a year (A package with life cover of 50,000 THB and daily cash)",
      "💰 First-year premium 22,715 THB/yr (about 1,893 a month) (Female, 30)",
    ].join("\n"));
    expect(headlineFigures(t, { sex: "M", rung: 3 }).split("\n")[2]).toBe("💰 First-year premium 37,020 THB/yr (about 3,085 a month) (Male, 30)");
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
    const sheet = { product: "X", sumLine: "Cover up to THB 1,000,000 a year", premiumLine: "", perDayLine: "", claims: [], annualSatang: 1_000_000, who: "", poster: { big: "", small: "" } };
    const plan = {
      ...EXPAT_NUMBERS_PLANS[HREF],
      ladder: { term: "renewable up to age 98", firstYear: true, rungs: 1, price: (_r: number, sex: "M" | "F") => (sex === "F" ? sheet : null) },
    };
    const s = premiumTableOf(plan, 30, today, "en")!;
    expect(s.rows[0].male).toBeNull();
    expect(tableText(s)).not.toContain("Male");
    expect(tableText(s)).toContain("Cover up to 1,000,000 THB a year\n🙆‍♀️ Female = 10,000 THB/yr (about 834 a month)");
    expect(headlineFigures(s, { sex: "M" }).split("\n")[2]).toBe("💰 First-year premium 10,000 THB/yr (about 834 a month) (Female, 30)");
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
