import { describe, expect, it } from "vitest";
import { healthFigures } from "@/lib/scene-library/health-figures";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { plansFor } from "@/lib/ihealthy-quote";

describe("healthFigures", () => {
  const table = iHealthyTable();
  const facts = iHealthyFacts();

  it("reads SILVER's figures off the sheet and the rate table", () => {
    const f = healthFigures({ plan: "SILVER", sex: "M", age: 35 });
    if (typeof f === "string") throw new Error(f);
    expect(f.plan).toBe("SILVER");
    expect(f.planName).toBe("Silver");
    expect(f.roomPerDay).toBe(5500);
    expect(f.annualMax).toBe(table.plans.find((p) => p.code === "SILVER")!.annualMax);
    expect(f.waitingDays).toBe(facts.terms.waitingDays);
    expect(f.specialWaitingDays).toBe(facts.terms.specialWaitingDays);
    expect(f.copayPercent).toBe(facts.copayPercent);
  });

  it("lists premiums at 30/40/50/60, ascending, only where the plan is offered", () => {
    const f = healthFigures({ plan: "SILVER", sex: "F", age: 35 });
    if (typeof f === "string") throw new Error(f);
    expect(f.ages.length).toBeGreaterThan(0);
    for (let i = 1; i < f.ages.length; i++) {
      expect(f.ages[i].age).toBeGreaterThan(f.ages[i - 1].age);
      expect(f.ages[i].annual).toBeGreaterThan(f.ages[i - 1].annual);
    }
    for (const a of f.ages) {
      expect([30, 40, 50, 60]).toContain(a.age);
      expect(plansFor(table, a.age).some((p) => p.code === "SILVER")).toBe(true);
    }
  });

  it("returns the error string for an unknown plan or one not offered at the age", () => {
    expect(healthFigures({ plan: "NOPE", sex: "M", age: 35 })).toBe("เลือกแผน");
    expect(healthFigures({ plan: "SILVER", sex: "M", age: table.ageMax + 1 })).toBe("เลือกแผน");
  });
});
