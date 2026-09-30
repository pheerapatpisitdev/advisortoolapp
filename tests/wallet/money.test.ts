import { describe, expect, it } from "vitest";
import {
  cardAllowed, chargeSatang, formatBaht, holdSatang, holdSatangFor, isTopUpThb, ROUND_HOLD_THB, TOPUP_THB, toSatang,
} from "@/lib/wallet/money";
import { AI_ROUNDS } from "@/lib/auth/quota";

describe("top-up amounts", () => {
  it("are the five the owner chose, and nothing else", () => {
    expect(TOPUP_THB).toEqual([50, 100, 150, 200, 500]);
    for (const v of [50, 100, 150, 200, 500]) expect(isTopUpThb(v)).toBe(true);
    for (const v of [0, 1, 49.5, 51, 1000, "500", null, undefined, NaN]) expect(isTopUpThb(v)).toBe(false);
  });

  it("take a card only from ฿150: a card's fixed fee eats a small top-up", () => {
    expect(cardAllowed(50)).toBe(false);
    expect(cardAllowed(100)).toBe(false);
    expect(cardAllowed(150)).toBe(true);
    expect(cardAllowed(500)).toBe(true);
  });
});

describe("satang", () => {
  it("turns baht into whole satang", () => {
    expect(toSatang(100)).toBe(10000);
    expect(toSatang(0.1 + 0.2)).toBe(30);
  });

  it("shows satang as baht with two places", () => {
    expect(formatBaht(8420)).toBe("฿84.20");
    expect(formatBaht(0)).toBe("฿0.00");
    expect(formatBaht(123456)).toBe("฿1,234.56");
  });
});

describe("what a round holds", () => {
  it("has a hold for every kind of round", () => {
    for (const r of AI_ROUNDS) expect(ROUND_HOLD_THB[r]).toBeGreaterThan(0);
  });

  it("is the round's hold times the multiplier, rounded up to a satang", () => {
    expect(holdSatang("ai-write", 2)).toBe(Math.ceil(ROUND_HOLD_THB["ai-write"] * 2 * 100));
    expect(holdSatang("ai-draw", 1.5)).toBe(Math.ceil(ROUND_HOLD_THB["ai-draw"] * 1.5 * 100));
  });

  it("can be sized from a price in baht instead of the round's default, rounded up to a satang", () => {
    // a standard picture, ฿0.43 with its ฿0.03 overhead, at the default multiplier
    expect(holdSatangFor(0.46, 2)).toBe(92);
    // floating-point dust is not a satang of its own
    expect(holdSatangFor(0.1 + 0.2, 1)).toBe(30);
    expect(holdSatangFor(0.001, 2)).toBe(1);
    expect(holdSatang("ai-write", 2)).toBe(holdSatangFor(ROUND_HOLD_THB["ai-write"], 2));
  });
});

describe("what a round is charged", () => {
  it("is the real cost times the multiplier, rounded up to a satang", () => {
    expect(chargeSatang(2.4, 2, 1000)).toBe(480);
    // 0.0001 baht of a call still costs a satang
    expect(chargeSatang(0.0001, 2, 1000)).toBe(1);
  });

  it("does not round a float's dust up into an extra satang", () => {
    // 1.2 * 2 * 100 is 240.00000000000003 in floating point
    expect(chargeSatang(1.2, 2, 1000)).toBe(240);
  });

  it("is never more than was held", () => {
    expect(chargeSatang(50, 2, 1000)).toBe(1000);
  });

  it("is nothing when nothing was spent, or the figure is not a number", () => {
    expect(chargeSatang(0, 2, 1000)).toBe(0);
    expect(chargeSatang(NaN, 2, 1000)).toBe(0);
    expect(chargeSatang(-1, 2, 1000)).toBe(0);
  });
});
