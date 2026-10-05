import { describe, expect, it } from "vitest";
import { definePlan, money, type NumberSheet } from "@/lib/content/numbers";
import { NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import { getBundle } from "@/calc/bundles/registry";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { hasLadder, headlineFigures, headlineOwner, otherPeople, premiumTable, premiumTableOf, restatedFigures, tableCells, tableText } from "@/lib/content/premium-table";
import { bundleModes } from "@/lib/content/numbers-cases/price-lines";
import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { displayPremium } from "@/lib/legacy-cta";
import { lifeProtectModes } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";

const today = new Date("2026-10-05");

/**
 * ตกเดือนละ is the engine's monthly-mode premium (owner, 2026-10-06), in baht: what the ตัวเลขชัดๆ
 * ad shows (displayPremium), null where the company will not take it monthly at this premium
 */
const monthOf = (modes: ModePremium[] | undefined): number | null => {
  const shown = displayPremium(modes, false);
  return shown?.mode === "monthly" ? shown.total / 100 : null;
};
/** a premium as the table says it: satang when it has them, whole baht otherwise */
const said = (n: number) => (Number.isInteger(n) ? money(n) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** the month bracket, only where there is a monthly mode */
const bracket = (month: number | null) => (month === null ? "" : ` (ตกเดือนละ ${said(month)})`);
/** a Thai cell as the table prints it */
const cellTh = (who: "หญิง" | "ชาย", annual: number | string, month: number | null) =>
  `${who === "หญิง" ? "🙆‍♀️" : "🕵️‍♂️"} ${who} = ${typeof annual === "string" ? annual : said(annual)} บาท/ปี${bracket(month)}`;
/** Life Protect x 2 on the 19-year pay term, as the plan's ladder prices it */
const lpMonth = (sum: number, sex: "F" | "M", age: number) => {
  const table = lifeProtectTable(today);
  const term = table.terms.find((t) => t.variant === "WLF19H")!;
  return monthOf(lifeProtectModes(table, term, { sex, age, sumAssured: sum }));
};

describe("the premium table", () => {
  it("every NUMBERS_PLANS href has a ladder of 4 rungs, Life Protect's of 6", () => {
    // Life Protect's doubled cover reads 500,000 to 5,000,000 (owner, 2026-10-05); the rest keep four
    const rungs: Record<string, number> = { "/lifeprotect": 6 };
    for (const [href, plan] of Object.entries(NUMBERS_PLANS)) {
      expect(plan.ladder?.rungs, href).toBe(rungs[href] ?? 4);
    }
  });

  it("legacy at 30 has 4 rows, both sexes priced, and female < male in each row", () => {
    const t = premiumTable("/legacy", 30, today)!;
    expect(t.rows).toHaveLength(4);
    for (const r of t.rows) {
      expect(r.female).not.toBeNull();
      expect(r.male).not.toBeNull();
      expect(r.female!).toBeLessThan(r.male!);
    }
  });

  it("every plan prices every rung at 30 for both sexes", () => {
    for (const href of Object.keys(NUMBERS_PLANS)) {
      const t = premiumTable(href, 30, today)!;
      expect(t.rows, href).toHaveLength(NUMBERS_PLANS[href].ladder!.rungs);
      for (const r of t.rows) {
        expect(r.female, href).not.toBeNull();
        expect(r.male, href).not.toBeNull();
      }
    }
  });

  it("each cell equals the engine", () => {
    for (const [href, plan] of Object.entries(NUMBERS_PLANS)) {
      const t = premiumTable(href, 35, today)!;
      // rows may drop rungs, so walk the ladder the same way
      const rungs = Array.from({ length: plan.ladder!.rungs }, (_, r) => r).filter((r) => plan.ladder!.price(r, "F", 35, today) ?? plan.ladder!.price(r, "M", 35, today));
      expect(t.rows.length, href).toBe(rungs.length);
      t.rows.forEach((row, i) => {
        expect(row.female, href).toBe((plan.ladder!.price(rungs[i], "F", 35, today)?.annualSatang ?? NaN) / 100);
        expect(row.male, href).toBe((plan.ladder!.price(rungs[i], "M", 35, today)?.annualSatang ?? NaN) / 100);
        for (const [sex, month] of [["F", row.femaleMonth], ["M", row.maleMonth]] as const) {
          const sheet = plan.ladder!.price(rungs[i], sex, 35, today);
          expect(month, `${href} ${i} ${sex}`).toBe(sheet?.monthlySatang === undefined ? null : sheet.monthlySatang / 100);
        }
      });
    }
  });

  it("every plan's sheet carries the monthly figure its premium line shows, and none where the line has no month", () => {
    // the ตัวเลขชัดๆ sheet's premium line is the engine's monthly mode, or empty under the floor
    for (const [href, plan] of Object.entries(NUMBERS_PLANS)) {
      for (const age of [1, 30, 45, 60]) {
        for (let r = 0; r < plan.ladder!.rungs; r++) {
          for (const sex of ["F", "M"] as const) {
            const sheet = plan.ladder!.price(r, sex, age, today);
            if (!sheet) continue;
            const where = `${href} ${age} ${r} ${sex}`;
            if (sheet.premiumLine === "") expect(sheet.monthlySatang, where).toBeUndefined();
            else expect(sheet.premiumLine, where).toContain(`${formatBaht(sheet.monthlySatang!)} บาท`);
          }
        }
      }
    }
  });

  it("tableText formats a row", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    const text = tableText(t);
    const r = t.rows[0];
    expect(text).toContain(cellTh("หญิง", r.female!, lpMonth(250_000, "F", 30)));
    expect(text).toContain(cellTh("ชาย", r.male!, lpMonth(250_000, "M", 30)));
    expect(text).toContain(`${r.heading}\n(${r.note})\n🙆‍♀️`);
  });

  it("a premium with satang keeps them", () => {
    const t = { product: "P", age: 55, term: "x", firstYear: true, rows: [{ heading: "H", female: 9483.5, femaleMonth: 812.25, male: null, maleMonth: null }] };
    expect(tableText(t)).toContain("🙆‍♀️ หญิง = 9,483.50 บาท/ปี (ตกเดือนละ 812.25)");
  });

  it("firstYear plans say เบี้ยปีแรก", () => {
    expect(tableText(premiumTable("/legacy", 30, today)!)).toContain("เบี้ยปีแรก");
    expect(tableText(premiumTable("/lifeprotect", 30, today)!)).not.toContain("เบี้ยปีแรก");
  });

  it("ishield at 55 gives null", () => {
    expect(premiumTable("/ishield", 55, today)).toBeNull();
  });

  it("an age off some rungs drops only those rows", () => {
    // Life Treasure's lowest sums are not sold to every age; find one where the ladder is partly priced
    let found = false;
    for (const href of Object.keys(NUMBERS_PLANS)) {
      for (let age = 0; age <= 80 && !found; age++) {
        const t = premiumTable(href, age, today);
        if (t && t.rows.length < NUMBERS_PLANS[href].ladder!.rungs) {
          expect(t.rows.length).toBeGreaterThan(0);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("a row priced for one sex only keeps the other null and tableText omits that line", () => {
    const sheet = (annualSatang: number): NumberSheet => ({
      product: "Stub", sumLine: "ทุน 1,000,000 บาท", annualSatang, premiumLine: "", perDayLine: "", claims: [], who: "", poster: { big: "", small: "" },
    });
    const plan = definePlan<{ sex: "M" | "F"; age: number; sum: number }>({
      product: "Stub",
      cases: [],
      claims: [],
      price: (c) => (c.sex === "F" ? null : sheet(c.sum)),
      ladder: { term: "จ่าย 5 ปี", firstYear: false, rungs: [{ sum: 1_200_000 }, { sum: 2_400_000 }] },
    });
    const t = premiumTableOf(plan, 30, today)!;
    expect(t.rows[0]).toEqual({ heading: "ทุน 1,000,000 บาท", female: null, femaleMonth: null, male: 12_000, maleMonth: null });
    const text = tableText(t);
    expect(text).not.toContain("หญิง");
    // the stub's sheet has no monthly mode: the year alone, no month bracket
    expect(text).toContain("🕵️‍♂️ ชาย = 12,000 บาท/ปี");
    expect(text).not.toContain("ตกเดือนละ");
  });

  it("a cell with a monthly mode says the engine's month; one under the monthly floor says the year alone", () => {
    const sheet = (annualSatang: number, monthlySatang?: number): NumberSheet => ({
      product: "Stub", sumLine: "ทุน 1,000,000 บาท", annualSatang, ...(monthlySatang ? { monthlySatang } : {}),
      premiumLine: "", perDayLine: "", claims: [], who: "", poster: { big: "", small: "" },
    });
    const plan = definePlan<{ sex: "M" | "F"; age: number }>({
      product: "Stub",
      cases: [],
      claims: [],
      // a woman's premium is taken monthly at 2,583 (not 28,700 ÷ 12 = 2,392); a man's is under the floor
      price: (c) => (c.sex === "F" ? sheet(2_870_000, 258_300) : sheet(300_000)),
      ladder: { term: "จ่าย 5 ปี", firstYear: false, rungs: [{}] },
    });
    const t = premiumTableOf(plan, 30, today)!;
    expect(t.rows[0]).toEqual({ heading: "ทุน 1,000,000 บาท", female: 28_700, femaleMonth: 2_583, male: 3_000, maleMonth: null });
    const text = tableText(t);
    expect(text).toContain("🙆‍♀️ หญิง = 28,700 บาท/ปี (ตกเดือนละ 2,583)\n🕵️‍♂️ ชาย = 3,000 บาท/ปี");
    expect(text.endsWith("🕵️‍♂️ ชาย = 3,000 บาท/ปี")).toBe(true);
    expect(text).not.toContain("2,392");
    expect(headlineFigures(t)).toBe("Stub\n💁‍♀️ ทุน 1,000,000 บาท\n💰 เบี้ย 28,700 บาท/ปี (ตกเดือนละ 2,583) (หญิง อายุ 30 ปี)");
    expect(headlineFigures(t, { sex: "M" })).toBe("Stub\n💁‍♀️ ทุน 1,000,000 บาท\n💰 เบี้ย 3,000 บาท/ปี (ชาย อายุ 30 ปี)");
    expect(tableCells(t)).toEqual([28_700, 2_583, 3_000]);
  });

  it("a real cell under the monthly floor prints no month bracket", () => {
    let seen = false;
    for (const href of Object.keys(NUMBERS_PLANS)) {
      for (const age of [1, 10, 20, 30]) {
        const t = premiumTable(href, age, today);
        for (const r of t?.rows ?? []) {
          const annual = r.female;
          if (annual === null || r.femaleMonth !== null || seen) continue;
          const line = tableText(t!).split("\n").find((l) => l.startsWith(`🙆‍♀️ หญิง = ${said(annual)} บาท/ปี`));
          expect(line, `${href} ${age}`).toBe(`🙆‍♀️ หญิง = ${said(annual)} บาท/ปี`);
          seen = true;
        }
      }
    }
    expect(seen).toBe(true);
  });

  it("headlineFigures: the product, the middle row's sum with its note, and whose premium it is, female first", () => {
    const t = { product: "P", age: 30, term: "x", firstYear: false, rows: [
      { heading: "A", female: 100, femaleMonth: null, male: 200, maleMonth: null },
      { heading: "B", note: "ทุน 1 × 2", female: 1200, femaleMonth: 104, male: 2400, maleMonth: 208 },
      { heading: "C", female: 300, femaleMonth: null, male: 400, maleMonth: null },
      { heading: "D", female: 500, femaleMonth: null, male: 600, maleMonth: null },
    ] };
    expect(headlineFigures(t)).toBe("P\n💁‍♀️ B (ทุน 1 × 2)\n💰 เบี้ย 1,200 บาท/ปี (ตกเดือนละ 104) (หญิง อายุ 30 ปี)");
    const m = { ...t, age: 45, firstYear: true, rows: [{ heading: "E", female: null, femaleMonth: null, male: 2400, maleMonth: 208 }] };
    expect(headlineFigures(m)).toBe("P\n💁‍♀️ E\n💰 เบี้ยปีแรก 2,400 บาท/ปี (ตกเดือนละ 208) (ชาย อายุ 45 ปี)");
  });

  it("headlineFigures carries a package's note too", () => {
    const t = { product: "P", age: 30, term: "x", firstYear: true, note: "เบี้ยรวม X", rows: [{ heading: "A", female: 100, femaleMonth: null, male: 200, maleMonth: null }] };
    expect(headlineFigures(t)).toBe("P\n💁‍♀️ A (เบี้ยรวม X)\n💰 เบี้ยปีแรก 100 บาท/ปี (หญิง อายุ 30 ปี)");
  });

  it("headlineFigures takes the owner's row and sex: a man of 35 on Life Protect's 1,000,000 cover", () => {
    const t = premiumTable("/lifeprotect", 35, today)!;
    const rung = t.rows.findIndex((r) => r.heading === "ประกันชีวิตคุ้มครอง 1,000,000 บาท");
    expect(rung).toBe(1);
    const male = t.rows[rung].male!;
    expect(headlineFigures(t, { sex: "M", rung })).toBe([
      "Life Protect x 2",
      "💁‍♀️ ประกันชีวิตคุ้มครอง 1,000,000 บาท (ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      `💰 เบี้ย ${money(male)} บาท/ปี${bracket(lpMonth(500_000, "M", 35))} (ชาย อายุ 35 ปี)`,
    ].join("\n"));
  });

  it("headlineFigures falls back to the other sex where the chosen one is not priced, and says whose it is", () => {
    const t = { product: "P", age: 40, term: "x", firstYear: false, rows: [{ heading: "A", female: 1200, femaleMonth: 104, male: null, maleMonth: null }] };
    expect(headlineFigures(t, { sex: "M", rung: 0 })).toBe("P\n💁‍♀️ A\n💰 เบี้ย 1,200 บาท/ปี (ตกเดือนละ 104) (หญิง อายุ 40 ปี)");
  });

  it("a rung off the table is the middle row", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    for (const rung of [-1, 6, 2.5, Number.NaN]) expect(headlineFigures(t, { sex: "F", rung }), String(rung)).toBe(headlineFigures(t));
  });

  it("headlineOwner names whose ad it is: the sex the headline shows, the age, the row with its note", () => {
    const t = premiumTable("/lifeprotect", 35, today)!;
    expect(headlineOwner(t, { sex: "M", rung: 1 })).toEqual({
      sex: "M", rung: 1, heading: "ประกันชีวิตคุ้มครอง 1,000,000 บาท",
      line: "ชาย อายุ 35 ปี · ประกันชีวิตคุ้มครอง 1,000,000 บาท (ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
    });
  });

  it("the term passes through lifelong()", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    expect(t.term).toContain("ตลอดชีพ");
    expect(t.term).not.toContain("99");
  });
});

describe("a table never shows a sum without its condition — final review 1 and 2", () => {
  it("Life Protect x 2 at 30: six rows whose doubled cover reads 500,000 to 5,000,000, each saying it is the sum × 2 before 60", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    expect(t.rows.map((r) => r.heading)).toEqual([500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000].map((n) => `ประกันชีวิตคุ้มครอง ${money(n)} บาท`));
    for (const r of t.rows) expect(r.note).toMatch(/^ทุน [\d,]+ บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60$/);
    expect(tableText(t)).toBe([
      "จ่าย 19 ปี คุ้มครองตลอดชีพ (อายุ 30 ปี)",
      "",
      "ประกันชีวิตคุ้มครอง 500,000 บาท",
      "(ทุน 250,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 5_400, lpMonth(250_000, "F", 30)),
      cellTh("ชาย", 6_350, lpMonth(250_000, "M", 30)),
      "",
      "ประกันชีวิตคุ้มครอง 1,000,000 บาท",
      "(ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 10_800, lpMonth(500_000, "F", 30)),
      cellTh("ชาย", 12_700, lpMonth(500_000, "M", 30)),
      "",
      "ประกันชีวิตคุ้มครอง 2,000,000 บาท",
      "(ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 21_600, lpMonth(1_000_000, "F", 30)),
      cellTh("ชาย", 25_400, lpMonth(1_000_000, "M", 30)),
      "",
      "ประกันชีวิตคุ้มครอง 3,000,000 บาท",
      "(ทุน 1,500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 32_400, lpMonth(1_500_000, "F", 30)),
      cellTh("ชาย", 38_100, lpMonth(1_500_000, "M", 30)),
      "",
      "ประกันชีวิตคุ้มครอง 4,000,000 บาท",
      "(ทุน 2,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 43_200, lpMonth(2_000_000, "F", 30)),
      cellTh("ชาย", 50_800, lpMonth(2_000_000, "M", 30)),
      "",
      "ประกันชีวิตคุ้มครอง 5,000,000 บาท",
      "(ทุน 2,500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      cellTh("หญิง", 54_000, lpMonth(2_500_000, "F", 30)),
      cellTh("ชาย", 63_500, lpMonth(2_500_000, "M", 30)),
    ].join("\n"));
    // the middle row by default, a woman's premium first
    expect(headlineFigures(t)).toBe([
      "Life Protect x 2",
      "💁‍♀️ ประกันชีวิตคุ้มครอง 2,000,000 บาท (ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      `💰 เบี้ย 21,600 บาท/ปี${bracket(lpMonth(1_000_000, "F", 30))} (หญิง อายุ 30 ปี)`,
    ].join("\n"));
  });

  it("Life Protect x 2's smallest base sum is one the company sells (150,000 and up)", () => {
    const plan = NUMBERS_PLANS["/lifeprotect"];
    for (let r = 0; r < plan.ladder!.rungs; r++) {
      const sheet = plan.ladder!.price(r, "F", 30, today)!;
      const base = Number(/ทุน ([\d,]+) บาท/.exec(sheet.sumNote ?? "")![1].replace(/,/g, ""));
      expect(base).toBeGreaterThanOrEqual(150_000);
    }
  });

  it("Life Protect x 2 past the booster age shows the plain sum, with no note", () => {
    const t = premiumTable("/lifeprotect", 65, today)!;
    expect(t.rows.length).toBeGreaterThan(0);
    for (const r of t.rows) {
      expect(r.heading).toMatch(/^ประกันชีวิตทุน /);
      expect(r.note).toBeUndefined();
    }
  });

  it("the cancer set at 30 says each price is the set's: daily cash and Life Protect with it", () => {
    const cancerMonth = (tier: number, sex: "F" | "M") => monthOf(bundleModes("CANCER_SET", tier, { sex, age: 30 }, today));
    const t = premiumTable("/cancer", 30, today)!;
    const text = tableText(t);
    expect(text).toContain([
      "ประกันมะเร็งทุน 300,000 บาท",
      "(ชดเชยนอนโรงพยาบาลวันละ 1,000 บาท · คู่กับ Life Protect x 2 ทุน 150,000 บาท)",
      cellTh("หญิง", "2,176.29", cancerMonth(1, "F")),
      cellTh("ชาย", "2,255.39", cancerMonth(1, "M")),
    ].join("\n"));
    expect(text).toContain("ประกันมะเร็งทุน 3,000,000 บาท\n(ชดเชยนอนโรงพยาบาลวันละ 6,000 บาท · คู่กับ Life Protect x 2 ทุน 600,000 บาท)\n");
    expect(headlineFigures(t)).toBe([
      "ชุดประกันมะเร็ง",
      "💁‍♀️ ประกันมะเร็งทุน 500,000 บาท (ชดเชยนอนโรงพยาบาลวันละ 2,000 บาท · คู่กับ Life Protect x 2 ทุน 150,000 บาท)",
      `💰 เบี้ยปีแรก 2,398.58 บาท/ปี${bracket(cancerMonth(2, "F"))} (หญิง อายุ 30 ปี)`,
    ].join("\n"));
  });

  it("every row of CI 123 and iHealthy carries its package note", () => {
    for (const href of ["/ci123", "/ihealthy-ultra"]) {
      const t = premiumTable(href, 30, today)!;
      for (const r of t.rows) expect(r.note, href).toBeTruthy();
    }
    expect(tableText(premiumTable("/ihealthy-ultra", 30, today)!)).toContain("(แพ็กเกจรวมประกันชีวิตทุน 50,000 บาท");
  });

  it("legacy, whose sheets have no note, says once under the head line what its price includes", () => {
    const t = premiumTable("/legacy", 30, today)!;
    expect(tableText(t).split("\n").slice(0, 3)).toEqual([
      "เบี้ยปีแรก จ่ายเบี้ยตลอดชีพ (อายุ 30 ปี)",
      "(เบี้ยรวม Life Protect x 2 ทุน 150,000 บาท กับสัญญาเพิ่มเติมโรคร้ายแรง)",
      "",
    ]);
    expect(headlineFigures(t).split("\n")[1]).toBe("💁‍♀️ มรดกให้ครอบครัว 2,000,000 บาท (เบี้ยรวม Life Protect x 2 ทุน 150,000 บาท กับสัญญาเพิ่มเติมโรคร้ายแรง)");
    // the note's figures are the bundle's: every tier of the ladder is Life Protect 150,000 + DCI
    for (const no of [1, 2, 3, 5]) {
      const tier = getBundle("LEGACY_FAMILY")!.tiers.find((x) => x.no === no)!;
      expect(tier.sumAssured).toBe(150_000);
      expect(tier.riders.map((r) => r.code)).toEqual(["DCI"]);
    }
  });
});

describe("which plans an ad can be written for — final review 9", () => {
  it("every product Studio offers has a premium table", () => {
    for (const p of CONTENT_PRODUCTS) expect(hasLadder(p.href), p.href).toBe(true);
  });
  it("an unknown href has none", () => {
    expect(hasLadder("/nope")).toBe(false);
  });
});

describe("the model's own words — final review 4", () => {
  const t = premiumTable("/legacy", 30, today)!;
  const brief = "มรดกเพื่อครอบครัว ทุน 1 ล้าน 2 ล้าน 3 ล้าน 5 ล้าน ลดหย่อนภาษีได้ 100,000 บาท";

  // a woman's 5,000,000 cell (tier 5) is taken monthly: its monthly-mode premium from the engine
  // (owner, 2026-10-06), and the year ÷ 12 the table said before
  const rung = 3;
  const annual = t.rows[rung].female!;
  const legacyMonth = monthOf(bundleModes("LEGACY_FAMILY", 5, { sex: "F", age: 30 }, today))!;
  const twelfth = Math.ceil(annual / 12);

  it("the table's cells are its yearly and ตกเดือนละ figures — the engine's month, not the year ÷ 12", () => {
    expect(t.rows[rung].heading).toBe("มรดกให้ครอบครัว 5,000,000 บาท");
    expect(legacyMonth).not.toBeNull();
    expect(legacyMonth).not.toBe(twelfth);
    expect(tableCells(t)).toContain(annual);
    expect(tableCells(t)).toContain(legacyMonth);
    expect(tableCells(t)).not.toContain(twelfth);
    // 6,803 (2,000,000, a woman) is under the monthly floor: its year alone
    expect(tableCells(t)).toContain(6803);
    expect(tableCells(t)).not.toContain(Math.ceil(6803 / 12));
  });

  it("flag a premium of the table restated, yearly or a month, however it is written", () => {
    expect(restatedFigures("ทุน 2 ล้าน เบี้ยแค่ 6,803 บาท/ปี", brief, t)).toEqual(["6,803 บาท"]);
    const month = said(legacyMonth);
    expect(restatedFigures(`ทุน 5 ล้าน จ่ายเพียง ${month} บาทเท่านั้น`, brief, t)).toEqual([`${month} บาท`]);
    // a month with satang said in whole baht, as the ตัวเลขชัดๆ ad says it (formatBaht), is the same premium
    const whole = formatBaht(legacyMonth * 100);
    expect(restatedFigures(`ทุน 5 ล้าน จ่ายเพียง ${whole} บาทเท่านั้น`, brief, t)).toEqual([`${whole} บาท`]);
    // the year ÷ 12 is no figure of the table now: where the brief has it and no premium word is beside it, nothing flags it
    expect(restatedFigures(`ทุน 5 ล้าน จ่ายเพียง ${twelfth} บาทเท่านั้น`, `${brief} ${twelfth}`, t)).toEqual([]);
    const satang = premiumTable("/cancer", 30, today)!;
    expect(restatedFigures("เบี้ยเริ่ม 2176.29 บาท", "ประกันมะเร็ง", satang)).toEqual(["2176.29 บาท"]);
  });

  it("flag a figure neither the brief nor the table's sums have", () => {
    expect(restatedFigures("คุ้มครองสูงสุด 7 ล้าน", brief, t)).toEqual(["7 ล้าน"]);
  });

  it("no plan's own row headings or notes are flagged in the model's words, at 30", () => {
    for (const href of Object.keys(NUMBERS_PLANS)) {
      const table = premiumTable(href, 30, today);
      if (!table) continue;
      const cited = table.rows.map((r) => [r.heading, r.note ?? ""].join(" ")).join(" · ");
      expect(restatedFigures(cited, "", table), href).toEqual([]);
    }
  });

  it("leave a sum the table itself prints, though the brief lacks it", () => {
    // the headline's own sum and the package note's base, written into the model's words
    expect(restatedFigures("ส่งต่อมรดก 2,000,000 บาท รวมฐาน 150,000 บาท", "มรดกเพื่อครอบครัว", t)).toEqual([]);
    const lp = premiumTable("/lifeprotect", 30, today)!;
    // "คุ้มครอง 4 ล้าน" is the doubled cover the table heads a row with; its brief says only the plain sums
    expect(restatedFigures("คุ้มครองสูงสุด 4 ล้าน ถ้าจากไปก่อนอายุ 60", "Life Protect x 2 ทุน 1 ล้าน", lp)).toEqual([]);
    // the table's premiums stay off limits in the model's words
    expect(restatedFigures("คุ้มครอง 4 ล้าน เบี้ย 43,200 บาท/ปี", "Life Protect x 2", lp)).toEqual(["43,200 บาท"]);
  });

  it("flag any amount next to a premium word in the model's own words, even one the brief has — the 2026-10-05 ad", () => {
    const lp = premiumTable("/lifeprotect", 30, today)!;
    const brief = "ผู้หญิงอายุ 35 ทุน 500,000 บาท เบี้ยเฉลี่ยวันละ 20 บาท\nผู้ชายอายุ 35 ทุน 1,000,000 บาท จ่ายตลอดชีพ: เบี้ย 1,548 บาท/เดือน (เฉลี่ยวันละ 48 บาท)";
    expect(restatedFigures("เริ่มต้นเบี้ยเฉลี่ยวันละ 20 บาท", brief, lp)).toEqual(["20 บาท"]);
    expect(restatedFigures("🥇 เบี้ยเดือนละ 1,548 บาท", brief, lp)).toEqual(["1,548 บาท"]);
    expect(restatedFigures("ชายอายุ 35 ปี ทุน 1,000,000 คุ้มครองครอบครัว วันละ 48 บาท", brief, lp)).toEqual(["48 บาท"]);
    expect(restatedFigures("จ่ายแค่ 1,548 บาท/เดือน", brief, lp)).toEqual(["1,548 บาท"]);
  });

  it("but not coverage, an age or a count beside no premium word", () => {
    const lp = premiumTable("/lifeprotect", 30, today)!;
    const brief = "ทุนสองเท่าถ้าเสียชีวิตก่อนอายุ 60 · ทุน 1,000,000 บาท · จ่ายจบได้ใน 9 หรือ 19 ปี · เบี้ยเท่าเดิมทุกปี";
    expect(restatedFigures("คุ้มครอง 1,000,000 บาท ถ้าจากไปก่อนอายุ 60", brief, lp)).toEqual([]);
    expect(restatedFigures("เบี้ยเท่าเดิมทุกปี จ่ายจบได้ใน 9 หรือ 19 ปี", brief, lp)).toEqual([]);
    const cancer = premiumTable("/cancer", 30, today)!;
    expect(restatedFigures("ชดเชยนอนโรงพยาบาลวันละ 1,000 บาท", "ชดเชยนอนโรงพยาบาลวันละ 1,000–10,000 บาท", cancer)).toEqual([]);
  });

  it("leave coverage named from the brief alone", () => {
    expect(restatedFigures("ส่งต่อมรดก 2 ล้าน ลดหย่อนภาษีได้ 100,000 บาท", brief, t)).toEqual([]);
  });
});


describe("otherPeople — the model may not speak of another person (2026-10-05)", () => {
  it.each([
    ["ผู้หญิงอายุ 35 ทุน 500,000 บาท", "ผู้หญิงอายุ 35"],
    ["สำหรับหญิง 35 ปี", "หญิง 35 ปี"],
    ["ชายอายุ 40 ก็ยังทัน", "ชายอายุ 40"],
    ["ผู้ชายวัย 30 ที่ยังผ่อนบ้าน", "ผู้ชายวัย 30"],
    ["ผู้ชาย อายุ 45 ปี", "ผู้ชาย อายุ 45"],
  ])("flags %s when the ad is a man of 35", (text, flagged) => {
    expect(otherPeople(text, "M", 35)).toEqual([flagged]);
  });

  it.each([
    "ผู้ชายวัย 35 ที่ยังผ่อนบ้าน", "ชายอายุ 35 ปี ทุน 1,000,000", "ชาย 35 ปี", "ก่อนอายุ 60", "ถึงอายุ 99",
    "คุ้มครองถึงอายุ 85", "อายุ 20–65 ปี สมัครได้", "ทั้งหญิงและชาย", "ผู้หญิงหลายคนถามว่า", "จ่ายจบใน 19 ปี",
    // re-review: both sexes, a child, a range
    "ทั้งหญิงและชาย อายุ 20–65 ปี", "รับทั้งหญิงชาย อายุ 0–80 ปี", "หญิงชายอายุ 35", "ลูกชายอายุ 5 ขวบ", "ลูกชาย 5 ปี",
    "เด็กชายอายุ 10", "ผู้ชายวัย 30–40", "ผู้ชายอายุ 30 ถึง 40 ปี", "ผู้ชายอายุ 40 ขึ้นไป", "ผู้ชายอายุ ๓๕ ปี",
  ])("leaves %s when the ad is a man of 35", (text) => {
    expect(otherPeople(text, "M", 35)).toEqual([]);
  });

  it("reads Thai digits", () => {
    expect(otherPeople("ผู้หญิงอายุ ๓๕", "M", 35)).toEqual(["ผู้หญิงอายุ ๓๕"]);
    expect(otherPeople("ชายอายุ ๔๐ ปี", "M", 35)).toEqual(["ชายอายุ ๔๐"]);
  });

  it("a woman's ad flags a man of the same age", () => {
    expect(otherPeople("ผู้ชายอายุ 30 ก็ซื้อได้ ผู้หญิงอายุ 30 ด้วย", "F", 30)).toEqual(["ผู้ชายอายุ 30"]);
  });
});
