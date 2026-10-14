import { describe, expect, it } from "vitest";
import { readAdjust, readMultiplier, readPassSettings, readReferralSettings } from "@/lib/wallet/admin-input";

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

describe("the member pass the owner types (owner, 2026-10-13)", () => {
  const typed = { enabled: true, baht: "99", trialDays: "3", rounds: "10" };

  it("is a price in baht made into satang, trial days and free rounds", () => {
    expect(readPassSettings(typed)).toEqual({ ok: true, value: { enabled: true, satang: 9900, trialDays: 3, rounds: 10 } });
    expect(readPassSettings({ enabled: false, baht: " 149.50 ", trialDays: "0", rounds: "0" }))
      .toEqual({ ok: true, value: { enabled: false, satang: 14950, trialDays: 0, rounds: 0 } });
    expect(readPassSettings({ ...typed, baht: "1000", trialDays: "30", rounds: "100" })).toMatchObject({ ok: true });
    // ฿10 is Stripe's smallest THB charge (review, 2026-10-13)
    expect(readPassSettings({ ...typed, baht: "10" })).toMatchObject({ ok: true, value: { satang: 1000 } });
  });

  it("refuses a price under ฿10, over ฿1,000, or with a third decimal place", () => {
    for (const baht of ["0", "9", "9.99", "1001", "9.999", "", "abc", "-5", "0.99"]) {
      expect(readPassSettings({ ...typed, baht })).toMatchObject({ ok: false });
    }
  });

  it("refuses trial days past 30 and rounds below zero or past 100, whole numbers only", () => {
    for (const trialDays of ["31", "-1", "1.5", ""]) expect(readPassSettings({ ...typed, trialDays })).toMatchObject({ ok: false });
    for (const rounds of ["-1", "101", "2.5", ""]) expect(readPassSettings({ ...typed, rounds })).toMatchObject({ ok: false });
  });
});

describe("เพื่อนชวนเพื่อน as the owner types it", () => {
  const ok = { enabled: true, days: "3", daysCap: "30", baht: "10", bahtCap: "100" };
  it("reads days and whole baht, made into satang", () => {
    expect(readReferralSettings(ok)).toEqual({ ok: true, value: { enabled: true, days: 3, daysCap: 30, satang: 1000, satangCap: 10000 } });
    expect(readReferralSettings({ ...ok, enabled: "yes" as unknown as boolean })).toMatchObject({ ok: true, value: { enabled: false } });
  });

  it("refuses what is out of range or not a whole number", () => {
    for (const over of [{ days: "31" }, { days: "-1" }, { days: "2.5" }, { daysCap: "366" }, { baht: "101" }, { baht: "9.50" }, { bahtCap: "5001" }, { bahtCap: "" }]) {
      expect(readReferralSettings({ ...ok, ...over })).toMatchObject({ ok: false });
    }
  });
});
