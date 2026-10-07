import { describe, expect, it } from "vitest";
import { planNamedIn, priceNamedPlan, pricePlan, readPlanAsk } from "@/lib/copilot/price";

/**
 * The one-message pricer was split in two so a brain can keep what a customer has said across
 * turns and price it later. The split must change nothing for the plans that still use it.
 */
describe("the pricer split into a reader and a pricer", () => {
  const messages = [
    "PLB ชาย 35 ทุน 1 ล้าน ชำระ 10 ปี",
    "PLB ชาย 35",
    "Protection Life",
    "iSmart 80/6 ชาย 40 ทุน 1 ล้าน จ่าย 6 ปี",
    "Life Treasure หญิง 40 ทุน 10 ล้าน จ่าย 12 ปี",
    "อีซี่ โพรเทค ชาย 30 ทุน 1 ล้าน",
  ];

  for (const text of messages) {
    it(`prices "${text}" the same either way`, () => {
      const plan = planNamedIn(text)!;
      expect(plan, text).toBeDefined();
      expect(priceNamedPlan(text, plan.code, plan.label)).toEqual(
        pricePlan(plan.code, plan.label, readPlanAsk(text, plan.code)),
      );
    });
  }

  it("reads 'ชาย 15 ปี' as a fifteen-year-old, not the fifteen-year term", () => {
    const ask = readPlanAsk("PLB ชาย 15 ปี ทุน 1 ล้าน", "PLB");
    expect(ask.people[0].age).toBe(15);
    expect(ask.variant).toBeUndefined();
    expect(ask.sum).toBe(1_000_000);
  });
});
