import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { cashValueSchedule } from "@/calc/cash-value";
import type { QuoteInput } from "@/calc/types";

/** The workbook's own sample: 12PL_A2026-1, หญิง 44, ทุน 3,000,000, รายปี. */
const sample: QuoteInput = {
  planCode: "12PL", variant: "12PL", age: 44, sex: "F", mode: "annual", sumAssured: 3_000_000, riders: [],
};
const by = (r: ReturnType<typeof quote>) => Object.fromEntries(r.items.map((i) => [i.code, i]));

describe("12 พีแอล against its workbook", () => {
  it("prices the base plan as Cal!G13: 66.68 × 3,000 = 200,040.00", () => {
    const r = quote(sample, new Date("2026-11-18"));
    expect(r.items[0]).toMatchObject({ code: "12PL", annual: 20_004_000, eligible: true });
  });

  it("takes ages 0 to 60 and a sum from 100,000", () => {
    expect(quote({ ...sample, age: 60 }).items[0].eligible).toBe(true);
    expect(quote({ ...sample, age: 61 }).items[0].eligible).toBe(false);
  });

  it("prices WP Fit off the 12-year waive period (Cal!D15 0.19)", () => {
    const r = quote({ ...sample, riders: [{ code: "WP", option: "FIT" }] });
    // TRUNC(0.19 × TRUNC(200,040 / 100, 3), 2)
    expect(by(r).WP).toMatchObject({ annual: 38_007, eligible: true });
  });

  it("prices MEX 1,200 and CI 123 110,000 as the input sheet does (F20, F29)", () => {
    const r = quote({ ...sample, riders: [{ code: "MEX", option: "1200" }, { code: "CI123", sumAssured: 110_000 }] });
    expect(by(r).MEX.annual).toBe(949_800);
    // the input sheet's four CI 123 lines, 828.30 + 29.04 + 111.92 + 42.24 = Cal!H25 1,011.50
    const ci = r.items.filter((i) => i.code.startsWith("CI123")).reduce((t, i) => t + i.annual, 0);
    expect(ci).toBe(101_150);
  });

  it("reads the surrender values off TABCV", () => {
    const cv = cashValueSchedule("12PL", "12PL", "F", 44, 3_000_000);
    expect(cv).toHaveLength(41);
    expect(cv[1].amount).toBe(72_000);
    expect(cv[11].amount).toBe(1_809_000);
    expect(cv[37].amount).toBe(3_048_000);
    expect(cv[40].amount).toBe(3_450_000);
  });

  it("pays 990,000 in cash backs and 3,480,000 at 85", () => {
    const r = quote(sample, new Date("2026-11-18"));
    expect(r.maturityBenefit).toMatchObject({ age: 85, amount: 3_480_000, survivalTotal: 990_000, total: 4_470_000 });
  });
});

import { twelvePlTable } from "@/lib/twelvepl-table";
import { keptWithCompany, twelvePlTotals, twelvePlYears } from "@/lib/twelvepl-benefits";

describe("12 พีแอล benefit table (ตารางแสดงผลประโยชน์, หญิง 44, 3,000,000)", () => {
  const t = twelvePlTable(new Date("2026-11-18"));
  const rows = twelvePlYears(t.benefits, 44, t.ageMin, 3_000_000);

  it("has 41 years to 85 with the sheet's cash backs", () => {
    expect(rows).toHaveLength(41);
    expect(rows.slice(0, 4).map((r) => r.cashBack)).toEqual([0, 7_500, 9_000, 10_500]);
    expect(rows[40].cashBack).toBe(3_480_000);
  });

  it("pays the sheet's dividends in examples 2 and 3 (K13 585, M13 702)", () => {
    expect(rows[2].dividend[1]).toBeCloseTo(585, 6);
    expect(rows[2].dividend[2]).toBeCloseTo(702, 6);
    expect(rows.every((r) => r.dividend[0] === 0)).toBe(true);
  });

  it("totals as the sheet's summary (G101, G102, L104, M104)", () => {
    const s = twelvePlTotals(rows, t.benefits.maturityPer1000, 3_000_000);
    expect(s.cashBacks).toBeCloseTo(990_000, 4);
    expect(s.maturity).toBeCloseTo(3_480_000, 4);
    expect(s.guaranteed).toBeCloseTo(4_470_000, 4);
    expect(s.dividends[1]).toBeCloseTo(827_392.5, 3);
    expect(s.dividends[2]).toBeCloseTo(992_871, 3);
  });

  it("grows money kept with the company at 0.5% (G96 4,561,111.04; L96 878,340.63)", () => {
    expect(keptWithCompany(rows.map((r) => r.cashBack), 0.005).at(-1)).toBeCloseTo(4_561_111.0388, 3);
    expect(keptWithCompany(rows.map((r) => r.dividend[1]), 0.005).at(-1)).toBeCloseTo(878_340.6316, 3);
  });

  it("offers the riders the Life Protect page offers", () => {
    expect(t.riders.map((r) => r.code)).toEqual(["WP"]);
    expect(t.medical?.code).toBe("MEB");
    expect(t.illness.map((i) => i.code)).toEqual(["DCI", "CI123", "AP", "ECARE"]);
    expect(t.coverToAge).toBe(85);
    expect(t.ageMax).toBe(60);
  });
});

