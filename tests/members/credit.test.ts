import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PASS_SETTINGS, type PassKind, type PassRow } from "@/lib/members/pass";

/**
 * An outside member's Studio credit (owner, 2026-10-17; mockup 3NoZWL3b): the lots the pass
 * ledger earns are written once and voided on a refund; what is spendable is what
 * ins_wallet_hold would take. The database is the fake one; spending itself is SQL
 * (supabase/migrations/20261120_member_credit.sql).
 */

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { syncCredits, creditLeft, creditOf } = await import("@/lib/members/credit");

const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
const at = (d: string) => new Date(`${d}T10:00:00+07:00`);
const row = (id: number, kind: PassKind, days: number, createdAt: string, revokes: number | null = null): PassRow =>
  ({ id, kind, days, revokes, createdAt: at(createdAt).toISOString(), amountSatang: null, note: null });

beforeEach(() => db.reset());

describe("syncCredits", () => {
  it("writes each earned lot once, leaving a lot already there as it is", async () => {
    await syncCredits("m1", [row(1, "trial", 3, "2026-10-17"), row(2, "paid", 30, "2026-10-18")], on, at("2026-10-18"));
    const [steps] = db.writes("ins_member_credits", "upsert");
    expect(steps[0].args[0]).toEqual([
      { member_id: "m1", pass_id: 1, kind: "trial", amount_satang: 1500, left_satang: 1500, starts_at: at("2026-10-17").toISOString(), expires_at: at("2026-10-20").toISOString() },
      { member_id: "m1", pass_id: 2, kind: "paid", amount_satang: 5000, left_satang: 5000, starts_at: at("2026-10-18").toISOString(), expires_at: at("2026-11-19").toISOString() },
    ]);
    expect(steps[0].args[1]).toEqual({ onConflict: "pass_id", ignoreDuplicates: true });
    expect(db.writes("ins_member_credits", "update")).toHaveLength(0);
  });

  it("voids the lot of a refunded pass, only one not voided yet", async () => {
    await syncCredits("m1", [row(1, "paid", 30, "2026-10-10"), row(2, "revoked", 0, "2026-10-12", 1)], on, at("2026-10-12"));
    expect(db.writes("ins_member_credits", "upsert")).toHaveLength(0);
    const [steps] = db.writes("ins_member_credits", "update");
    expect(steps.map((s) => s.method)).toEqual(["update", "eq", "in", "is"]);
    expect(steps.find((s) => s.method === "in")?.args).toEqual(["pass_id", [1]]);
    expect(steps.find((s) => s.method === "is")?.args).toEqual(["voided_at", null]);
  });

  it("writes nothing for a ledger with no lot to earn", async () => {
    await syncCredits("m1", [row(1, "granted", 7, "2026-10-17")], on, at("2026-10-17"));
    expect(db.log).toHaveLength(0);
  });

  it("throws when the write fails, for memberAccess to log", async () => {
    db.on("ins_member_credits", { error: { message: "down" } });
    await expect(syncCredits("m1", [row(1, "trial", 3, "2026-10-17")], on, at("2026-10-17"))).rejects.toThrow("down");
  });
});

describe("what credit there is to spend", () => {
  const lot = (o: Record<string, unknown>) => ({
    pass_id: 1, amount_satang: 5000, left_satang: 3800, starts_at: "2026-10-18T03:00:00Z", expires_at: "2026-11-19T03:00:00Z", voided_at: null, pass: { kind: "paid" }, ...o,
  });

  it("is the live lots' left, of what they carried, ending at the soonest; voided, ended or not yet begun lots count for nothing", async () => {
    db.on("ins_member_credits", { data: [
      lot({}),
      lot({ pass_id: 2, amount_satang: 1500, left_satang: 0, expires_at: "2026-10-20T03:00:00Z", pass: [{ kind: "trial" }] }),
      lot({ pass_id: 3, voided_at: "2026-10-19T00:00:00Z" }),
      lot({ pass_id: 4, expires_at: "2026-10-01T00:00:00Z" }),
      lot({ pass_id: 5, starts_at: "2026-12-01T00:00:00Z" }),
    ] });
    expect(await creditLeft("m1", new Date("2026-10-19T03:00:00Z"))).toEqual({ satang: 3800, of: 6500, expiresAt: "2026-10-20T03:00:00Z" });
  });

  it("is nothing for someone with no lots, an agent", () => {
    expect(creditOf([], new Date())).toEqual({ satang: 0, of: 0, expiresAt: null });
  });
});
