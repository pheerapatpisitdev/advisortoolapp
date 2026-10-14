import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, has } from "../helpers/fake-db";

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db.client }));
const names = vi.hoisted(() => ({ displayNames: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => names);

const store = await import("@/lib/referrals/store");

const SOMCHAI = "00000000-0000-4000-8000-00000000000a";
const FRIEND = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  db.reset();
  names.displayNames.mockReset().mockResolvedValue({ [SOMCHAI]: "สมชาย ใจดี" });
});

describe("a person's invitation code", () => {
  it("is the one they already have", async () => {
    db.on("ins_referral_codes", { data: { code: "SOMCHA7" } });
    expect(await store.codeFor(SOMCHAI, "member")).toBe("SOMCHA7");
    expect(db.writes("ins_referral_codes", "insert")).toHaveLength(0);
  });

  it("is made the first time they ask", async () => {
    db.on("ins_referral_codes", { data: null });
    const code = await store.codeFor(SOMCHAI, "unitos");
    expect(code).toMatch(/^[A-Z0-9]{7}$/);
    const [insert] = db.writes("ins_referral_codes", "insert");
    expect(insert[0].args[0]).toEqual({ owner_id: SOMCHAI, owner_kind: "unitos", code });
  });

  it("is the winner's when two first asks race", async () => {
    let reads = 0;
    db.on("ins_referral_codes", (steps) => {
      if (steps.some((s) => s.method === "insert")) return { error: { code: "23505", message: "dup" } };
      return { data: reads++ === 0 ? null : { code: "WINNER7" } };
    });
    expect(await store.codeFor(SOMCHAI, "member")).toBe("WINNER7");
  });
});

describe("who an invitation is from", () => {
  it("is the code's owner, by first name only", async () => {
    db.on("ins_referral_codes", { data: { owner_id: SOMCHAI, owner_kind: "member" } });
    expect(await store.inviterOf("somcha7")).toEqual({ id: SOMCHAI, kind: "member", name: "สมชาย" });
    expect(has(db.log[0].steps, "eq", "code", "SOMCHA7")).toBe(true);
  });

  it("is nobody for a code that cannot be one, or that nobody owns", async () => {
    expect(await store.inviterOf("??")).toBeNull();
    expect(db.log).toHaveLength(0);
    db.on("ins_referral_codes", { data: null });
    expect(await store.inviterOf("NOBODY7")).toBeNull();
  });
});

describe("tying a new member to whoever invited them", () => {
  it("writes the inviter once", async () => {
    db.on("ins_referral_codes", { data: { owner_id: SOMCHAI, owner_kind: "member" } });
    expect(await store.attachReferral(FRIEND, "SOMCHA7")).toBe("attached");
    const [insert] = db.writes("ins_referrals", "insert");
    expect(insert[0].args[0]).toEqual({ friend_id: FRIEND, referrer_id: SOMCHAI, referrer_kind: "member" });
  });

  it("skips an invitation to oneself, an unknown code and a second tie", async () => {
    db.on("ins_referral_codes", { data: { owner_id: SOMCHAI, owner_kind: "member" } });
    expect(await store.attachReferral(SOMCHAI, "SOMCHA7")).toBe("skipped");
    db.on("ins_referrals", { error: { code: "23505", message: "dup" } });
    expect(await store.attachReferral(FRIEND, "SOMCHA7")).toBe("skipped");
    db.on("ins_referral_codes", { data: null });
    expect(await store.attachReferral(FRIEND, "NOBODY7")).toBe("skipped");
  });
});

describe("the reward for a friend's first pass", () => {
  const settings = { referral_enabled: true, referral_days: 3, referral_days_cap: 30, referral_satang: 1000, referral_satang_cap: 10000 };

  it("is given by the database, with the owner's numbers and this Thai month", async () => {
    db.on("ins_ai_settings", { data: settings });
    db.on("rpc:ins_referral_reward", { data: "days" });
    expect(await store.rewardReferral("cs_1", new Date("2026-10-14T12:00:00+07:00"))).toBe("days");
    const [call] = db.log.filter((l) => l.table === "rpc:ins_referral_reward");
    expect(call.steps[0].args[0]).toEqual({
      p_session: "cs_1", p_since: "2026-09-30T17:00:00.000Z", p_days: 3, p_days_cap: 30, p_satang: 1000, p_satang_cap: 10000,
    });
  });

  it("is nothing while the switch is off", async () => {
    db.on("ins_ai_settings", { data: { ...settings, referral_enabled: false } });
    expect(await store.rewardReferral("cs_1")).toBe("off");
    expect(db.log.some((l) => l.table === "rpc:ins_referral_reward")).toBe(false);
  });

  it("throws when the database does, so Stripe sends the payment again", async () => {
    db.on("ins_ai_settings", { data: settings });
    db.on("rpc:ins_referral_reward", { error: { message: "boom" } });
    await expect(store.rewardReferral("cs_1")).rejects.toThrow("boom");
  });
});

describe("the owner's settings", () => {
  it("are off with the owner's defaults before anything is saved", async () => {
    db.on("ins_ai_settings", { data: null });
    expect(await store.referralSettings()).toEqual({ enabled: false, days: 3, daysCap: 30, satang: 1000, satangCap: 10000 });
  });
});
