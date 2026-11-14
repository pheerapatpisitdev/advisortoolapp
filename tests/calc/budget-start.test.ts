import { describe, expect, it } from "vitest";
import { startBudget } from "@/components/sales/BudgetBox";

// ตั้งค่าส่วนตัว: an agent who hides the monthly premium is offered a yearly budget only
describe("startBudget", () => {
  it("leaves the start as it is while monthly is shown", () => {
    expect(startBudget({ baht: 5_000, per: "month" }, true)).toEqual({ baht: 5_000, per: "month" });
  });

  it("turns a monthly start into the year it adds up to when monthly is hidden", () => {
    expect(startBudget({ baht: 5_000, per: "month" }, false)).toEqual({ baht: 60_000, per: "year" });
  });

  it("never starts under the yearly field's smallest figure", () => {
    expect(startBudget({ baht: 500, per: "month" }, false)).toEqual({ baht: 10_000, per: "year" });
  });

  it("leaves a yearly start alone either way", () => {
    expect(startBudget({ baht: 100_000, per: "year" }, false)).toEqual({ baht: 100_000, per: "year" });
  });
});
