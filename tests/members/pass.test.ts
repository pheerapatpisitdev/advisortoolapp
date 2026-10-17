import { describe, it, expect } from "vitest";
import {
  passPeriods,
  passState,
  daysLeft,
  roundsFrom,
  videosFrom,
  creditLots,
  onTrial,
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
  it("a live pass carries no free rounds since the credit took their place (owner, 2026-10-17)", () => {
    const s = passState(rows, at("2026-10-14"));
    expect(roundsFrom(s, on)).toEqual({ limit: 0, from: at("2026-10-13") });
  });
  it("expired, none or disabled gives null", () => {
    expect(roundsFrom(passState(rows, at("2026-11-01")), on)).toBeNull();
    expect(roundsFrom({ status: "none" }, on)).toBeNull();
    expect(roundsFrom(passState(rows, at("2026-10-14")), DEFAULT_PASS_SETTINGS)).toBeNull();
  });
});

describe("videosFrom (owner, 2026-10-14)", () => {
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
  const rows = [row(1, "trial", 3, "2026-10-13"), row(2, "paid", 30, "2026-10-14")];
  it("a live pass carries no free clips since the credit took their place (owner, 2026-10-17)", () => {
    expect(videosFrom(passState(rows, at("2026-10-14")), on)).toEqual({ limit: 0, from: at("2026-10-13") });
    expect(videosFrom(passState(rows, at("2026-10-20")), on)).toEqual({ limit: 0, from: at("2026-10-16") });
  });
  it("expired, none or switched off gives null: the one-time two apply", () => {
    expect(videosFrom(passState(rows, at("2026-12-01")), on)).toBeNull();
    expect(videosFrom({ status: "none" }, on)).toBeNull();
    expect(videosFrom(passState(rows, at("2026-10-14")), DEFAULT_PASS_SETTINGS)).toBeNull();
  });
});

describe("creditLots (owner, 2026-10-17)", () => {
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
  it("the trial carries ฿15 to its end, each payment ฿50 from the moment it was paid to its period's end", () => {
    const rows = [row(1, "trial", 3, "2026-10-17"), row(2, "paid", 30, "2026-10-18")];
    expect(creditLots(rows, on, at("2026-10-18"))).toEqual({
      lots: [
        { passId: 1, kind: "trial", satang: 1500, startsAt: at("2026-10-17"), expiresAt: at("2026-10-20") },
        // paid during the trial: usable at once, its 30 days stacked after the trial
        { passId: 2, kind: "paid", satang: 5000, startsAt: at("2026-10-18"), expiresAt: at("2026-11-19") },
      ],
      voids: [],
    });
  });
  it("leaves out periods already over, and granted and friend days, which carry no credit", () => {
    const rows = [row(1, "trial", 3, "2026-09-01"), row(2, "granted", 7, "2026-10-17"), row(3, "referral", 3, "2026-10-17")];
    expect(creditLots(rows, on, at("2026-10-18")).lots).toEqual([]);
  });
  it("an early renewal is its own lot, ending with the period it bought", () => {
    const rows = [row(1, "paid", 30, "2026-10-01"), row(2, "paid", 30, "2026-10-20")];
    expect(creditLots(rows, on, at("2026-10-20")).lots.map((l) => [l.passId, l.expiresAt])).toEqual([
      [1, at("2026-10-31")], [2, at("2026-11-30")],
    ]);
  });
  it("names the refunded passes, whose lot is voided, and writes none for them", () => {
    const rows = [row(1, "paid", 30, "2026-10-10"), row(2, "revoked", 0, "2026-10-12", 1)];
    expect(creditLots(rows, on, at("2026-10-12"))).toEqual({ lots: [], voids: [1] });
  });
  it("writes no lot for an amount the owner set to ฿0", () => {
    const rows = [row(1, "trial", 3, "2026-10-17")];
    expect(creditLots(rows, { ...on, trialCreditSatang: 0 }, at("2026-10-17")).lots).toEqual([]);
  });
});

describe("onTrial (review, 2026-10-13)", () => {
  it("is true only while the trial is the live and last period", () => {
    const rows = [row(1, "trial", 3, "2026-10-13")];
    expect(onTrial(passState(rows, at("2026-10-14")))).toBe(true);
  });
  it("is false once a paid month is stacked after the trial", () => {
    const rows = [row(1, "trial", 3, "2026-10-13"), row(2, "paid", 30, "2026-10-14")];
    const s = passState(rows, at("2026-10-14"));
    expect(s.status === "live" && s.period.kind).toBe("trial");
    expect(onTrial(s)).toBe(false);
  });
  it("is false for a paid or granted period, an expired pass or none", () => {
    expect(onTrial(passState([row(1, "paid", 30, "2026-10-13")], at("2026-10-14")))).toBe(false);
    expect(onTrial(passState([row(1, "granted", 5, "2026-10-13")], at("2026-10-14")))).toBe(false);
    expect(onTrial(passState([row(1, "trial", 3, "2026-10-13")], at("2026-11-01")))).toBe(false);
    expect(onTrial({ status: "none" })).toBe(false);
  });
});
