import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
const { chargesOf } = await import("@/lib/stats/ai-profit-read");

/** กำไรค่า AI and a member's pass credit (owner, 2026-10-17): the credit's share is not paid work. */
describe("the wallets' charges as paid work", () => {
  it("keeps a charge paid from own money whole", () => {
    expect(chargesOf([{ kind: "charge", round: "ai-write", amount_satang: -260, credit_satang: 0, cost_thb: 1.3 }]))
      .toEqual([{ round: "ai-write", satang: -260, costThb: 1.3 }]);
  });
  it("leaves out a round the credit paid in full: its cost falls under free rounds", () => {
    expect(chargesOf([{ kind: "charge", round: "quote-video", amount_satang: 0, credit_satang: 500, cost_thb: 2 }])).toEqual([]);
  });
  it("counts only the own money's share of a round the two paid together", () => {
    expect(chargesOf([{ kind: "charge", round: "ai-draw", amount_satang: -100, credit_satang: 300, cost_thb: 2 }]))
      .toEqual([{ round: "ai-draw", satang: -100, costThb: 0.5 }]);
  });
  it("keeps a free writer's ฿0 charge with its cost, and reads entries from before the credit column", () => {
    expect(chargesOf([{ kind: "charge", round: "ai-write", amount_satang: 0, cost_thb: 0 }, { kind: "topup", amount_satang: 5000 }]))
      .toEqual([{ round: "ai-write", satang: 0, costThb: 0 }]);
  });
});
