import { describe, expect, it } from "vitest";
import {
  balancesAfter, byDay, dayLabel, firstPaid, matches, paidPerDay, parseKind, parseRange, rangeBounds, summarize, type MoneyRow,
} from "@/lib/wallet/money-in";

// 2026-10-19 10:00 in Bangkok
const NOW = new Date("2026-10-19T03:00:00Z");

const row = (id: string, at: string, who: string, kind: MoneyRow["kind"], baht: number): MoneyRow =>
  ({ id, at, who, kind, satang: baht * 100, afterSatang: null });

describe("ประวัติเติมเงิน range", () => {
  it("opens on today, a Bangkok day", () => {
    const r = parseRange(undefined, undefined, NOW);
    expect(r).toEqual({ fromDay: "2026-10-19", toDay: "2026-10-19", chip: "today" });
    const [from, to] = rangeBounds(r);
    expect(from.toISOString()).toBe("2026-10-18T17:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });

  it("counts 7 days back including today", () => {
    expect(parseRange("7d", undefined, NOW)).toEqual({ fromDay: "2026-10-13", toDay: "2026-10-19", chip: "7d" });
    expect(parseRange("90d", undefined, NOW).fromDay).toBe("2026-07-22");
  });

  it("takes one picked day, never a day after today or one that is not a date", () => {
    expect(parseRange("7d", "2026-10-15", NOW)).toEqual({ fromDay: "2026-10-15", toDay: "2026-10-15", chip: null });
    expect(parseRange(undefined, "2026-10-20", NOW).chip).toBe("today");
    expect(parseRange(undefined, "2026-02-30", NOW).chip).toBe("today");
    expect(parseRange(undefined, "x", NOW).chip).toBe("today");
  });

  it("knows only the four kinds", () => {
    expect(parseKind("pass")).toBe("pass");
    expect(parseKind("charge")).toBeNull();
  });
});

describe("ประวัติเติมเงิน money", () => {
  it("adds up each wallet's lines into the money after each one", () => {
    const after = balancesAfter([
      { id: "c", who: "a", at: "2026-10-15T03:00:00Z", satang: -1200 },
      { id: "t1", who: "a", at: "2026-10-14T03:00:00Z", satang: 20000 },
      { id: "t2", who: "b", at: "2026-10-15T04:00:00Z", satang: 5000 },
      { id: "t3", who: "a", at: "2026-10-16T03:00:00Z", satang: 10000 },
    ]);
    expect(after.get("t1")).toBe(20000);
    expect(after.get("c")).toBe(18800);
    expect(after.get("t3")).toBe(28800);
    expect(after.get("t2")).toBe(5000);
  });

  it("marks each person's first top-up or pass, not an adjustment", () => {
    const first = firstPaid([
      { id: "w:2", who: "a", at: "2026-10-15T00:00:00Z", kind: "topup" },
      { id: "w:1", who: "a", at: "2026-10-13T00:00:00Z", kind: "topup" },
      { id: "w:0", who: "b", at: "2026-10-01T00:00:00Z", kind: "adjust" },
      { id: "p:9", who: "b", at: "2026-10-16T00:00:00Z", kind: "pass" },
    ]);
    expect([...first].sort()).toEqual(["p:9", "w:1"]);
  });

  it("counts what was paid less what went back, without the owner's adjustments", () => {
    const rows = [
      row("w:1", "2026-10-19T01:00:00Z", "a", "topup", 200),
      row("p:1", "2026-10-19T02:00:00Z", "m", "pass", 199),
      row("w:2", "2026-10-19T02:30:00Z", "a", "topup", 100),
      row("w:3", "2026-10-19T03:00:00Z", "b", "adjust", 50),
      row("w:4", "2026-10-19T03:30:00Z", "c", "refund", -100),
    ];
    expect(summarize(rows, new Set(["p:1"]), null)).toEqual({ satang: 39900, count: 3, people: 2, firstTimers: 1 });
    // with only the adjustments shown, their own sum
    expect(summarize(rows.filter((r) => r.kind === "adjust"), new Set(), "adjust").satang).toBe(5000);
  });

  it("groups by Bangkok day, newest first", () => {
    const rows = [
      row("w:1", "2026-10-18T16:59:00Z", "a", "topup", 100), // 23:59 on the 18th
      row("w:2", "2026-10-18T17:01:00Z", "a", "topup", 100), // 00:01 on the 19th
      row("w:3", "2026-10-19T05:00:00Z", "b", "topup", 300),
    ];
    const days = byDay(rows);
    expect(days.map((d) => d.day)).toEqual(["2026-10-19", "2026-10-18"]);
    expect(days[0].rows.map((r) => r.id)).toEqual(["w:3", "w:2"]);
    expect(paidPerDay(rows, ["2026-10-17", "2026-10-18", "2026-10-19"])).toEqual([0, 10000, 40000]);
  });

  it("finds a person by name or code, any case", () => {
    const p = { name: "Somchai ใจดี", code: "104817", tenant: null, unit: null, isMember: false };
    expect(matches(p, "somchai")).toBe(true);
    expect(matches(p, "1048")).toBe(true);
    expect(matches(p, "ใจร้าย")).toBe(false);
    expect(matches(undefined, "")).toBe(true);
  });

  it("names a day the Thai way", () => {
    expect(dayLabel("2026-10-19", NOW)).toBe("วันนี้ · วันจันทร์ที่ 19 ต.ค. 2569");
    expect(dayLabel("2026-10-18", NOW)).toBe("เมื่อวาน · วันอาทิตย์ที่ 18 ต.ค. 2569");
    expect(dayLabel("2026-10-15", NOW)).toBe("วันพฤหัสบดีที่ 15 ต.ค. 2569");
  });
});
