import { describe, expect, it } from "vitest";
import { mayPlanOn, PLAN_LABEL, planState, planTitle } from "@/lib/content/day-plan";

const TODAY = "2026-09-30";

describe("a planned piece's state (owner, 2026-09-30)", () => {
  it("is done once the agent says so, whatever the day", () => {
    expect(planState("2026-09-01", "2026-09-01T09:00:00Z", TODAY)).toBe("done");
    expect(planState("2026-10-05", "2026-09-30T09:00:00Z", TODAY)).toBe("done");
  });

  it("is today's, still ahead, or overdue by the day", () => {
    expect(planState(TODAY, null, TODAY)).toBe("today");
    expect(planState("2026-10-01", null, TODAY)).toBe("planned");
    expect(planState("2026-09-29", null, TODAY)).toBe("overdue");
  });

  it("says each state in Thai", () => {
    expect(PLAN_LABEL).toEqual({ planned: "วางไว้", today: "วันนี้", overdue: "ค้าง", done: "โพสต์แล้ว" });
  });
});

describe("the days a piece may be planned on", () => {
  it("today and any day after", () => {
    expect(mayPlanOn(TODAY, TODAY)).toBe(true);
    expect(mayPlanOn("2027-01-15", TODAY)).toBe(true);
  });

  it("never a day gone, a day that does not exist, or something that is not a day", () => {
    for (const day of ["2026-09-29", "2026-02-30", "2026-13-01", "30/09/2026", "", "2026-9-30"]) expect(mayPlanOn(day, TODAY)).toBe(false);
  });
});

describe("a planned piece's title", () => {
  it("is its first opening line, cut short", () => {
    const item = { output: { hooks: ["หัวเรื่องที่ยาวมาก".repeat(10)] } } as never;
    expect(planTitle(item).length).toBeLessThanOrEqual(60);
    expect(planTitle({ output: { hooks: [] } } as never)).toBe("ชิ้นงาน");
  });
});
