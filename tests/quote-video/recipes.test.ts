import { describe, expect, it } from "vitest";
import { quoteVideoFacts, spokenBaht } from "@/lib/quote-video/script";
import { RECIPE_KEYS, RECIPE_NAMES, nextRecipe, pickRecipe, readRecipe, recipeFigures, recipeFits, recipeScript, recipesFor } from "@/lib/quote-video/recipes";

const LP35 = quoteVideoFacts({ product: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000 })!;
const said = (key: "ask" | "life" | "versus", narrator: "F" | "M" = "F") => recipeScript(key, LP35, narrator).map((s) => s.voice).join(" ");

describe("clip recipes (owner, 2026-11-11, ก ก ก)", () => {
  it("reads the example quote's figures off its facts", () => {
    expect(LP35.lead.baht).toBe(2_000_000);
    expect(LP35.perDayAmount).toBe("79");
    expect(LP35.payYears).toBe(19);
    expect(LP35.lastPayAge).toBe(53);
    expect(LP35.coverToAge).toBe(99);
    expect(recipeFigures(LP35)).toEqual({ yearly: "28,700", splitAge: 60, early: "2,000,000", late: "1,000,000", paid: 545300, cash: 553000, diff: 7700 });
  });

  it("names the three recipes and reads a key only when it is one", () => {
    expect(RECIPE_KEYS).toEqual(["ask", "life", "versus"]);
    expect(RECIPE_NAMES).toEqual({ ask: "เปิดด้วยคำถาม", life: "เส้นชีวิต", versus: "เทียบให้เห็น" });
    expect(readRecipe("ask")).toBe("ask");
    expect(readRecipe("x")).toBeUndefined();
    expect(readRecipe(undefined)).toBeUndefined();
  });

  it("offers all three to a plain Life Protect quote", () => {
    expect(recipesFor(LP35)).toEqual(["ask", "life", "versus"]);
  });

  it("offers none where the quote carries more than the recipes tell", () => {
    expect(recipesFor({ ...LP35, riders: { said: "x", parts: [] } })).toEqual([]);
    expect(recipesFor({ ...LP35, budget: { per: "month", amount: "2,000" } })).toEqual([]);
    expect(recipesFor({ ...LP35, lang: "zh" })).toEqual([]);
    expect(recipesFor({ ...LP35, product: "ISHIELD" })).toEqual([]);
  });

  it("leaves out what the quote cannot back", () => {
    expect(recipesFor({ ...LP35, payToEnd: true, payYears: undefined, lastPayAge: undefined })).toEqual(["versus"]);
    expect(recipesFor({ ...LP35, breakEven: undefined })).toEqual(["ask", "life"]);
    expect(recipeFits("versus", { ...LP35, breakEven: { ...LP35.breakEven!, cash: LP35.totalPaid! } })).toBe(false);
    const more = { ...LP35, breakEven: { ...LP35.breakEven!, cash: "545,800" } };
    expect(recipeFits("versus", more)).toBe(true);
    expect(recipeFigures(more)?.diff).toBe(500);
    expect(recipesFor({ ...LP35, coverStyle: "rows" })).toEqual([]);
    expect(recipesFor({ ...LP35, cover: [LP35.cover[0]] })).toEqual([]);
    expect(recipesFor({ ...LP35, prices: LP35.prices.filter((p) => p.label !== "รายปี") })).toEqual([]);
  });

  it("speaks each recipe's scenes with the quote's own figures", () => {
    expect(recipeScript("ask", LP35, "F").map((s) => s.key)).toEqual(["lead", "cover", "price", "contact"]);
    const ask = said("ask");
    for (const s of [spokenBaht(2_000_000), spokenBaht(79), "19", "53", "99", "60"]) expect(ask).toContain(s);
    const lifeScenes = recipeScript("life", LP35, "F");
    expect(lifeScenes.map((s) => s.key)).toEqual(["lead", "price", "cover", "value", "contact"]);
    const life = said("life");
    for (const s of [spokenBaht(28_700), spokenBaht(2_000_000), spokenBaht(1_000_000), "35", "53", "60", "99"]) expect(life).toContain(s);
    const vs = recipeScript("versus", LP35, "F");
    expect(vs.map((s) => s.key)).toEqual(["lead", "value", "cover", "contact"]);
    const versus = said("versus");
    for (const s of [spokenBaht(545_300), spokenBaht(553_000), spokenBaht(7_700), spokenBaht(2_000_000), "64", "19"]) expect(versus).toContain(s);
  });

  it("never says บาท twice after a figure", () => {
    for (const k of RECIPE_KEYS) expect(said(k)).not.toMatch(/บาท\s*บาท/);
  });

  it("speaks for a man with ครับ and no ค่ะ", () => {
    for (const k of RECIPE_KEYS) {
      const voices = recipeScript(k, LP35, "M").map((s) => s.voice);
      expect(voices.some((v) => /ค่ะ|นะคะ|คะ(\s|$)/.test(v))).toBe(false);
      expect(voices.some((v) => v.includes("ครับ"))).toBe(true);
    }
  });

  it("picks one that is not the last, or repeats when only one fits", () => {
    const all = ["ask", "life", "versus"] as const;
    expect(pickRecipe([...all], "ask", 0)).toBe("life");
    expect(pickRecipe([...all], "ask", 0.99)).toBe("versus");
    expect(pickRecipe(["ask"], "ask", 0.5)).toBe("ask");
    expect(pickRecipe([], undefined, 0)).toBeUndefined();
  });
});

