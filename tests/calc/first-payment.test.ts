import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { firstMonthlyPayment, firstPaymentLines } from "@/lib/first-payment";

const monthly = (total: number, belowMinimum = false): ModePremium => ({ mode: "monthly", total, belowMinimum });

/** The company collects the first two monthly instalments with the application. */
describe("the first monthly payment", () => {
  it("is two instalments, to the satang, said in whole baht", () => {
    expect(firstMonthlyPayment([monthly(180_816)])).toBe(361_632);
    expect(firstPaymentLines(monthly(180_816))).toEqual(["(ชำระเบี้ยครั้งแรก 2 งวด 3,616 บาท)"]);
  });

  it("is nothing for an instalment that is not monthly, or one the company will not take", () => {
    expect(firstPaymentLines({ mode: "annual", total: 2_000_000, belowMinimum: false })).toEqual([]);
    expect(firstPaymentLines(monthly(50_000, true))).toEqual([]);
    expect(firstMonthlyPayment([monthly(50_000, true)])).toBeUndefined();
  });
});
