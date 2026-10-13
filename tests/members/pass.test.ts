import { describe, it, expect } from "vitest";
import {
  passPeriods,
  passState,
  daysLeft,
  roundsFrom,
  DEFAULT_PASS_SETTINGS,
  type PassRow,
  type PassKind,
} from "@/lib/members/pass";

const at = (d: string) => new Date(`${d}T10:00:00+07:00`);
const row = (
  id: number,
  kind: PassKind,
  days: number,
  createdAt: string,
  revokes: number | null = null,
): PassRow => ({
  id,
  kind,
  days,
  revokes,
  createdAt: at(createdAt).toISOString(),
  amountSatang: null,
  note: null,
});

describe("pass periods", () => {
  it("trial only", () => {
    const rows = [row(1, "trial", 3, "2026-10-13")];
    const p = passPeriods(rows);
    expect(p).toHaveLength(1);
    expect(p[0].start).toEqual(at("2026-10-13"));
    expect(p[0].end).toEqual(at("2026-10-16"));
    const s = passState(rows, at("2026-10-14"));
    expect(s.status).toBe("live");
    if (s.status === "live") {
      expect(s.period.kind).toBe("trial");
      expect(s.end).toEqual(at("2026-10-16"));
    }
  });

  it("paid during the trial stacks after it", () => {
    const rows = [row(1, "trial", 3, "2026-10-13"), row(2, "paid", 30, "2026-10-14")];
    const p = passPeriods(rows);
    expect(p.map((x) => [x.start, x.end])).toEqual([
      [at("2026-10-13"), at("2026-10-16")],
      [at("2026-10-16"), at("2026-11-15")],
    ]);
    const a = passState(rows, at("2026-10-14"));
    expect(a.status === "live" && a.period.kind).toBe("trial");
    expect(a.status === "live" && a.end).toEqual(at("2026-11-15"));
    const b = passState(rows, at("2026-10-17"));
    expect(b.status === "live" && b.period.kind).toBe("paid");
  });

  it("renew after expiry starts on the day paid", () => {
    const rows = [row(1, "trial", 3, "2026-10-01"), row(2, "paid", 30, "2026-10-20")];
    const p = passPeriods(rows);
    expect(p[1].start).toEqual(at("2026-10-20"));
    expect(passState(rows, at("2026-10-10"))).toEqual({ status: "expired", end: at("2026-10-04") });
  });

  it("a revoked pass drops out and later periods move up", () => {
    const rows = [
      row(1, "trial", 3, "2026-10-01"),
      row(2, "paid", 30, "2026-10-02"),
      row(3, "paid", 30, "2026-10-03"),
      row(4, "revoked", 0, "2026-10-05", 2),
    ];
    const p = passPeriods(rows);
    expect(p.map((x) => x.rowId)).toEqual([1, 3]);
    expect(p[1].start).toEqual(at("2026-10-04"));
    expect(p[1].end).toEqual(at("2026-11-03"));
  });

  it("granted days are a period of their own", () => {
    const rows = [row(1, "paid", 30, "2026-10-01"), row(2, "granted", 5, "2026-10-02")];
    const p = passPeriods(rows);
    expect(p[1].kind).toBe("granted");
    expect(p[1].start).toEqual(p[0].end);
    expect(p[1].end.getTime() - p[1].start.getTime()).toBe(5 * 86_400_000);
  });

  it("no rows is none", () => {
    expect(passState([], at("2026-10-13"))).toEqual({ status: "none" });
  });
});

describe("daysLeft", () => {
  it("is 0 once past, 1 for any part of a day left", () => {
    expect(daysLeft(at("2026-10-13"), at("2026-10-14"))).toBe(0);
    expect(daysLeft(at("2026-10-13"), at("2026-10-13"))).toBe(0);
    expect(daysLeft(new Date(at("2026-10-14").getTime() + 1000), at("2026-10-14"))).toBe(1);
    expect(daysLeft(at("2026-10-16"), at("2026-10-14"))).toBe(2);
  });
});

describe("roundsFrom", () => {
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
  const rows = [row(1, "trial", 3, "2026-10-13")];
  it("live and enabled gives the limit from the period start", () => {
    const s = passState(rows, at("2026-10-14"));
    expect(roundsFrom(s, on)).toEqual({ limit: 10, from: at("2026-10-13") });
  });
  it("expired, none or disabled gives null", () => {
    expect(roundsFrom(passState(rows, at("2026-11-01")), on)).toBeNull();
    expect(roundsFrom({ status: "none" }, on)).toBeNull();
    expect(roundsFrom(passState(rows, at("2026-10-14")), DEFAULT_PASS_SETTINGS)).toBeNull();
  });
});
