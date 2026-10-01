import { describe, expect, it } from "vitest";
import {
  cardAllowed, chargeSatang, drawHoldThb, formatBaht, holdSatang, holdSatangFor, IMAGE_FALLBACK_THB, isTopUpThb, perPostUnder, postsFor,
  ROUND_HOLD_THB, TOPUP_THB, toSatang,
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

describe("what a top-up buys, counted in posts (owner, 2026-10-01)", () => {
  it("is about 40 posts for ฿50 at the ×2 multiplier, and so on up the buttons", () => {
    expect(TOPUP_THB.map((thb) => postsFor(thb, 2))).toEqual([40, 80, 120, 160, 400]);
  });

  it("follows the owner's multiplier, rounded down to a number that reads as an estimate", () => {
    expect(postsFor(50, 1.5)).toBe(50);
    expect(postsFor(50, 3)).toBe(25);
    expect(postsFor(500, 1)).toBe(800);
  });

  it("never promises a post a small top-up cannot pay for", () => {
    expect(postsFor(5, 2)).toBe(4);
    expect(postsFor(1, 2)).toBe(0);
  });

  it("says a post costs under the next half baht above its average price", () => {
    expect(perPostUnder(2)).toBe(1.5);
    expect(perPostUnder(1.5)).toBe(1);
    expect(perPostUnder(2.4)).toBe(2);
  });
});

describe("what a picture holds (review, 2026-10-01)", () => {
  it("is the dearest model the round can reach: the lite fallback behind a cheaper pick", () => {
    // มาตรฐาน ฿0.43 falls back to Gemini's lite model at ฿1.23 when OpenAI is down
    expect(drawHoldThb({ painter: "standard", withPerson: false, request: "" })).toBe(1.26);
    expect(drawHoldThb({ painter: "auto", withPerson: false, request: "" })).toBe(1.26);
    expect(drawHoldThb({ painter: "sharp", withPerson: false, request: "" })).toBe(1.26);
    expect(IMAGE_FALLBACK_THB).toBeGreaterThan(0.86);
  });

  it("is Gemini's with a person, whatever was picked", () => {
    expect(drawHoldThb({ painter: "standard", withPerson: true, request: "" })).toBe(2.44);
    expect(drawHoldThb({ painter: "gemini", withPerson: false, request: "" })).toBe(2.44);
  });

  it("counts the translation and the read-back of a typed direction", () => {
    expect(drawHoldThb({ painter: "standard", withPerson: false, request: "  ภาพทะเล " })).toBe(1.29);
    expect(drawHoldThb({ painter: "standard", withPerson: false, request: "   " })).toBe(1.26);
  });

  it("is 0 when nothing will be drawn, leaving the round's default hold", () => {
    expect(drawHoldThb({ painter: "none", withPerson: true, request: "" })).toBe(0);
  });

  it("is never the flat default's ฿3: five pictures at once hold no more than reachable (owner, 2026-09-30)", () => {
    for (const painter of ["standard", "sharp", "gemini", "auto"]) {
      for (const withPerson of [false, true]) {
        expect(drawHoldThb({ painter, withPerson, request: "x" })).toBeLessThan(ROUND_HOLD_THB["ai-draw"]);
      }
    }
  });
});
