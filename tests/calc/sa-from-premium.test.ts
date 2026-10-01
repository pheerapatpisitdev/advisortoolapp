import { describe, it, expect } from "vitest";
import { sumAssuredFromPremium } from "@/calc/sa-from-premium";
import json from "../../data/rates/ishield.json";
import type { PlanRates } from "@/calc/types";

const d = json as unknown as PlanRates;

describe("sumAssuredFromPremium (Excel Cal!I40)", () => {
  it("WLCI10 M 35, annual 100,000 → ROUNDUP(100,000*1000/66.98 = 1,492,982.98) = 1,492,983", () => {
    expect(sumAssuredFromPremium(d, { variant: "WLCI10", sex: "M", age: 35, mode: "annual", targetPremium: 100_000 })).toBe(1_492_983);
  });
  it("semi 52,000 → annual 100,000 → same SA", () => {
    expect(sumAssuredFromPremium(d, { variant: "WLCI10", sex: "M", age: 35, mode: "semi", targetPremium: 52_000 })).toBe(1_492_983);
  });
  it("monthly 9,000 → annual 100,000 → same SA", () => {
    expect(sumAssuredFromPremium(d, { variant: "WLCI10", sex: "M", age: 35, mode: "monthly", targetPremium: 9_000 })).toBe(1_492_983);
  });
  it("exact division rounds up only when needed: WLCI10 M 11 rate 44.21, premium 22,105 → 500,000", () => {
    expect(sumAssuredFromPremium(d, { variant: "WLCI10", sex: "M", age: 11, mode: "annual", targetPremium: 22_105 })).toBe(500_000);
  });
  it("does not round floating-point noise up a whole baht: WLCI20 F 39, 69,000 a year → 1,875,000", () => {
    // 69,000 × 1000 / (rate − discount) is 1,875,000.0000000002 in binary; Excel sees it as exact
    expect(sumAssuredFromPremium(d, { variant: "WLCI20", sex: "F", age: 39, mode: "annual", targetPremium: 69_000 })).toBe(1_875_000);
  });
  it("undefined when no rate", () => {
    expect(sumAssuredFromPremium(d, { variant: "WLCI10", sex: "M", age: 60, mode: "annual", targetPremium: 1000 })).toBeUndefined();
  });
});
