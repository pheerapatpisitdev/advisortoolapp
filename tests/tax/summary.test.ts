import { describe, expect, it } from "vitest";
import { calculatePersonal, EMPTY_PERSONAL_INPUT, type PersonalInput } from "@/lib/tax/personal";
import { RULES_2569 as R } from "@/lib/tax/rules/2569";
import { savingPer10k, TAX_PRODUCT_LINKS, taxHeadline, taxSummaryText, unusedRights } from "@/lib/tax/summary";
import { CALC_PATHS } from "@/lib/auth/calc-paths";

/** the mockup's own case: 60,000 a month, 120,000 bonus, life 50,000, health 15,000, 36,000 withheld */
const SAMPLE: PersonalInput = {
  ...EMPTY_PERSONAL_INPUT,
  incomes: [{ occupation: "employee", amount: 60000 * 12 + 120000 }],
  withheld: 36000,
  deductions: { ...EMPTY_PERSONAL_INPUT.deductions, socialSecurity: 10500, lifeInsurance: 50000, healthInsurance: 15000 },
};

describe("the tax page's summary", () => {
  const r = calculatePersonal(SAMPLE, R);

  it("agrees with the figures the owner approved on the mockup", () => {
    expect(r.netIncome).toBe(604500);
    expect(r.tax).toBe(43175);
    expect(taxHeadline(r)).toEqual({ title: "ต้องจ่ายเพิ่มตอนยื่นแบบ", amount: 7175, tone: "pay" });
    expect(savingPer10k(r)).toBe(1500);
  });

  it("lists the rights still unused, life and health sharing one limit", () => {
    const left = Object.fromEntries(unusedRights(r).map((l) => [l.key, l.remaining]));
    expect(left.lifeInsurance).toBe(35000);
    expect(left.healthInsurance).toBe(10000);
    expect(left.pensionInsurance).toBe(126000);
    expect(left.rmf).toBe(252000);
  });

  it("copies a summary with the tax, the balance and what is left", () => {
    const text = taxSummaryText(r, R);
    expect(text).toContain("สรุปภาษีเงินได้ปี 2569 (ประมาณการ)");
    expect(text).toContain("ภาษีทั้งปี 43,175 บาท");
    expect(text).toContain("ถูกหักไปแล้ว 36,000 บาท → ต้องจ่ายเพิ่มตอนยื่นแบบ 7,175 บาท");
    expect(text).toContain("• ประกันชีวิตแบบบำนาญ 126,000 บาท");
    expect(text).toContain("ประหยัดภาษี 1,500 บาท");
  });

  it("copies nothing before an income is typed", () => {
    expect(taxSummaryText(calculatePersonal(EMPTY_PERSONAL_INPUT, R), R)).toBe("");
  });

  it("offers no further deduction where the 0.5% method sets the tax", () => {
    const flat = calculatePersonal({ ...EMPTY_PERSONAL_INPUT, incomes: [{ occupation: "merchant", amount: 2000000, actualExpense: 1990000 }] }, R);
    expect(flat.methodUsed).toBe(2);
    expect(unusedRights(flat)).toEqual([]);
    expect(taxSummaryText(flat, R)).not.toContain("ยังลดหย่อนได้อีก");
  });

  it("links only to calculators that exist", () => {
    for (const { href } of Object.values(TAX_PRODUCT_LINKS)) expect(CALC_PATHS).toContain(href);
  });
});
