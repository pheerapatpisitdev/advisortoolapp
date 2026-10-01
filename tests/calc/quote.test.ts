import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";

const base: QuoteInput = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};

describe("quote (PLB)", () => {
  it("base only, annual", () => {
    const r = quote(base, new Date("2026-09-03"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ code: "PLB12", amount: 1_000_000, annual: 547_000, modal: 547_000, eligible: true });
    expect(r.totalModal).toBe(547_000);
    expect(r.totalAnnual).toBe(547_000);
    expect(r.warnings).toEqual([]);
    expect(r.meta).toEqual({ planName: "โพรเทคชั่นไลฟ์ (PLB)", version: "A2026-1", expiresOn: "2027-03-31", expired: false, minMonthlyTotal: 1_000 });
    expect(r.availability.map((a) => a.code)).toEqual(["AP", "ECARE", "MEB"]);
  });

  it("base + AP + ECARE + MEB, monthly", () => {
    const r = quote({
      ...base, mode: "monthly",
      riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 500_000 }, { code: "MEB", plan: 1000 }],
    });
    const by = Object.fromEntries(r.items.map((i) => [i.code, i]));
    expect(by.PLB12.modal).toBe(49_230);
    expect(by.AP.modal).toBe(27_000);
    expect(by.ECARE.modal).toBe(29_250);
    expect(by.MEB.annual).toBeGreaterThan(0);
    expect(r.totalModal).toBe(by.PLB12.modal + by.AP.modal + by.ECARE.modal + by.MEB.modal);
    // nothing wrong with the arrangement; only the occupation class it assumed, said once
    expect(r.warnings.map((w) => [w.level, w.code])).toEqual([["warn", "OCCUPATION_CLASS"]]);
  });

  it("AP+ECARE over 5x base: both excluded from total, warning added (Excel behaviour)", () => {
    const r = quote({ ...base, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }] });
    const by = Object.fromEntries(r.items.map((i) => [i.code, i]));
    expect(by.AP).toMatchObject({ eligible: false, modal: 0, message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
    expect(by.ECARE).toMatchObject({ eligible: false, modal: 0, message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
    expect(r.totalModal).toBe(by.PLB12.modal);
    expect(r.warnings).toContainEqual({ level: "error", code: "AP_ECARE_5X", message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" });
  });

  it("monthly total under 1,000 → warning", () => {
    const r = quote({ ...base, sex: "F", sumAssured: 300_000, mode: "monthly" });
    expect(r.totalModal).toBe(9_909);
    expect(r.warnings).toContainEqual({ level: "error", code: "MIN_MONTHLY", message: "เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท" });
  });

  it("age outside base range → base ineligible, error warning", () => {
    const r = quote({ ...base, age: 19 });
    expect(r.items[0]).toMatchObject({ code: "PLB12", eligible: false, modal: 0, message: "ไม่สามารถซื้อได้" });
    expect(r.warnings).toContainEqual({ level: "error", code: "BASE_AGE", message: "อายุรับประกัน 20 - 59 ปี" });
  });

  it("base SA under minimum → error warning, still calculates", () => {
    const r = quote({ ...base, sumAssured: 200_000 });
    expect(r.items[0].modal).toBeGreaterThan(0);
    expect(r.warnings).toContainEqual({ level: "error", code: "BASE_SA_MIN", message: "จำนวนเงินเอาประกันภัยขั้นต่ำ 300,000 บาท" });
  });

  it("rider with bad input → item message, excluded", () => {
    const r = quote({ ...base, riders: [{ code: "MEB", plan: 999 }] });
    const meb = r.items.find((i) => i.code === "MEB")!;
    expect(meb).toMatchObject({ eligible: false, modal: 0, message: "MEB เกินกว่าที่กำหนด" });
  });

  it("expired when today is after expiresOn", () => {
    expect(quote(base, new Date("2027-04-01")).meta.expired).toBe(true);
    expect(quote(base, new Date("2027-03-31")).meta.expired).toBe(false);
  });

  it("unknown plan throws", () => {
    expect(() => quote({ ...base, planCode: "NOPE" })).toThrow(/unknown plan/i);
  });
});
