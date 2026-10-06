import { describe, expect, it } from "vitest";
import { quoteCard, valueTableCard, type PlanCardInput } from "@/lib/quote-card";

/** The rate tables behind these figures are current on this date. */
const WHILE_CURRENT = new Date("2026-09-05");

/**
 * The two pictures of one arrangement must say one premium.
 *
 * They did not. The quotation card dropped the satang and the value table rounded them, so
 * an iShield premium of 54,996.80 went into the same inbox as "54,996 บาท" on one card and
 * "54,997 บาทต่อปี" on the other — two figures for one price, in two pictures the customer
 * keeps and shows to somebody else. The bot now sends both together, which is what made it
 * visible; it was true before that and nobody was looking.
 */
const CASES: PlanCardInput[] = [
  { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 40, sex: "M", sumAssured: 740_000, mode: "annual" },
  { kind: "plan", planCode: "ISHIELD", variant: "WLCI15", age: 55, sex: "F", sumAssured: 300_000, mode: "annual" },
  { kind: "plan", planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 500_000, mode: "annual" },
  { kind: "plan", planCode: "LIFETREASURE", variant: "WL85L", age: 40, sex: "F", sumAssured: 1_000_000, mode: "annual" },
];

describe("a quotation card and the value table beside it", () => {
  for (const input of CASES) {
    it(`say the same yearly premium — ${input.planCode} ${input.variant} ${input.sex}${input.age}`, () => {
      const quote = quoteCard(input, WHILE_CURRENT);
      const table = valueTableCard(input, WHILE_CURRENT);
      if (!quote || !table) return; // a plan that draws no table cannot disagree with one
      const yearly = quote.summary?.rows.find((r) => r.label === "รายปี");
      if (!yearly) return;
      const figure = yearly.amount;
      expect(table.premiumLine).toContain(figure);
    });
  }
});
