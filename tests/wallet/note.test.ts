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

describe("the note once the month's เพดานงบใช้ฟรี is reached", () => {
  const paused = { until: "1 พ.ย." };

  it("says the free rounds wait for the 1st and the wallet pays, though some are left", () => {
    expect(roundsNote({ used: 2, limit: 10, wallet: { satang: 8420, multiplier: 2 }, paused }, "1.20"))
      .toEqual({ text: "ราว ฿2.40 จากกระเป๋า · รอบฟรีของเดือนนี้หมดแล้ว ได้ใหม่วันที่ 1 พ.ย. · คงเหลือ ฿84.20", topUp: true });
  });

  it("says when they come back if the wallet is off", () => {
    expect(roundsNote({ used: 2, limit: 10, wallet: null, paused }, "1.20"))
      .toEqual({ text: "รอบฟรีของเดือนนี้หมดแล้ว · ได้รอบฟรีใหม่วันที่ 1 พ.ย.", topUp: false });
  });

  it("is the usual words once the free rounds are used anyway", () => {
    expect(roundsNote({ used: 10, limit: 10, wallet: { satang: 8420, multiplier: 2 }, paused }, "1.20").text)
      .toBe("ราว ฿2.40 จากกระเป๋า · รอบฟรีหมดแล้ว · คงเหลือ ฿84.20");
  });
});

describe("the money the page reckons with", () => {
  it("is unbounded now the content ceiling is retired", () => {
    expect(moneyLeft({ cap: null, spent: 45 })).toBe(Infinity);
  });

  it("is a ceiling's money left when there is one", () => {
    expect(moneyLeft({ cap: 30, spent: 12.5 })).toBe(17.5);
    expect(moneyLeft({ cap: 30, spent: 45 })).toBe(0);
  });
});
