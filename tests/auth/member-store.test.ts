import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});
vi.mock("@/lib/wallet/store", () => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));

import { db, has } from "../helpers/fake-db";
const store = await import("@/lib/auth/member-store");

beforeEach(() => db.reset());

describe("createMember", () => {
  it("writes the row and returns its id", async () => {
    db.on("ins_members", { data: { id: "m1" } });
    expect(await store.createMember({ phone: "0812345678", name: "สมชาย", pinHash: "scrypt$x", ip: "1.2.3.4" })).toEqual({ ok: true, id: "m1" });
    const [insert] = db.writes("ins_members", "insert");
    expect(insert[0].args[0]).toEqual({ phone: "0812345678", name: "สมชาย", pin_hash: "scrypt$x", signup_ip: "1.2.3.4" });
  });

  it("says taken when the phone's unique index refuses the row", async () => {
    db.on("ins_members", { error: { message: "duplicate key", code: "23505" } });
    expect(await store.createMember({ phone: "0812345678", name: "ก", pinHash: "h", ip: "ip" })).toEqual({ ok: false, taken: true });
  });

  it("throws on any other failure", async () => {
    db.on("ins_members", { error: { message: "boom" } });
    await expect(store.createMember({ phone: "0812345678", name: "ก", pinHash: "h", ip: "ip" })).rejects.toThrow("boom");
  });
});

describe("setPin", () => {
  it("stamps the change with the app's clock, not the database's", async () => {
    const at = new Date("2026-10-01T05:00:00.123Z");
    await store.setPin("m1", "scrypt$y", at);
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ pin_hash: "scrypt$y", pin_changed_at: "2026-10-01T05:00:00.123Z" });
    expect(has(update, "eq", "id", "m1")).toBe(true);
  });
});

describe("setStatus", () => {
  it("ends every existing session when it suspends, so reinstating does not revive them", async () => {
    const at = new Date("2026-10-01T05:00:00.000Z");
    await store.setStatus("m1", "suspended", at);
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ status: "suspended", pin_changed_at: "2026-10-01T05:00:00.000Z" });
    expect(has(update, "eq", "id", "m1")).toBe(true);
  });

  it("leaves pin_changed_at alone when it reinstates", async () => {
    await store.setStatus("m1", "active");
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ status: "active" });
  });
});

describe("clearPinFailures", () => {
  it("deletes only that phone's failed attempts", async () => {
    await store.clearPinFailures("0812345678");
    const [del] = db.writes("ins_login_attempts", "delete");
    expect(has(del, "eq", "phone", "0812345678")).toBe(true);
    expect(has(del, "eq", "ok", false)).toBe(true);
  });

  it("throws when the delete fails", async () => {
    db.on("ins_login_attempts", { error: { message: "boom" } });
    await expect(store.clearPinFailures("0812345678")).rejects.toThrow("boom");
  });
});

describe("deleteMember", () => {
  it("filters the delete by id", async () => {
    await store.deleteMember("m1");
    const [deleteOp] = db.writes("ins_members", "delete");
    expect(has(deleteOp, "eq", "id", "m1")).toBe(true);
  });
});

describe("memberSettings", () => {
  it("is closed with no contact link when nothing is saved", async () => {
    db.on("ins_ai_settings", { data: null });
    expect(await store.memberSettings()).toEqual({ signupOpen: false, contactUrl: null });
  });

  it("reads what was saved", async () => {
    db.on("ins_ai_settings", { data: { member_signup_enabled: true, member_contact_url: "https://lin.ee/x" } });
    expect(await store.memberSettings()).toEqual({ signupOpen: true, contactUrl: "https://lin.ee/x" });
  });
});

describe("counts", () => {
  it("counts sign-ups from an address since a moment", async () => {
    db.on("ins_members", (steps) => ({ count: has(steps, "eq", "signup_ip", "1.2.3.4") ? 2 : 0 }));
    expect(await store.signupsFromIp("1.2.3.4", new Date(0))).toBe(2);
  });

  it("counts a phone's failed sign-ins since a moment", async () => {
    db.on("ins_login_attempts", (steps) => ({ count: has(steps, "eq", "phone", "0812345678") && has(steps, "eq", "ok", false) ? 4 : 0 }));
    expect(await store.phoneFailures("0812345678", new Date(0))).toBe(4);
  });
});

describe("PIN attempts", () => {
  it("claims a failed attempt for the phone and returns its id", async () => {
    db.on("ins_login_attempts", { data: { id: "a1" } });
    expect(await store.claimPinAttempt("1.2.3.4", "0812345678")).toBe("a1");
    const [insert] = db.writes("ins_login_attempts", "insert");
    expect(insert[0].args[0]).toEqual({ ip: "1.2.3.4", ok: false, phone: "0812345678" });
  });

  it("throws when the claim cannot be written", async () => {
    db.on("ins_login_attempts", { error: { message: "boom" } });
    await expect(store.claimPinAttempt("ip", "0812345678")).rejects.toThrow("boom");
  });

  it("marks the claimed attempt ok, by id", async () => {
    await store.markPinAttemptOk("a1");
    const [update] = db.writes("ins_login_attempts", "update");
    expect(update[0].args[0]).toEqual({ ok: true });
    expect(has(update, "eq", "id", "a1")).toBe(true);
  });

  it("releases the claimed attempt, by id", async () => {
    await store.releasePinAttempt("a1");
    const [del] = db.writes("ins_login_attempts", "delete");
    expect(has(del, "eq", "id", "a1")).toBe(true);
  });
});

describe("listMembers", () => {
  it("lists members newest first with balance and free rounds used, capped at ten", async () => {
    db.on("ins_members", { data: [
      { id: "m2", name: "ข", phone: "0822222222", status: "suspended", created_at: "2026-10-02T00:00:00Z" },
      { id: "m1", name: "ก", phone: "0811111111", status: "active", created_at: "2026-10-01T00:00:00Z" },
    ] });
    db.on("ins_wallets", { data: [{ agent_id: "m1", balance_satang: 5000 }] });
    db.on("ins_audit", (steps) => ({ count: has(steps, "eq", "agent_id", "m1") ? 14 : 3 }));
    expect(await store.listMembers()).toEqual([
      { id: "m2", name: "ข", phone: "0822222222", status: "suspended", createdAt: "2026-10-02T00:00:00Z", balanceSatang: 0, freeUsed: 3 },
      { id: "m1", name: "ก", phone: "0811111111", status: "active", createdAt: "2026-10-01T00:00:00Z", balanceSatang: 5000, freeUsed: 10 },
    ]);
  });
});
