import { describe, expect, it } from "vitest";
import { moneyLeft, roundsNote } from "@/lib/wallet/note";

describe("the note under the make button", () => {
  it("counts the free rounds left while there are some", () => {
    expect(roundsNote({ used: 2, limit: 5, wallet: { satang: 5000, multiplier: 2 } }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · รอบฟรีเหลือ 3 จาก 5 ครั้ง", topUp: false });
  });

  it("says the round comes from the wallet, at the wallet's price, once the free rounds are used", () => {
    expect(roundsNote({ used: 5, limit: 5, wallet: { satang: 8420, multiplier: 2 } }, "1.20"))
      .toEqual({ text: "ราว ฿2.40 จากกระเป๋า · รอบฟรีหมดแล้ว · คงเหลือ ฿84.20", topUp: true });
  });

  it("prices the pictures at the price list, not the painter's cost times the multiplier (owner, 2026-10-18)", () => {
    // 2 pieces written for ฿0.60 × 2, and 2 Gemini pictures at ฿5 each
    expect(roundsNote({ used: 5, limit: 5, wallet: { satang: 8420, multiplier: 2 } }, "5.80", { writeThb: 0.6, picturesSatang: 1000 }).text)
      .toBe("ราว ฿11.20 จากกระเป๋า · รอบฟรีหมดแล้ว · คงเหลือ ฿84.20");
  });

  it("offers a top-up even at ฿0", () => {
    expect(roundsNote({ used: 5, limit: 5, wallet: { satang: 0, multiplier: 2 } }, 1).topUp).toBe(true);
  });

  it("is the old words when the owner has the wallet off", () => {
    expect(roundsNote({ used: 5, limit: 5, wallet: null }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · รอบฟรีเหลือ 0 จาก 5 ครั้ง", topUp: false });
    expect(roundsNote({ used: 5, limit: 5 }, "1.20").topUp).toBe(false);
  });
});

describe("the note for a member, whose pass carries credit, not free rounds (owner, 2026-10-17)", () => {
  it("says the round comes from the credit and the wallet, with the two together left", () => {
    expect(roundsNote({ used: 3, limit: 0, wallet: { satang: 5800, multiplier: 2 } }, "1.20"))
      .toEqual({ text: "ราว ฿2.40 · หักจากเครดิตและกระเป๋า · คงเหลือ ฿58.00", topUp: true });
  });
  it("never says free rounds ran out, even with the wallet off", () => {
    expect(roundsNote({ used: 0, limit: 0, wallet: null }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้", topUp: false });
  });
});

describe("the money the page reckons with", () => {
  const wallet = { satang: 5000, multiplier: 2 };

  it("is the owner's ceiling left for staff and for a round inside the free month", () => {
    expect(moneyLeft({ cap: 30, spent: 12.5, rounds: null })).toBe(17.5);
    expect(moneyLeft({ cap: 30, spent: 12.5, rounds: { used: 3, limit: 20, wallet } })).toBe(17.5);
    expect(moneyLeft({ cap: 30, spent: 45, rounds: { used: 3, limit: 20, wallet } })).toBe(0);
  });

  it("is unbounded for a round the agent pays from the wallet, whatever the ceiling says", () => {
    expect(moneyLeft({ cap: 30, spent: 30, rounds: { used: 20, limit: 20, wallet } })).toBe(Infinity);
    expect(moneyLeft({ cap: 30, spent: 45, rounds: { used: 25, limit: 20, wallet } })).toBe(Infinity);
  });

  it("stays the ceiling after the free month when the owner has the wallet off", () => {
    expect(moneyLeft({ cap: 30, spent: 30, rounds: { used: 20, limit: 20, wallet: null } })).toBe(0);
    expect(moneyLeft({ cap: 30, spent: 10, rounds: { used: 20, limit: 20 } })).toBe(20);
  });
});
