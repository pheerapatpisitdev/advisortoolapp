import { describe, expect, it } from "vitest";
import { definePlan, money, type NumberSheet } from "@/lib/content/numbers";
import { NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import { headlineFigures, premiumTable, premiumTableOf, tableText } from "@/lib/content/premium-table";

const today = new Date("2026-10-05");

describe("the premium table", () => {
  it("every NUMBERS_PLANS href has a ladder with 4 rungs", () => {
    for (const [href, plan] of Object.entries(NUMBERS_PLANS)) {
      expect(plan.ladder?.rungs, href).toBe(4);
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
      expect(t.rows, href).toHaveLength(4);
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
      });
    }
  });

  it("tableText formats a row", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    const text = tableText(t);
    const r = t.rows[0];
    expect(text).toContain(`🙆‍♀️ หญิง = ${money(r.female!)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(r.female! / 12))})`);
    expect(text).toContain(`🕵️‍♂️ ชาย = ${money(r.male!)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(r.male! / 12))})`);
    expect(text).toContain(`${r.heading}\n🙆‍♀️`);
  });

  it("a premium with satang keeps them", () => {
    const t = { product: "P", age: 55, term: "x", firstYear: true, rows: [{ heading: "H", female: 9483.5, male: null }] };
    expect(tableText(t)).toContain("🙆‍♀️ หญิง = 9,483.50 บาท/ปี (ตกเดือนละ 791)");
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
        if (t && t.rows.length < 4) {
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
    expect(t.rows[0]).toEqual({ heading: "ทุน 1,000,000 บาท", female: null, male: 12_000 });
    const text = tableText(t);
    expect(text).not.toContain("หญิง");
    expect(text).toContain("🕵️‍♂️ ชาย = 12,000 บาท/ปี (ตกเดือนละ 1,000)");
  });

  it("headlineFigures uses the middle row, female first", () => {
    const t = { product: "P", age: 30, term: "x", firstYear: false, rows: [
      { heading: "A", female: 100, male: 200 }, { heading: "B", female: 1200, male: 2400 }, { heading: "C", female: 300, male: 400 }, { heading: "D", female: 500, male: 600 },
    ] };
    expect(headlineFigures(t)).toBe("B\nเบี้ย 1,200 บาท/ปี (ตกเดือนละ 100)");
    const m = { ...t, rows: [{ heading: "E", female: null, male: 2400 }] };
    expect(headlineFigures(m)).toBe("E\nเบี้ย 2,400 บาท/ปี (ตกเดือนละ 200)");
  });

  it("the term passes through lifelong()", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    expect(t.term).toContain("ตลอดชีพ");
    expect(t.term).not.toContain("99");
  });
});
