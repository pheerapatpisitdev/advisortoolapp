import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetOutcome } from "@/components/sales/BudgetBox";

const say = (total: number) =>
  renderToStaticMarkup(createElement(BudgetOutcome, {
    budget: { baht: 100_000, per: "year" },
    fit: { sum: 1_542_972, total, over: false },
    least: undefined,
    minMonthly: 1_000,
  }));

describe("what the line under the sum says about the money left", () => {
  it("a satang over the budget reads as the budget itself", () => {
    expect(say(10_000_001)).toContain("พอดีงบ");
    expect(say(10_000_001)).not.toContain("เกินงบ");
  });
  it("a satang under reads the same", () => {
    expect(say(9_999_950)).toContain("พอดีงบ");
    expect(say(9_999_950)).not.toContain("เหลืองบ");
  });
  it("a baht or more either side is still said", () => {
    expect(say(10_000_100)).toContain("เกินงบ 1 บาท");
    expect(say(9_990_000)).toContain("เหลืองบ 100 บาท");
  });
});
