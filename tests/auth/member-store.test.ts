import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});
vi.mock("@/lib/wallet/store", () => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));

import { db, has } from "../helpers/fake-db";
const store = await import("@/lib/auth/member-store");

beforeEach(() => db.reset());

describe("memberByGoogleSub", () => {
  it("looks the member up by Google's id", async () => {
    db.on("ins_members", (steps) => ({ data: has(steps, "eq", "google_sub", "g-1") ? { id: "m1" } : null }));
    expect(await store.memberByGoogleSub("g-1")).toEqual({ id: "m1" });
    expect(await store.memberByGoogleSub("g-2")).toBeNull();
  });
});

describe("createMember", () => {
  it("writes the row and returns its id", async () => {
    db.on("ins_members", { data: { id: "m1" } });
    expect(await store.createMember({ googleSub: "g-1", email: "a@gmail.com", name: "สมชาย", ip: "1.2.3.4" })).toEqual({ ok: true, id: "m1" });
    const [insert] = db.writes("ins_members", "insert");
    expect(insert[0].args[0]).toEqual({ google_sub: "g-1", email: "a@gmail.com", name: "สมชาย", signup_ip: "1.2.3.4" });
  });

  it("says taken when the Google account's unique index refuses the row", async () => {
    db.on("ins_members", { error: { message: "duplicate key", code: "23505" } });
    expect(await store.createMember({ googleSub: "g-1", email: "a@gmail.com", name: "ก", ip: "ip" })).toEqual({ ok: false, taken: true });
  });

  it("throws on any other failure", async () => {
    db.on("ins_members", { error: { message: "boom" } });
    await expect(store.createMember({ googleSub: "g-1", email: "a@gmail.com", name: "ก", ip: "ip" })).rejects.toThrow("boom");
  });
});

describe("setEmail", () => {
  it("updates that member's email", async () => {
    await store.setEmail("m1", "new@gmail.com");
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ email: "new@gmail.com" });
    expect(has(update, "eq", "id", "m1")).toBe(true);
  });
});

describe("setStatus", () => {
  it("ends every existing session when it suspends, so reinstating does not revive them", async () => {
    const at = new Date("2026-10-01T05:00:00.000Z");
    await store.setStatus("m1", "suspended", at);
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ status: "suspended", revoked_at: "2026-10-01T05:00:00.000Z" });
    expect(has(update, "eq", "id", "m1")).toBe(true);
  });

  it("leaves revoked_at alone when it reinstates", async () => {
    await store.setStatus("m1", "active");
    const [update] = db.writes("ins_members", "update");
    expect(update[0].args[0]).toEqual({ status: "active" });
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
  it("is closed when nothing is saved", async () => {
    db.on("ins_ai_settings", { data: null });
    expect(await store.memberSettings()).toEqual({ signupOpen: false });
  });

  it("reads what was saved", async () => {
    db.on("ins_ai_settings", { data: { member_signup_enabled: true } });
    expect(await store.memberSettings()).toEqual({ signupOpen: true });
  });
});

describe("counts", () => {
  it("counts sign-ups from an address since a moment", async () => {
    db.on("ins_members", (steps) => ({ count: has(steps, "eq", "signup_ip", "1.2.3.4") ? 2 : 0 }));
    expect(await store.signupsFromIp("1.2.3.4", new Date(0))).toBe(2);
  });

});

describe("listMembers", () => {
  it("lists members newest first with balance and free rounds used, capped at ten", async () => {
    db.on("ins_members", { data: [
      { id: "m2", name: "ข", email: "b@gmail.com", status: "suspended", created_at: "2026-10-02T00:00:00Z" },
      { id: "m1", name: "ก", email: "a@gmail.com", status: "active", created_at: "2026-10-01T00:00:00Z" },
    ] });
    db.on("ins_wallets", { data: [{ agent_id: "m1", balance_satang: 5000 }] });
    db.on("ins_audit", (steps) => ({ count: has(steps, "eq", "agent_id", "m1") ? 14 : 3 }));
    expect(await store.listMembers()).toEqual([
      { id: "m2", name: "ข", email: "b@gmail.com", status: "suspended", createdAt: "2026-10-02T00:00:00Z", balanceSatang: 0, freeUsed: 3 },
      { id: "m1", name: "ก", email: "a@gmail.com", status: "active", createdAt: "2026-10-01T00:00:00Z", balanceSatang: 5000, freeUsed: 10 },
    ]);
  });
});
