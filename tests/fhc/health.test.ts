import { describe, expect, it } from "vitest";
import { cleanFhc, events, figures, scores, toPlanInput, type FhcInput } from "@/lib/fhc/health";
import type { PlanResult } from "@/lib/plan/recommend";

const F: FhcInput = {
  age: 35, sex: "M", income: 40_000, expense: 25_000, lifeCover: 0, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 0, hospital: "private", lifeWant: "cover", retireAge: 60, retireMonthly: 17_500,
  pensionHave: 0, budget: 4_000, expectancy: 85, work: "full",
  cash: 100_000, fixed: 50_000, otherSaving: 10_000, homeLoan: 1_000_000, carLoan: 200_000, otherDebt: 0,
  taxFund: 300_000, stocks: 40_000,
  people: [{ relation: "child", age: 5 }, { relation: "parent", age: 65 }],
};

const level = (f: FhcInput, key: string) => scores(f).find((s) => s.key === key)!;

describe("figures", () => {
  it("works the timeline and the totals", () => {
    const g = figures(F);
    expect([g.workYears, g.moneyYears, g.incomeYear, g.lifetimeIncome]).toEqual([25, 25, 480_000, 12_000_000]);
    expect([g.netMonth, g.savings, g.debts, g.invest]).toEqual([15_000, 160_000, 1_200_000, 340_000]);
    expect(g.netWorth).toBe(160_000 + 340_000 - 1_200_000);
    expect(g.emergencyTarget).toBe(150_000);
  });
  it("counts the years the money must last from today once past the retirement age", () => {
    expect(figures({ ...F, age: 68, retireAge: 65 }).moneyYears).toBe(17);
  });
  it("has no working years left when the customer cannot work", () => {
    expect(figures({ ...F, work: "none" }).lifetimeIncome).toBe(0);
  });
  it("counts half the earning power when the customer can work only partly", () => {
    const g = figures({ ...F, work: "partial" });
    expect([g.workYears, g.lifetimeIncome]).toEqual([25, 6_000_000]);
  });
});

describe("toPlanInput", () => {
  it("maps dependants and counts each baht once", () => {
    const p = toPlanInput(F);
    expect(p.children).toEqual([5]);
    expect(p.otherDependants).toBe(true);
    expect(p.savings).toBe(100_000 + 50_000 + 10_000 + 40_000); // stocks, not the tax funds
    expect(p.retireLump).toBe(300_000); // tax funds only here
    expect(p.debts).toBe(1_200_000);
    expect(p.lifeExpectancy).toBe(85);
  });
  it("has no other dependants when every row is a child", () => {
    expect(toPlanInput({ ...F, people: [{ relation: "child", age: 3 }] }).otherDependants).toBe(false);
  });
});

describe("cleanFhc", () => {
  it("keeps the plan's own sentences for age and income", () => {
    expect(cleanFhc({ age: 10, income: 1 })).toContain("อายุ");
    expect(cleanFhc({ age: 35 })).toContain("เงินเดือน");
    expect(cleanFhc({ age: 35, income: 40_000 })).toContain("ค่าใช้จ่าย");
  });
  it("cleans the FHC fields", () => {
    const f = cleanFhc({
      age: 35, income: 40_000, expense: 20_000, expectancy: 300, work: "bogus", cash: -5, stocks: "1200",
      people: [{ relation: "child", age: 4 }, { relation: "cousin", age: 9 }, { relation: "parent", age: 500 }],
    }) as FhcInput;
    expect([f.expectancy, f.work, f.cash, f.stocks]).toEqual([85, "full", 0, 1_200]);
    expect(f.people).toEqual([{ relation: "child", age: 4 }]);
  });
});