import { cardInputFrom, quoteCard, valueTableCard } from "@/lib/quote-card";
import { cardPath, valueTablePath } from "@/lib/card-link";

describe("12 พีแอล pictures", () => {
  const today = new Date("2026-11-18");
  const plain = { kind: "plan" as const, planCode: "12PL", variant: "12PL", age: 44, sex: "F" as const, sumAssured: 3_000_000, mode: "annual" as const };

  it("draws a price card with the guaranteed benefits", () => {
    const card = quoteCard(plain, today)!;
    expect(card.premium).toBeTruthy();
    const rows = card.sections.flatMap((s) => s.rows.map((r) => `${r.label} ${r.amount}`));
    expect(rows).toContain("เสียชีวิต ทุกช่วงอายุ ถึงอายุ 85 3,000,000");
    expect(rows).toContain("เงินคืนรายปีรวม (รับรอง) 990,000");
    expect(rows).toContain("ครบสัญญาอายุ 85 ปี 3,480,000");
  });

  it("takes riders in its links, as Life Protect's do", () => {
    const withWp = { ...plain, riders: { waiver: { code: "WP", option: "FIT" } } };
    const back = cardInputFrom(new URLSearchParams(cardPath(withWp).split("?")[1]));
    expect(back).toMatchObject({ planCode: "12PL", riders: { waiver: { code: "WP", option: "FIT" } } });
    expect(quoteCard(withWp, today)?.summary).toBeTruthy();
    const table = valueTableCard(withWp, today)!;
    expect(table.rows).toHaveLength(41);
  });

  it("draws the value table with the cash backs", () => {
    const table = valueTableCard(plain, today)!;
    expect(table.rows).toHaveLength(41);
    expect(table.rows[1]).toMatchObject({ cash: "72,000", cover: "3,000,000" });
    expect(table.rows[1].payout).toBe("7,500");
    expect(valueTablePath(plain)).toContain("plan=12PL");
  });
});

import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";
import { openingGuide } from "@/lib/copilot/guide";

describe("the chat knows 12 พีแอล (owner chose ก ก ก, 2026-11-18)", () => {
  it("reads the name without taking 12 for an age", () => {
    expect(planNamedIn("12PL หญิง 44 ทุน 3 ล้าน")?.code).toBe("12PL");
    expect(planNamedIn("สิบสองพีแอล ชาย 35")?.code).toBe("12PL");
    expect(planNamedIn("ทุน 12 ล้าน ชาย 40 life treasure")?.code).toBe("LIFETREASURE");
  });

  it("prices it with the cash backs, maturity and an unguaranteed dividend", () => {
    const r = priceNamedPlan("12PL หญิง 44 ทุน 3 ล้าน", "12PL", "12 พีแอล (12PL)");
    expect(r.priced).toBe(true);
    expect(r.text).toContain("เบี้ยปีละ **200,040 บาท**");
    expect(r.text).toContain("เงินคืนทุกปี ตั้งแต่ปีที่ 2 รวม 990,000 บาท");
    expect(r.text).toContain("ครบสัญญาอายุ 85 รับ 3,480,000 บาท");
    expect(r.text).toContain("(ไม่รับรอง) ตัวอย่างที่ 2 รวม 827,393 บาท");
  });

  it("offers it as a start button", () => {
    const items = openingGuide().flatMap((g) => g.items);
    expect(items.map((i) => i.label)).toContain("12PL · หญิง 44 ทุน 3 ล้าน");
  });
});
