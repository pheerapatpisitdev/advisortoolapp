import { describe, expect, it } from "vitest";
import { buildProfit, PASS_KEY } from "@/lib/stats/ai-profit";
import { providerMap } from "@/lib/ai/provider-of";

const providerOf = providerMap([
  { provider: "google", model_name: "gemini-2.5-flash" },
  { provider: "anthropic", model_name: "claude-sonnet-4-5" },
]);
const A = "aaaaaaaa-0000-0000-0000-000000000001";

describe("กำไรค่า AI", () => {
  it("sets what people paid against what the AI cost, and splits the bots out", () => {
    const p = buildProfit({
      providerOf,
      ledger: [
        { model: "gemini-2.5-flash", agentId: A, thb: 2 },
        { model: "claude-sonnet-4-5", agentId: null, thb: 5 },
        { model: "cloudrun", agentId: A, thb: 1.6 },
        { model: "eleven_v3", agentId: A, thb: 0.4 },
        // money held while a round ran: not spent, the real lines above are
        { model: "reservation", agentId: A, thb: 9 },
      ],
      charges: [
        { round: "quote-video", satang: -500 },
        { round: "quote-video", satang: -500 },
        { round: "ai-draw", satang: -100 },
      ],
      passes: [],
    });
    expect(p.cost).toEqual({
      thb: 9, userThb: 4, systemThb: 5,
      providers: [
        { provider: "anthropic", thb: 5 }, { provider: "google", thb: 2 },
        { provider: "gcp", thb: 1.6 }, { provider: "elevenlabs", thb: 0.4 },
      ],
    });
    expect(p.revenue.thb).toBe(11);
    expect(p.revenue.items).toEqual([
      { key: "quote-video", name: "วิดีโอนำเสนอ", count: 2, thb: 10 },
      { key: "ai-draw", name: "วาดภาพ", count: 1, thb: 1 },
    ]);
    expect(p.profitThb).toBe(2);
    expect(p.userProfitThb).toBe(7);
  });

  it("counts a refunded pass off the passes sold", () => {
    const p = buildProfit({ providerOf, ledger: [], charges: [], passes: [{ satang: 9900 }, { satang: 9900 }, { satang: -9900 }] });
    expect(p.revenue.items).toEqual([{ key: PASS_KEY, name: "ค่าสมาชิกทั่วไป", count: 1, thb: 99 }]);
    expect(p.profitThb).toBe(99);
  });

  it("shows a loss below zero, and nothing at all as nothing", () => {
    expect(buildProfit({ providerOf, ledger: [{ model: "gemini-2.5-flash", agentId: null, thb: 3.333 }], charges: [], passes: [] }).profitThb).toBe(-3.33);
    const none = buildProfit({ providerOf, ledger: [], charges: [], passes: [] });
    expect([none.cost.thb, none.revenue.thb, none.profitThb, none.revenue.items.length]).toEqual([0, 0, 0, 0]);
  });
});
