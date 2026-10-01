import { describe, expect, it } from "vitest";
import {
  ciNeed, cleanInput, defaultBudget, defaultRetireMonthly, healthNeed, lifeNeed, marginalRate, retireNeed, taxSaved, type PlanInput,
} from "@/lib/plan/needs";

/** the owner's own example, 2026-09-25 */
const OWNER: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
  otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 12_000, hospital: "private", lifeWant: "save",
  retireAge: 60, retireMonthly: 17_500, pensionHave: 0, retireLump: 0, budget: 4_000,
};

describe("lifeNeed", () => {
  it("works the owner's example to the baht", () => {
    const n = lifeNeed(OWNER);
    expect(n.years).toBe(17);
    expect(n.support).toBe(5_100_000);
    expect(n.education).toBe(770_000 + 640_000);
    expect(n.need).toBe(8_110_000);
    expect(n.gap).toBe(7_410_000);
    expect(n.doubled).toBe(true);
    expect(n.sumAssured).toBe(4_000_000);
  });

  it("covers debts and a funeral when nobody depends on you", () => {
    const n = lifeNeed({ ...OWNER, children: [], debts: 0, lifeCover: 0, savings: 0 });
    expect(n.years).toBe(0);
    expect(n.need).toBe(100_000);
    expect(n.sumAssured).toBe(500_000);
  });

  it("supports other dependants for ten years", () => {
    expect(lifeNeed({ ...OWNER, children: [], otherDependants: true }).years).toBe(10);
  });

  it("does not halve the sum when support runs past sixty", () => {
    const n = lifeNeed({ ...OWNER, age: 50, children: [5] });
    expect(n.doubled).toBe(false);
    expect(n.sumAssured).toBeGreaterThanOrEqual(n.gap);
  });

  it("ignores grown-up children", () => {
    expect(lifeNeed({ ...OWNER, children: [25] }).years).toBe(0);
  });

  it("recommends nothing when cover already exceeds the need", () => {
    const n = lifeNeed({ ...OWNER, lifeCover: 20_000_000 });
    expect(n.gap).toBe(0);
    expect(n.sumAssured).toBe(0);
  });
});

describe("healthNeed", () => {
  it("counts a private policy's room as cover", () => {
    expect(healthNeed({ ...OWNER, healthNow: "private", healthRoom: 6_000 }).covered).toBe(true);
  });
  it("does not count employer welfare", () => {
    const h = healthNeed({ ...OWNER, healthNow: "employer" });
    expect(h.covered).toBe(false);
    expect(h.plan).toBe("SILVER");
    expect(h.room).toBe(5_500);
  });
});

describe("ciNeed, retireNeed", () => {
  it("wants three years of income", () => {
    expect(ciNeed({ ...OWNER, ciCover: 500_000 })).toEqual({ need: 1_800_000, have: 500_000, gap: 1_300_000 });
  });
  it("wants what the customer asked for, seventy percent of spending by default", () => {
    expect(retireNeed(OWNER).should).toBe(17_500);
    expect(defaultRetireMonthly(25_000)).toBe(17_500);
  });
  it("counts the expected pension and the lump sum spread to 85", () => {
    // 1,500,000 over (85 - 60) × 12 = 5,000 a month
    const n = retireNeed({ ...OWNER, retireMonthly: 20_000, pensionHave: 3_000, retireLump: 1_500_000 });
    expect(n).toEqual({ should: 20_000, have: 8_000, gap: 12_000 });
  });
  it("spreads the lump sum to the customer's own life expectancy when given", () => {
    // 1,500,000 over (75 - 60) × 12 = 8,333 → 8,300
    expect(retireNeed({ ...OWNER, retireLump: 1_500_000, lifeExpectancy: 75 }).have).toBe(8_300);
    expect((cleanInput({ age: 35, income: 1, lifeExpectancy: 90 }) as PlanInput).lifeExpectancy).toBe(90);
    expect((cleanInput({ age: 35, income: 1, lifeExpectancy: 200 }) as PlanInput).lifeExpectancy).toBeUndefined();
  });
  it("spreads the lump sum from today when the customer is already past the retirement age", () => {
    // 1,500,000 over (85 - 68) × 12 = 7,353 → 7,400
    expect(retireNeed({ ...OWNER, age: 68, retireAge: 65, retireLump: 1_500_000 }).have).toBe(7_400);
  });
  it("has no gap when what is there covers it", () => {
    expect(retireNeed({ ...OWNER, retireMonthly: 10_000, pensionHave: 12_000 }).gap).toBe(0);
  });
  it("cleanInput defaults the four retirement answers", () => {
    const p = cleanInput({ age: 35, income: 50_000, expense: 25_000 }) as PlanInput;
    expect([p.retireAge, p.retireMonthly, p.pensionHave, p.retireLump]).toEqual([60, 17_500, 0, 0]);
    expect((cleanInput({ age: 35, income: 1, retireAge: 57 }) as PlanInput).retireAge).toBe(60);
    const q = cleanInput({ age: 35, income: 1, retireAge: "55", retireMonthly: 30_000 }) as PlanInput;
    expect([q.retireAge, q.retireMonthly]).toEqual([55, 30_000]);
  });
});

describe("budget and tax", () => {
  it("opens the budget at ten percent less what is already paid", () => {
    expect(defaultBudget(50_000, 12_000)).toBe(4_000);
    expect(defaultBudget(10_000, 50_000)).toBe(0);
  });
  it("finds the marginal rate", () => {
    expect(marginalRate(50_000)).toBe(0.1);
    expect(marginalRate(15_000)).toBe(0);
  });
  it("counts health to 25,000 inside 100,000, pension to 15% of income", () => {
    expect(taxSaved(OWNER, { life: 30_000, health: 30_000, pension: 20_000 })).toBe(7_500);
  });
});

describe("cleanInput", () => {
  it("refuses an age outside 20–70 and a missing income", () => {
    expect(typeof cleanInput({ ...OWNER, age: 19 })).toBe("string");
    expect(typeof cleanInput({ ...OWNER, income: 0 })).toBe("string");
  });
  it("keeps four children at most and defaults unknown choices", () => {
    const p = cleanInput({ ...OWNER, children: [1, 2, 3, 4, 5], hospital: "x", healthNow: "y" });
    if (typeof p === "string") throw new Error(p);
    expect(p.children).toEqual([1, 2, 3, 4]);
    expect(p.hospital).toBe("private");
    expect(p.healthNow).toBe("none");
  });
  it("turns junk money into zero", () => {
    const p = cleanInput({ ...OWNER, debts: "abc", savings: -5 });
    if (typeof p === "string") throw new Error(p);
    expect(p.debts).toBe(0);
    expect(p.savings).toBe(0);
  });
});