describe("สุ่มให้ at the press of สร้าง (owner, 2026-11-12, ก ก)", () => {
  const all = ["ask", "life", "versus"] as const;

  it("still picks a fitting recipe when the browser's storage throws, is empty or holds garbage", () => {
    const reads: (() => string | null)[] = [() => { throw new Error("storage closed"); }, () => null, () => "garbage"];
    for (const read of reads) {
      for (const roll of [0, 0.5, 0.99]) expect(all).toContain(nextRecipe([...all], read, roll));
      expect(nextRecipe(["life"], read, 0.5)).toBe("life");
    }
  });

  it("never gives the one this browser made last while another fits", () => {
    for (const last of all) {
      for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
        const got = nextRecipe([...all], () => last, roll);
        expect(got).not.toBe(last);
        expect(all).toContain(got);
      }
      // two fit, the last among them: always the other
      const other = all.find((k) => k !== last)!;
      for (const roll of [0, 0.5, 0.99]) expect(nextRecipe([last, other], () => last, roll)).toBe(other);
    }
  });

  it("repeats the last where it is the only one that fits, and gives none where none fits", () => {
    expect(nextRecipe(["versus"], () => "versus", 0.3)).toBe("versus");
    expect(nextRecipe([], () => "ask", 0.3)).toBeUndefined();
  });
});

describe("the recipe a stored input is made with", () => {
  it("is its recipe only for a portrait Motion clip whose facts it fits", async () => {
    const { recipeOf } = await import("@/lib/quote-video/recipes");
    expect(recipeOf({ style: "motion", recipe: "ask" }, LP35)).toBe("ask");
    expect(recipeOf({ style: "motion", size: "portrait", recipe: "life" }, LP35)).toBe("life");
    expect(recipeOf({ style: "classic", recipe: "ask" }, LP35)).toBeUndefined();
    expect(recipeOf({ style: "chat", recipe: "ask" }, LP35)).toBeUndefined();
    expect(recipeOf({ style: "motion", size: "square", recipe: "ask" }, LP35)).toBeUndefined();
    expect(recipeOf({ style: "motion", recipe: "nope" }, LP35)).toBeUndefined();
    expect(recipeOf({ style: "motion" }, LP35)).toBeUndefined();
    expect(recipeOf({ style: "motion", recipe: "versus" }, { ...LP35, breakEven: undefined })).toBeUndefined();
  });
});
