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

  it("offers a top-up even at ฿0", () => {
    expect(roundsNote({ used: 5, limit: 5, wallet: { satang: 0, multiplier: 2 } }, 1).topUp).toBe(true);
  });

  it("is the old words when the owner has the wallet off", () => {
    expect(roundsNote({ used: 5, limit: 5, wallet: null }, "1.20"))
      .toEqual({ text: "ราว ฿1.20 · รอบฟรีเหลือ 0 จาก 5 ครั้ง", topUp: false });
    expect(roundsNote({ used: 5, limit: 5 }, "1.20").topUp).toBe(false);
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
