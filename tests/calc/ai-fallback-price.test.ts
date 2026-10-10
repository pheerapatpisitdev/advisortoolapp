import { describe, expect, it } from "vitest";
import { fallbackOrder } from "@/lib/ai/client";
import type { ModelRow } from "@/lib/ai/types";

/**
 * Which model answers when the preferred one will not.
 *
 * The fallback used to be "then try everything else", in whatever order the table returned
 * it and with no regard for what the task was. The ledger shows what that costs. Over seven
 * days, 17 calls out of 550 — 3.1% — were 44.9% of the bill, because a classifier that costs
 * 0.009 baht on the small tier had fallen through to models charging 0.078 and 0.819. Three
 * calls of `copilot` on the large-tier model cost more than all 306 routing calls together.
 *
 * It is not only money. There is a monthly budget and the assistant shuts itself off when it
 * is reached, so an afternoon of silent 16x fallback is an evening of "ตอนนี้ผู้ช่วยปิด
 * ชั่วคราวครับ" to everyone who writes in — which is what the advertising was paying for.
 *
 * So the rule is a price ceiling rather than a list: keep trying, but never at a price this
 * task was never meant to cost.
 */

const model = (name: string, inUsd: number, provider = "p"): ModelRow => ({
  id: name, provider, kind: "text", model_name: name, enabled: true,
  price: { inputPerMTokUsd: inUsd, outputPerMTokUsd: inUsd * 4 },
} as ModelRow);

/** cheap, mid, and the one that did the damage */
const CHEAP = model("gemini-3.1-flash-lite", 0.1);
const MID = model("claude-haiku-4-5-20251001", 1);
const DEAR = model("claude-sonnet-5", 3);
/** in the large tier's own list, and the model chosen on the admin page today */
const PICKED = model("gemini-3.7-flash", 0.75);

describe("the order models are tried in", () => {
  it("puts the preferred model first", () => {
    const order = fallbackOrder([DEAR, CHEAP, MID], "small", null);
    expect(order[0].model_name).toBe("gemini-3.1-flash-lite");
  });

  it("tries what is left cheapest first, not in whatever order the table gave", () => {
    const order = fallbackOrder([DEAR, MID, CHEAP], "small", null);
    const prices = order.map((m) => m.price.inputPerMTokUsd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  /**
   * The finding itself. A routing call is a sentence of classification; there is no version
   * of it worth thirty times the price, and the ledger shows it being paid.
   */
  it("will not fall back to a model far dearer than the tier's own", () => {
    const order = fallbackOrder([CHEAP, MID, DEAR], "small", null);
    expect(order.map((m) => m.model_name)).not.toContain("claude-sonnet-5");
  });

  it("still falls back — one bad provider must not take the assistant down", () => {
    // haiku is dearer than the flash model but within reach, and a customer waiting for an
    // answer is better served by a costlier one than by an apology
    expect(fallbackOrder([CHEAP, MID, DEAR], "small", null).length).toBeGreaterThan(1);
  });

  it("lets the large tier reach the models the large tier is for", () => {
    const order = fallbackOrder([CHEAP, MID, DEAR], "large", null);
    expect(order.map((m) => m.model_name)).toContain("claude-sonnet-5");
  });

  it("does not ask the owner's model twice when it is also one of the tier's own", () => {
    /**
     * The large tier is set to gemini-3.7-flash on the admin page, and gemini-3.7-flash is
     * in the large tier's list — so the chain asked it, then two others, then it again. The
     * repeat falls due the moment the first attempt fails, which is when that provider is
     * down, so the retry is a customer waiting twice for the same dead endpoint.
     */
    const names = fallbackOrder([CHEAP, MID, DEAR, PICKED], "large", "gemini-3.7-flash")
      .map((m) => m.model_name);
    expect(names).toContain("gemini-3.7-flash");
    expect(new Set(names).size).toBe(names.length);
  });

  it("honours the model the owner picked on the admin page, whatever it costs", () => {
    // an explicit choice is a decision, not an accident, and is not second-guessed here
    const order = fallbackOrder([CHEAP, MID, DEAR], "small", "claude-sonnet-5");
    expect(order[0].model_name).toBe("claude-sonnet-5");
  });

  it("never returns nothing when a model is available at all", () => {
    expect(fallbackOrder([DEAR], "small", null).length).toBe(1);
  });

  it("leaves out models that are switched off", () => {
    const off = { ...MID, enabled: false };
    const order = fallbackOrder([CHEAP, off], "small", null);
    expect(order.map((m) => m.model_name)).not.toContain(off.model_name);
  });

  it("keeps the price ceiling when a free model is in the tier's list", () => {
    /**
     * Typhoon is free (priced 0) and sits at the end of the small tier. The ceiling is a
     * multiple of the tier's cheapest model, and four times nothing is nothing — every model
     * outside the list would have dropped out of the fallback the day the free one came in.
     */
    const FREE = { ...model("typhoon-v2.5-30b-a3b-instruct", 0, "typhoon"), price: { inputPerMTokUsd: 0, outputPerMTokUsd: 0 } } as ModelRow;
    const OTHER = model("gemini-3.7-flash", 0.2);
    const names = fallbackOrder([CHEAP, FREE, OTHER, DEAR], "small", null).map((m) => m.model_name);
    expect(names).toContain("typhoon-v2.5-30b-a3b-instruct");
    expect(names).toContain("gemini-3.7-flash");
    expect(names).not.toContain("claude-sonnet-5");
  });
});