describe("scores", () => {
  it("rates the emergency fund in months of spending", () => {
    expect(level({ ...F, cash: 150_000, fixed: 0 }, "emergency").level).toBe("green"); // 6.0
    expect(level({ ...F, cash: 147_500, fixed: 0 }, "emergency").level).toBe("yellow"); // 5.9
    expect(level({ ...F, cash: 70_000, fixed: 0 }, "emergency").level).toBe("red"); // 2.8
    expect(level({ ...F, expense: 0 }, "emergency")).toMatchObject({ level: "none", shown: "—" });
  });
  it("rates what is left each month against income", () => {
    expect(level({ ...F, expense: 32_000 }, "saving").level).toBe("green"); // 20%
    expect(level({ ...F, expense: 36_000 }, "saving").level).toBe("yellow"); // 10%
    expect(level({ ...F, expense: 38_000 }, "saving").level).toBe("red");
    expect(level({ ...F, expense: 43_500 }, "saving")).toMatchObject({ level: "red", shown: "ใช้เกินรายได้ 3,500 บาท/เดือน" });
  });
  it("rates debt other than the home against a year of income, lower being better", () => {
    expect(level({ ...F, homeLoan: 0, carLoan: 0 }, "debt")).toMatchObject({ level: "green", shown: "ไม่มีหนี้" });
    expect(level({ ...F, carLoan: 480_000 }, "debt").level).toBe("yellow"); // exactly 1
    expect(level({ ...F, carLoan: 1_000_000, otherDebt: 440_000 }, "debt").level).toBe("yellow"); // exactly 3
    expect(level({ ...F, carLoan: 1_500_000 }, "debt").level).toBe("red");
  });
  it("leaves the home loan out of the debt score: a mortgage is ordinary", () => {
    // 5 years of income in the home, nothing else owed
    expect(level({ ...F, homeLoan: 2_400_000, carLoan: 0 }, "debt")).toMatchObject({ level: "green", shown: "มีแต่หนี้บ้าน" });
    expect(level({ ...F, homeLoan: 2_400_000, carLoan: 240_000 }, "debt"))
      .toMatchObject({ level: "green", shown: "0.5 เท่าของรายได้ต่อปี" });
    expect(level(F, "debt").label).toBe("ภาระหนี้ (ไม่รวมบ้าน)");
  });
  it("rates hospital and critical-illness cover together", () => {
    expect(level(F, "healthCi").level).toBe("red");
    expect(level({ ...F, ciCover: 5_000_000 }, "healthCi")).toMatchObject({ level: "yellow", shown: "ยังขาดค่ารักษา" });
    expect(level({ ...F, ciCover: 5_000_000, healthNow: "private", healthRoom: 6_000 }, "healthCi").level).toBe("green");
  });
  it("rates life cover and retirement against what they should be", () => {
    expect(level({ ...F, lifeCover: 50_000_000 }, "life").level).toBe("green");
    expect(level(F, "life").level).toBe("red");
    expect(level({ ...F, pensionHave: 17_500 }, "retire").level).toBe("green");
    expect(level({ ...F, pensionHave: 9_000, taxFund: 0 }, "retire").level).toBe("yellow");
  });
});

describe("events", () => {
  const plan = {
    budget: 4_000, usedAnnual: 0, taxSaved: 0, order: ["life", "health", "ci", "retire"], orderedBy: "fixed", summary: "",
    areas: [
      { key: "life", unit: "sum", have: 0, should: 1, status: "fits",
        offer: { product: "Protection Life (PLB) ชำระ 15 ปี", href: "/plb", sum: 1, cover: 1, annual: 1_200_000, firstYear: false } },
      { key: "health", unit: "room", have: 0, should: 1, status: "short",
        offer: { product: "iHealthy Ultra แผนสมาร์ท", href: "/x", sum: 1, cover: 1, annual: 3_000_000, firstYear: true } },
      { key: "ci", unit: "sum", have: 0, should: 1, status: "covered" },
      { key: "retire", unit: "pension", have: 0, should: 1, status: "unavailable" },
    ],
  } as PlanResult;

  it("ties each event to its answer", () => {
    const ev = events(F, scores(F), plan);
    expect(ev.map((e) => e.key)).toEqual(["illness", "accident", "disability", "death", "jobLoss"]);
    expect(ev[0].lines).toEqual(["iHealthy Ultra แผนสมาร์ท (งบไม่พอ)", "มีพอแล้ว"]);
    expect(ev[3].lines).toEqual(["Protection Life (PLB) ชำระ 15 ปี · เดือนละ 1,000 บาท"]);
    expect(ev[1].level).toBe("none");
    expect(ev[4].lines[0]).toContain("150,000");
  });
});
