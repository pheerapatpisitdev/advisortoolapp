import { describe, expect, it } from "vitest";
import { definePlan, money, type NumberSheet } from "@/lib/content/numbers";
import { NUMBERS_PLANS } from "@/lib/content/numbers-plans";
import { getBundle } from "@/calc/bundles/registry";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { hasLadder, headlineFigures, headlineOwner, otherPeople, premiumTable, premiumTableOf, restatedFigures, tableCells, tableText } from "@/lib/content/premium-table";

const today = new Date("2026-10-05");

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
      });
    }
  });

  it("tableText formats a row", () => {
    const t = premiumTable("/lifeprotect", 30, today)!;
    const text = tableText(t);
    const r = t.rows[0];
    expect(text).toContain(`🙆‍♀️ หญิง = ${money(r.female!)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(r.female! / 12))})`);
    expect(text).toContain(`🕵️‍♂️ ชาย = ${money(r.male!)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(r.male! / 12))})`);
    expect(text).toContain(`${r.heading}\n(${r.note})\n🙆‍♀️`);
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
    expect(t.rows[0]).toEqual({ heading: "ทุน 1,000,000 บาท", female: null, male: 12_000 });
    const text = tableText(t);
    expect(text).not.toContain("หญิง");
    expect(text).toContain("🕵️‍♂️ ชาย = 12,000 บาท/ปี (ตกเดือนละ 1,000)");
  });

  it("headlineFigures: the product, the middle row's sum with its note, and whose premium it is, female first", () => {
    const t = { product: "P", age: 30, term: "x", firstYear: false, rows: [
      { heading: "A", female: 100, male: 200 }, { heading: "B", note: "ทุน 1 × 2", female: 1200, male: 2400 }, { heading: "C", female: 300, male: 400 }, { heading: "D", female: 500, male: 600 },
    ] };
    expect(headlineFigures(t)).toBe("P\n💁‍♀️ B (ทุน 1 × 2)\n💰 เบี้ย 1,200 บาท/ปี (ตกเดือนละ 100) (หญิง อายุ 30 ปี)");
    const m = { ...t, age: 45, firstYear: true, rows: [{ heading: "E", female: null, male: 2400 }] };
    expect(headlineFigures(m)).toBe("P\n💁‍♀️ E\n💰 เบี้ยปีแรก 2,400 บาท/ปี (ตกเดือนละ 200) (ชาย อายุ 45 ปี)");
  });

  it("headlineFigures carries a package's note too", () => {
    const t = { product: "P", age: 30, term: "x", firstYear: true, note: "เบี้ยรวม X", rows: [{ heading: "A", female: 100, male: 200 }] };
    expect(headlineFigures(t)).toBe("P\n💁‍♀️ A (เบี้ยรวม X)\n💰 เบี้ยปีแรก 100 บาท/ปี (ตกเดือนละ 9) (หญิง อายุ 30 ปี)");
  });

  it("headlineFigures takes the owner's row and sex: a man of 35 on Life Protect's 1,000,000 cover", () => {
    const t = premiumTable("/lifeprotect", 35, today)!;
    const rung = t.rows.findIndex((r) => r.heading === "ประกันชีวิตคุ้มครอง 1,000,000 บาท");
    expect(rung).toBe(1);
    const male = t.rows[rung].male!;
    expect(headlineFigures(t, { sex: "M", rung })).toBe([
      "Life Protect x 2",
      "💁‍♀️ ประกันชีวิตคุ้มครอง 1,000,000 บาท (ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      `💰 เบี้ย ${money(male)} บาท/ปี (ตกเดือนละ ${money(Math.ceil(male / 12))}) (ชาย อายุ 35 ปี)`,
    ].join("\n"));
  });

  it("headlineFigures falls back to the other sex where the chosen one is not priced, and says whose it is", () => {
    const t = { product: "P", age: 40, term: "x", firstYear: false, rows: [{ heading: "A", female: 1200, male: null }] };
    expect(headlineFigures(t, { sex: "M", rung: 0 })).toBe("P\n💁‍♀️ A\n💰 เบี้ย 1,200 บาท/ปี (ตกเดือนละ 100) (หญิง อายุ 40 ปี)");
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
      "🙆‍♀️ หญิง = 5,400 บาท/ปี (ตกเดือนละ 450)",
      "🕵️‍♂️ ชาย = 6,350 บาท/ปี (ตกเดือนละ 530)",
      "",
      "ประกันชีวิตคุ้มครอง 1,000,000 บาท",
      "(ทุน 500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "🙆‍♀️ หญิง = 10,800 บาท/ปี (ตกเดือนละ 900)",
      "🕵️‍♂️ ชาย = 12,700 บาท/ปี (ตกเดือนละ 1,059)",
      "",
      "ประกันชีวิตคุ้มครอง 2,000,000 บาท",
      "(ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "🙆‍♀️ หญิง = 21,600 บาท/ปี (ตกเดือนละ 1,800)",
      "🕵️‍♂️ ชาย = 25,400 บาท/ปี (ตกเดือนละ 2,117)",
      "",
      "ประกันชีวิตคุ้มครอง 3,000,000 บาท",
      "(ทุน 1,500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "🙆‍♀️ หญิง = 32,400 บาท/ปี (ตกเดือนละ 2,700)",
      "🕵️‍♂️ ชาย = 38,100 บาท/ปี (ตกเดือนละ 3,175)",
      "",
      "ประกันชีวิตคุ้มครอง 4,000,000 บาท",
      "(ทุน 2,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "🙆‍♀️ หญิง = 43,200 บาท/ปี (ตกเดือนละ 3,600)",
      "🕵️‍♂️ ชาย = 50,800 บาท/ปี (ตกเดือนละ 4,234)",
      "",
      "ประกันชีวิตคุ้มครอง 5,000,000 บาท",
      "(ทุน 2,500,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "🙆‍♀️ หญิง = 54,000 บาท/ปี (ตกเดือนละ 4,500)",
      "🕵️‍♂️ ชาย = 63,500 บาท/ปี (ตกเดือนละ 5,292)",
    ].join("\n"));
    // the middle row by default, a woman's premium first
    expect(headlineFigures(t)).toBe([
      "Life Protect x 2",
      "💁‍♀️ ประกันชีวิตคุ้มครอง 2,000,000 บาท (ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)",
      "💰 เบี้ย 21,600 บาท/ปี (ตกเดือนละ 1,800) (หญิง อายุ 30 ปี)",
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
    const t = premiumTable("/cancer", 30, today)!;
    const text = tableText(t);
    expect(text).toContain([
      "ประกันมะเร็งทุน 300,000 บาท",
      "(ชดเชยนอนโรงพยาบาลวันละ 1,000 บาท · คู่กับ Life Protect x 2 ทุน 150,000 บาท)",
      "🙆‍♀️ หญิง = 2,176.29 บาท/ปี (ตกเดือนละ 182)",
      "🕵️‍♂️ ชาย = 2,255.39 บาท/ปี (ตกเดือนละ 188)",
    ].join("\n"));
    expect(text).toContain("ประกันมะเร็งทุน 3,000,000 บาท\n(ชดเชยนอนโรงพยาบาลวันละ 6,000 บาท · คู่กับ Life Protect x 2 ทุน 600,000 บาท)\n");
    expect(headlineFigures(t)).toBe([
      "ชุดประกันมะเร็ง",
      "💁‍♀️ ประกันมะเร็งทุน 500,000 บาท (ชดเชยนอนโรงพยาบาลวันละ 2,000 บาท · คู่กับ Life Protect x 2 ทุน 150,000 บาท)",
      "💰 เบี้ยปีแรก 2,398.58 บาท/ปี (ตกเดือนละ 200) (หญิง อายุ 30 ปี)",
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

  it("the table's cells are its yearly and ตกเดือนละ figures", () => {
    expect(tableCells(t)).toContain(6803);
    expect(tableCells(t)).toContain(567);
  });

  it("flag a premium of the table restated, yearly or a month, however it is written", () => {
    expect(restatedFigures("ทุน 2 ล้าน เบี้ยแค่ 6,803 บาท/ปี", brief, t)).toEqual(["6,803 บาท"]);
    expect(restatedFigures("ตกเดือนละ 567 บาทเท่านั้น", brief, t)).toEqual(["567 บาท"]);
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
