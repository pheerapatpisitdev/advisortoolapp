import { describe, expect, it } from "vitest";
import {
  PA_FAMILIES, paClassesOf, paFamily, paPerDay, paPremium, paQuoteText, paRows, paSumAfterRenewals,
} from "@/lib/pa-plans";

/** figures copied from the brochure (TH/ENG, 2026-11-14) so a typo in the table fails here */
describe("PA plans against the brochure", () => {
  it("has 2 Classic, 5 Platinum and 10 Max plans with their codes", () => {
    expect(PA_FAMILIES.map((f) => f.plans.map((p) => p.code))).toEqual([
      ["PAC04", "PAC05"],
      ["PAP01", "PAP02", "PAP03", "PAP04", "PAP05"],
      ["PAM01", "PAM02", "PAM03", "PAM04", "PAM05", "PAM06", "PAM07", "PAM08", "PAM09", "PAM10"],
    ]);
  });

  it("prices Classic by class, class 3 only on Classic A", () => {
    const [a, b] = paFamily("classic").plans;
    expect([1, 2, 3, 4].map((c) => paPremium(a, c))).toEqual([3_500, 4_300, 5_150, null]);
    expect([1, 2, 3, 4].map((c) => paPremium(b, c))).toEqual([4_500, 5_500, null, null]);
    expect(a.medical).toBe(80_000);
    expect(b.motorcycle).toBe(500_000);
  });

  it("prices Platinum for classes 1–2", () => {
    const f = paFamily("platinum");
    expect(f.plans.map((p) => paPremium(p, 1))).toEqual([4_800, 8_000, 11_500, 17_500, 32_000]);
    expect(f.plans.map((p) => paPremium(p, 2))).toEqual([6_000, 9_600, 13_500, 20_000, 38_500]);
    expect(f.plans.map((p) => p.weekly)).toEqual([1_000, 2_000, 3_000, 5_000, 10_000]);
    expect(f.plans.map((p) => p.medical)).toEqual([100_000, 120_000, 150_000, 200_000, 300_000]);
    expect(f.plans.map((p) => p.murder)).toEqual([750_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000]);
  });

  it("prices Max at 2,250 a million, the same for classes 1 and 2", () => {
    const f = paFamily("max");
    expect(f.plans.map((p) => paPremium(p, 1))).toEqual([2_250, 4_500, 6_750, 9_000, 11_250, 13_500, 15_750, 18_000, 20_250, 22_500]);
    expect(f.plans.every((p) => paPremium(p, 2) === paPremium(p, 1))).toBe(true);
    expect(f.plans[0].murder).toBe(500_000);
    expect(f.plans[9].death).toBe(10_000_000);
    expect(f.plans.some((p) => p.medical || p.weekly)).toBe(false);
  });

  it("takes the brochure's ages and classes", () => {
    expect(PA_FAMILIES.map((f) => [f.ageMin, f.ageMax])).toEqual([[0, 64], [16, 64], [16, 64]]);
    expect(PA_FAMILIES.map(paClassesOf)).toEqual([[1, 2, 3], [1, 2], [1, 2]]);
  });
});

describe("what the page shows", () => {
  it("lists only the cover a plan has", () => {
    expect(paRows(paFamily("max").plans[0]).map((r) => r.key)).toEqual(["death", "murder", "motorcycle"]);
    expect(paRows(paFamily("platinum").plans[0]).map((r) => r.key)).toEqual(["death", "murder", "motorcycle", "medical", "weekly"]);
  });

  it("grows the death sum 25% by the sixth year and rounds the day rate up", () => {
    expect(paSumAfterRenewals(paFamily("platinum").plans[1])).toBe(2_500_000);
    expect(paPerDay(8_000)).toBe(22);
  });

  it("writes the copied quote, and none outside the ages or classes", () => {
    const f = paFamily("platinum");
    const text = paQuoteText({ family: f, plan: f.plans[1], cls: 1, age: 35 })!;
    expect(text).toContain("PA Platinum แผน Platinum 02");
    expect(text).toContain("เบี้ย 8,000 บาท/ปี");
    expect(text).toContain("สัปดาห์ละ 2,000 บาท");
    expect(text).toContain("ปีที่ 6 ทุนชีวิต 2,500,000 บาท");
    expect(paQuoteText({ family: f, plan: f.plans[1], cls: 1, age: 10 })).toBeUndefined();
    expect(paQuoteText({ family: f, plan: f.plans[1], cls: 3, age: 35 })).toBeUndefined();
    const m = paFamily("max");
    expect(paQuoteText({ family: m, plan: m.plans[0], cls: 1, age: 30 })).not.toContain("ค่ารักษา");
  });
});
