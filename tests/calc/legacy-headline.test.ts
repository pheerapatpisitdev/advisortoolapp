import { describe, expect, it } from "vitest";
import { legacyFromDeath, legacyLevel } from "@/lib/legacy-headline";
import { quoteCard, type CardInput } from "@/lib/quote-card";

/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

/**
 * Every sales page and its card lead with what the family inherits, not the premium
 * (owner, 2026-10-06: "อยากให้ลูกค้าเห็นทุนตัวใหญ่นำสายตา").
 */
describe("the figure a quote leads with", () => {
  it("is the doubled sum while the insured is under the age it stops at, built from the sum", () => {
    const death = { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false };
    expect(legacyFromDeath(death, 1_000_000)).toEqual({ amount: 2_000_000, note: "ทุน 1,000,000 · 2 เท่าก่อนอายุ 60" });
    // a set has no one sum to multiply, so it says only when
    expect(legacyFromDeath({ ...death, sumBefore: 1_150_000 })).toEqual({ amount: 1_150_000, note: "เมื่อเสียชีวิตก่อนอายุ 60" });
  });

  it("is the sum alone once the doubling has stopped", () => {
    const past = { beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true };
    expect(legacyFromDeath(past, 1_000_000)).toEqual({ amount: 1_000_000 });
  });

  it("is a level plan's sum, with the page's words when it has some", () => {
    expect(legacyLevel(1_000_000, "ทุกช่วงอายุ ถึงอายุ 99")).toEqual({ amount: 1_000_000, note: "ทุกช่วงอายุ ถึงอายุ 99" });
    expect(legacyLevel(1_000_000)).toEqual({ amount: 1_000_000 });
  });
});

describe("a card's lead", () => {
  const lead = (input: CardInput) => quoteCard(input, WHILE_CURRENT)?.legacy;
  const plan = (planCode: string, variant: string, age = 35, sumAssured = 1_000_000): CardInput =>
    ({ kind: "plan", planCode, variant, age, sex: "M", sumAssured });

  it("says what each plan's page leads with", () => {
    expect(lead(plan("LIFEPROTECT", "WLF99H"))).toEqual({ amount: "2,000,000", note: "ทุน 1,000,000 · 2 เท่าก่อนอายุ 60" });
    expect(lead(plan("LIFEPROTECT", "WLF99H", 62))).toEqual({ amount: "1,000,000" });
    expect(lead(plan("EASYPROTECT", "W99F06A"))).toEqual({ amount: "1,000,000", note: "ทุกช่วงอายุ ถึงอายุ 99" });
    expect(lead(plan("LIFETREASURE", "H99F18A", 45, 10_000_000))).toEqual({ amount: "10,000,000", note: "ทุกช่วงอายุ ถึงอายุ 99" });
    expect(lead(plan("ISHIELD", "WLCI10"))).toEqual({ amount: "1,000,000" });
    expect(lead(plan("PLB", "PLB10"))).toEqual({ amount: "1,000,000", note: "เสียชีวิตภายใน 10 ปี" });
    expect(lead({ kind: "bundle", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M" }))
      .toEqual({ amount: "1,150,000", note: "เมื่อเสียชีวิตก่อนอายุ 60" });
  });

  /** Bought for the illness cover, so they keep the premium (owner, 2026-10-06). */
  it("leaves the cancer and CI 123 sets on their premium", () => {
    expect(lead({ kind: "bundle", bundleCode: "CANCER_SET", tier: 1, age: 40, sex: "M" })).toBeUndefined();
    expect(lead({ kind: "bundle", bundleCode: "CI123_SET", tier: 1, age: 40, sex: "M" })).toBeUndefined();
  });

  it("leaves a plan with no page and no death benefit on its premium", () => {
    expect(lead(plan("ISMART", "W80F06"))).toBeUndefined();
  });
});
