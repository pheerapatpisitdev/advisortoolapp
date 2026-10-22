import { describe, expect, it } from "vitest";
import { afterPlan, tally, withPlan } from "@/lib/fhc/after";
import { scores, type FhcInput } from "@/lib/fhc/health";
import type { PlanResult } from "@/lib/plan/recommend";

const F: FhcInput = {
  age: 38, sex: "M", income: 58_000, expense: 40_000, lifeCover: 1_000_000, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "cover", retireAge: 60, retireMonthly: 28_000,
  pensionHave: 15_000, budget: 5_800, expectancy: 85, work: "full",
  cash: 100_000, fixed: 50_000, otherSaving: 0, homeLoan: 0, carLoan: 300_000, otherDebt: 0,
  taxFund: 0, stocks: 0, people: [{ relation: "child", age: 6 }],
};

const plan = (areas: PlanResult["areas"], usedAnnual: number): PlanResult => ({
  areas, budget: 5_800, usedAnnual, taxSaved: 0, order: areas.map((a) => a.key), orderedBy: "fixed", summary: "",
});
const offer = (cover: number, annual: number) => ({ product: "x", href: "/x", sum: cover, cover, annual, firstYear: false });

// health and CI bought in full, life only part of the way, nothing left for retirement
const PLAN = plan([
  { key: "health", unit: "room", have: 0, should: 5_500, status: "fits", offer: offer(5_500, 2_134_000) },
  { key: "ci", unit: "sum", have: 0, should: 2_088_000, status: "fits", offer: offer(2_100_000, 685_000) },
  { key: "life", unit: "sum", have: 1_150_000, should: 8_810_000, status: "reduced", offer: offer(4_000_000, 1_480_000) },
  { key: "retire", unit: "pension", have: 15_000, should: 28_000, status: "short" },
], 4_299_000);

const byKey = (k: string) => afterPlan(F, PLAN)!.scores.find((s) => s.key === k)!;

describe("withPlan", () => {
  it("adds what the plan buys to what the customer holds", () => {
    const g = withPlan(F, PLAN)!;
    expect([g.lifeCover, g.ciCover, g.healthNow, g.healthRoom, g.pensionHave]).toEqual([5_000_000, 2_100_000, "private", 5_500, 15_000]);
  });

  it("does not count an offer the plan shows but cannot pay for", () => {
    const p = plan([{ key: "retire", unit: "pension", have: 0, should: 28_000, status: "short", offer: offer(5_000, 9_000_000) }], 0);
    expect(withPlan(F, p)).toBeNull();
  });

  it("keeps a larger room the customer already has", () => {
    const g = withPlan({ ...F, healthNow: "private", healthRoom: 8_000 }, PLAN)!;
    expect(g.healthRoom).toBe(8_000);
  });
});

describe("afterPlan", () => {
  it("turns health and CI green and lifts life, saying why life stops short", () => {
    expect(byKey("healthCi")).toMatchObject({ level: "green", shown: "มีครบ", same: false });
    expect(byKey("life")).toMatchObject({ level: "yellow", shown: "58% ของที่ควรมี" });
    expect(byKey("life").note).toBe("งบไม่พอถึง 100%");
  });

  it("takes the new premiums from what is left each month", () => {
    const now = scores(F).find((s) => s.key === "saving")!;
    expect(now.shown).toBe("31% ของรายได้");
    // 42,990 baht a year is 3,583 a month: (18,000 - 3,583) / 58,000
    expect(byKey("saving")).toMatchObject({ shown: "25% ของรายได้", note: "หักเบี้ยใหม่แล้ว" });
  });

  it("leaves what insurance cannot change as it was", () => {
    expect(byKey("emergency")).toMatchObject({ same: true, note: "ประกันไม่ได้ช่วยด้านนี้" });
    expect(byKey("debt").same).toBe(true);
    expect(byKey("retire")).toMatchObject({ same: true, note: "งบหมดที่ด้านก่อนหน้า" });
  });

  it("is null when the plan spends nothing", () => {
    expect(afterPlan(F, plan([{ key: "life", unit: "sum", have: 1, should: 1, status: "covered" }], 0))).toBeNull();
  });
});

describe("tally", () => {
  it("counts the colours, leaving out a score with no data", () => {
    expect(tally([{ level: "green" }, { level: "green" }, { level: "red" }, { level: "none" }])).toEqual({ green: 2, yellow: 0, red: 1 });
  });
});
