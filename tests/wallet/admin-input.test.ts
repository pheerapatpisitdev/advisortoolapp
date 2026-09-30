import { describe, expect, it } from "vitest";
import { readAdjust, readMultiplier } from "@/lib/wallet/admin-input";

describe("the multiplier the owner types", () => {
  it("is a number from 1 to 10", () => {
    expect(readMultiplier("2")).toEqual({ ok: true, value: 2 });
    expect(readMultiplier(" 1.5 ")).toEqual({ ok: true, value: 1.5 });
    for (const s of ["0.9", "11", "", "abc", "NaN", "-2"]) expect(readMultiplier(s)).toMatchObject({ ok: false });
  });
});

describe("an adjustment the owner types", () => {
  it("is baht, plus or minus, with a reason, made into satang", () => {
    expect(readAdjust("20", "ของขวัญ")).toEqual({ ok: true, satang: 2000, note: "ของขวัญ" });
    expect(readAdjust("-12.5", " คืนเงินใน Stripe ")).toEqual({ ok: true, satang: -1250, note: "คืนเงินใน Stripe" });
  });

  it("refuses nothing, too much, a third decimal place, or no reason", () => {
    expect(readAdjust("0", "x")).toMatchObject({ ok: false });
    expect(readAdjust("10001", "x")).toMatchObject({ ok: false });
    expect(readAdjust("1.005", "x")).toMatchObject({ ok: false });
    expect(readAdjust("abc", "x")).toMatchObject({ ok: false });
    expect(readAdjust("10", "   ")).toMatchObject({ ok: false });
  });
});
