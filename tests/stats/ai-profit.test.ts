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
      providerOf, owners: new Set(),
      ledger: [
        { model: "gemini-2.5-flash", task: "content", agentId: A, thb: 2 },
        { model: "claude-sonnet-4-5", task: "route", agentId: null, thb: 5 },
        { model: "cloudrun", task: "quote-video-render", agentId: A, thb: 1.6 },
        { model: "eleven_v3", task: "quote-video-voice", agentId: A, thb: 0.4 },
        // money held while a round ran: not spent, the real lines above are
        { model: "reservation", task: "content", agentId: A, thb: 9 },
      ],
      charges: [
        { round: "quote-video", satang: -500, costThb: 0.8 },
        { round: "quote-video", satang: -500, costThb: 1.2 },
        { round: "ai-draw", satang: -100, costThb: 0.5 },
      ],
      passes: [],
      moneyIn: [],
      unspentSatang: null,
    });
    expect(p.cost).toEqual({
      thb: 9, userThb: 4, systemThb: 5,
      providers: [
        { provider: "anthropic", thb: 5 }, { provider: "google", thb: 2 },
        { provider: "gcp", thb: 1.6 }, { provider: "elevenlabs", thb: 0.4 },
      ],
      split: { paidThb: 2.5, freeRoundsThb: 1.5, ownerThb: 0, askThb: 0, systemThb: 5 },
    });
    expect(p.revenue.thb).toBe(11);
    expect(p.revenue.items).toEqual([
      { key: "quote-video", name: "วิดีโอนำเสนอ", count: 2, thb: 10, costThb: 2 },
      { key: "ai-draw", name: "วาดภาพ", count: 1, thb: 1, costThb: 0.5 },
    ]);
    expect(p.profitThb).toBe(2);
    expect(p.userProfitThb).toBe(7);
  });

  it("counts a refunded pass off the passes sold", () => {
    const p = buildProfit({ providerOf, owners: new Set(), ledger: [], charges: [], passes: [{ satang: 9900 }, { satang: 9900 }, { satang: -9900 }], moneyIn: [], unspentSatang: null });
    expect(p.revenue.items).toEqual([{ key: PASS_KEY, name: "ค่าสมาชิกทั่วไป", count: 1, thb: 99, costThb: null }]);
    expect(p.profitThb).toBe(99);
  });

  it("shows a loss below zero, and nothing at all as nothing", () => {
    expect(buildProfit({ providerOf, owners: new Set(), ledger: [{ model: "gemini-2.5-flash", task: "route", agentId: null, thb: 3.333 }], charges: [], passes: [], moneyIn: [], unspentSatang: null }).profitThb).toBe(-3.33);
    const none = buildProfit({ providerOf, owners: new Set(), ledger: [], charges: [], passes: [], moneyIn: [], unspentSatang: null });
    expect([none.cost.thb, none.revenue.thb, none.profitThb, none.revenue.items.length]).toEqual([0, 0, 0, 0]);
  });

  it("sets the money customers transferred in against the same cost, refunds off", () => {
    const p = buildProfit({
      providerOf, owners: new Set(),
      ledger: [{ model: "gemini-2.5-flash", task: "content-image", agentId: A, thb: 30 }],
      charges: [{ round: "ai-draw", satang: -500, costThb: 3 }],
      passes: [{ satang: 9900 }],
      moneyIn: [{ kind: "topup", satang: 20000 }, { kind: "topup", satang: 10000 }, { kind: "clawback", satang: -5000 }],
      unspentSatang: 22750,
    });
    expect(p.moneyIn).toEqual({
      thb: 349, topups: { count: 2, thb: 300 }, passes: { count: 1, thb: 99 }, refunds: { count: 1, thb: -50 },
    });
    expect(p.cashThb).toBe(319);
    expect(p.unspentThb).toBe(227.5);
    // the usage line is unchanged by the top-ups: ฿5 + ฿99 against ฿30
    expect(p.profitThb).toBe(74);
  });

  it("tells paid work from the owner's use, ถาม AI and free rounds", () => {
    const OWNER = "cccccccc-0000-0000-0000-000000000003";
    const p = buildProfit({
      providerOf, owners: new Set([OWNER]),
      ledger: [
        { model: "gemini-2.5-flash", task: "content-image", agentId: A, thb: 4 }, // a paid picture
        { model: "gemini-2.5-flash", task: "content", agentId: A, thb: 6 }, // a free writing round
        { model: "gemini-2.5-flash", task: "content", agentId: OWNER, thb: 7 }, // the owner writes, free
        { model: "gemini-2.5-flash", task: "library", agentId: A, thb: 1 }, // ถาม AI
        { model: "gemini-2.5-flash", task: "route", agentId: A, thb: 0.5 }, // ถาม AI runs the bots' brain
        { model: "gemini-2.5-flash", task: "route", agentId: null, thb: 2 }, // a customer on Messenger
      ],
      charges: [{ round: "ai-draw", satang: -1000, costThb: 4 }],
      passes: [], moneyIn: [], unspentSatang: null,
    });
    expect(p.cost.split).toEqual({ paidThb: 4, freeRoundsThb: 6, ownerThb: 7, askThb: 1.5, systemThb: 2 });
    expect(p.cost.thb).toBe(20.5);
  });
});
