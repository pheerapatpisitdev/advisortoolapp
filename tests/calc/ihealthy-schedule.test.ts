import { describe, expect, it } from "vitest";
import { iHealthySchedule } from "@/lib/ihealthy-schedule";

const WHILE_CURRENT = new Date("2026-09-12");
/** the owner's mockup: a woman of 35, x 2 paid over 9 years, โกลด์ in Thailand, daily cash 1,000 */
const ASK = {
  base: "WLF09H", sex: "F" as const, age: 35, plan: "GOLD",
  territory: "ประเทศไทย", coverage: "Full Coverage", dailyCash: 1000,
};

describe("iHealthySchedule", () => {
  it("runs every year to 98 with the health premium at each age", () => {
    const s = iHealthySchedule(ASK, WHILE_CURRENT)!;
    expect(s.factors).toHaveLength(64);
    const baht = (i: number) => s.healthDue[i] / 100;
    // iHealthy 43,800 + daily cash 1,300 at 35; 104,300 + 2,000 at 60
    expect(baht(0)).toBe(45_100);
    expect(baht(25)).toBe(106_300);
    // the daily cash renews to 74 and stops; iHealthy alone after
    expect(baht(39)).toBe(205_000 + 6_420);
    expect(baht(40)).toBe(216_400);
    expect(baht(63)).toBe(550_900);
    // the WLF09H surrender table, per thousand: nothing for two years, then 24 at 150,000 → 3,600
    expect(s.factors.slice(0, 4)).toEqual([0, 0, 24, 67]);
  });

  it("leaves the daily cash out where the agent took it off", () => {
    const s = iHealthySchedule({ ...ASK, dailyCash: null }, WHILE_CURRENT)!;
    expect(s.healthDue[0] / 100).toBe(43_800);
  });

  it("answers nothing for a base the page does not sell or a lapsed rate table", () => {
    expect(iHealthySchedule({ ...ASK, base: "WLF09L" }, WHILE_CURRENT)).toBeUndefined();
    expect(iHealthySchedule(ASK, new Date("2027-04-01"))).toBeUndefined();
  });
});
