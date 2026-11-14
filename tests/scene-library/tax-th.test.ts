import { describe, expect, it } from "vitest";
import {
  HEALTH_PARENTS_CAP, HEALTH_SELF_CAP, HEALTH_WITH_LIFE_CAP, isTaxRate, LIFE_CAP, PENSION_CAP, PENSION_PERCENT, PENSION_RETIRE_CAP,
  refundAt, TAX_BRACKETS, TAX_CAPS, TAX_FIGURES, TAX_WORD_FIGURES, TAX_FOOT, TAX_RATES, TAX_YEAR,
} from "@/lib/scene-library/tax-th";
import { RULES_2569 } from "@/lib/tax/rules/2569";

/** the spec's table (2026-11-14-devices-life-tax-design.md), pinned: a change here is a change the owner must see */
describe("tax table", () => {
  it("is ปีภาษี 2569", () => {
    expect(TAX_YEAR).toBe("ปีภาษี 2569");
  });
  it("has the eight brackets on net income", () => {
    expect(TAX_BRACKETS).toEqual([
      { from: 0, to: 150_000, rate: 0 },
      { from: 150_001, to: 300_000, rate: 5 },
      { from: 300_001, to: 500_000, rate: 10 },
      { from: 500_001, to: 750_000, rate: 15 },
      { from: 750_001, to: 1_000_000, rate: 20 },
      { from: 1_000_001, to: 2_000_000, rate: 25 },
      { from: 2_000_001, to: 5_000_000, rate: 30 },
      { from: 5_000_001, to: null, rate: 35 },
    ]);
    expect(TAX_RATES).toEqual([5, 10, 15, 20, 25, 30, 35]);
  });
  it("has the deduction caps", () => {
    expect(LIFE_CAP).toBe(100_000);
    expect(HEALTH_SELF_CAP).toBe(25_000);
    expect(HEALTH_WITH_LIFE_CAP).toBe(100_000);
    expect(HEALTH_PARENTS_CAP).toBe(15_000);
    expect(PENSION_PERCENT).toBe(15);
    expect(PENSION_CAP).toBe(200_000);
    expect(PENSION_RETIRE_CAP).toBe(500_000);
  });
  it("lists the caps as the taxcap device draws them, with the footer", () => {
    expect(TAX_CAPS).toEqual([
      { label: "เบี้ยประกันชีวิต (กรมธรรม์ 10 ปีขึ้นไป)", cap: 100_000 },
      { label: "เบี้ยประกันสุขภาพตนเอง", cap: 25_000, note: "รวมกับประกันชีวิตไม่เกิน 100,000" },
      { label: "เบี้ยประกันสุขภาพพ่อแม่", cap: 15_000 },
      { label: "เบี้ยประกันชีวิตแบบบำนาญ", cap: 200_000, note: "15% ของเงินได้ ไม่เกิน 200,000 (รวมกับกองทุนเพื่อการเกษียณอื่นไม่เกิน 500,000)" },
    ]);
    expect(TAX_FOOT).toBe("ตามเกณฑ์กรมสรรพากร ตรวจสอบเงื่อนไขก่อนใช้สิทธิ");
  });
  it("knows its rates", () => {
    for (const r of TAX_RATES) expect(isTaxRate(r)).toBe(true);
    for (const r of [0, 12, 40, 5.5, -5]) expect(isTaxRate(r)).toBe(false);
  });
  it("gives every figure of the table", () => {
    for (const n of [2569, 100_000, 25_000, 15_000, 200_000, 500_000, 15, 10, 35, 150_000, 5_000_000]) expect(TAX_FIGURES.has(n), String(n)).toBe(true);
  });
  it("gives a tax device's AI-written words only the year: no cap, threshold or rate", () => {
    expect([...TAX_WORD_FIGURES]).toEqual([2569]);
  });
  it("refundAt: the premium, capped at the life cap, times the rate", () => {
    expect(refundAt(50_000, 10)).toBe(5_000);
    expect(refundAt(100_000, 35)).toBe(35_000);
    expect(refundAt(150_000, 20)).toBe(20_000);
    expect(refundAt(33_333, 5)).toBe(1_667);
    expect(refundAt(0, 20)).toBe(0);
    expect(refundAt(-10, 20)).toBe(0);
  });
});

/**
 * The /tax calculator's rules (src/lib/tax/rules/2569.ts) and the tax devices' table must say the same law. Test
 * only: the drawing code never imports the calculator's rules (the Remotion bundle stays as it is).
 */
describe("tax table = the /tax calculator's RULES_2569", () => {
  it("is the same tax year", () => {
    expect(TAX_YEAR).toBe(`ปีภาษี ${RULES_2569.taxYear}`);
  });
  it("has the same brackets: the same tops and rates", () => {
    expect(TAX_BRACKETS.map((b) => ({ upTo: b.to, rate: b.rate }))).toEqual(RULES_2569.personalBrackets.map((b) => ({ upTo: b.upTo, rate: Math.round(b.rate * 100) })));
    // each bracket starts a baht above the last one's top
    TAX_BRACKETS.forEach((b, i) => expect(b.from).toBe(i ? (TAX_BRACKETS[i - 1].to ?? NaN) + 1 : 0));
  });
  it("has the same caps", () => {
    const a = RULES_2569.allowance;
    // life alone and life with the own health premium: the calculator's one combined 100,000
    expect(LIFE_CAP).toBe(a.lifeHealthCombined);
    expect(HEALTH_WITH_LIFE_CAP).toBe(a.lifeHealthCombined);
    expect(HEALTH_SELF_CAP).toBe(a.health);
    expect(HEALTH_PARENTS_CAP).toBe(a.parentHealth);
    expect(PENSION_PERCENT).toBe(Math.round(a.pensionRate * 100));
    expect(PENSION_CAP).toBe(a.pensionCap);
    expect(PENSION_RETIRE_CAP).toBe(a.retirementGroupCap);
  });
});
