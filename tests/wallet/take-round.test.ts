import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * Who pays for a round: the owner nobody, then the ten free rounds, then the agent's wallet
 * (owner, 2026-09-30). Assistants pay as any agent does (owner, 2026-10-02).
 */

// ins_take_free_round answers with the round's audit id, or null when the free rounds are used
const db = vi.hoisted(() => ({
  free: 41 as number | null,
  freeError: null as { message: string } | null,
  rpc: vi.fn(),
  insert: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: db.rpc,
    from: () => ({ insert: db.insert }),
  }),
}));
const wallet = vi.hoisted(() => ({ walletSettings: vi.fn(), holdWallet: vi.fn(), walletFrozen: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);
// not gated unless a test says so: the cases below are about agents, whom no pass touches
const access = vi.hoisted(() => ({ memberAccess: vi.fn() }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: access.memberAccess,
}));

const { takeRound, FREE_ROUNDS, FREE_ROUNDS_FROM } = await import("@/lib/auth/quota");
const { PASS_EXPIRED, PASS_UNREADABLE } = await import("@/lib/members/access");
const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");
const { holdSatang } = await import("@/lib/wallet/money");

const agent: Viewer = {
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

/**
 * the free rounds' machinery, as a member has it while the owner has the pass switched off: a
 * UnitClub agent has none since the ฿15 starter credit took their place (owner, 2026-10-18)
 */
const taster: Viewer = { ...agent, kind: "member", agentId: "00000000-0000-4000-8000-000000000007", tenantId: null };

/** what the free-round function answers: the round's line, or null once ten are used */
const freeUsed = () => { db.free = null; };

beforeEach(() => {
  vi.clearAllMocks();
  db.free = 41;
  db.freeError = null;
  // as the database does: a limit of 0 lets no round in free
  db.rpc.mockImplementation(async (_fn: string, args?: { p_limit?: number }) =>
    ({ data: args?.p_limit === 0 ? null : db.free, error: db.freeError }));
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2, agentId: agent.agentId });
  wallet.holdWallet.mockResolvedValue("h1");
  wallet.walletFrozen.mockResolvedValue(false);
  access.memberAccess.mockResolvedValue({ gated: false });
});

describe("takeRound", () => {
  it("lets the owner through, counting nothing", async () => {
    expect(await takeRound({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }, "ai-write"))
      .toEqual({ ok: true, paidBy: "staff", agentId: agent.agentId });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("gives a UnitClub agent no free round: the round is held, and ins_wallet_hold spends the starter credit first (owner, 2026-10-18)", async () => {
    expect(await takeRound(agent, "ai-write")).toMatchObject({ ok: true, paidBy: "wallet", holdId: "h1" });
    expect(db.rpc).toHaveBeenCalledWith("ins_take_free_round", expect.objectContaining({ p_agent: agent.agentId, p_limit: 0 }));
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, holdSatang("ai-write", 2), "ai-write");
  });

  it("pays an assistant's round the same way as any agent's (owner, 2026-10-02)", async () => {
    const assistant: Viewer = { ...agent, staff: { owner: false, publish: true, connect: true, admin: true } };
    expect(await takeRound(assistant, "ai-write")).toMatchObject({ ok: true, paidBy: "wallet", holdId: "h1" });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, holdSatang("ai-write", 2), "ai-write");
  });

  it("tells an agent the credit and the wallet together fell short", async () => {
    wallet.holdWallet.mockResolvedValueOnce(null);
    const r = await takeRound(agent, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/^เครดิตและเงินในกระเป๋าไม่พอ/);
  });

  it("uses the free rounds first, counted and written down in one locked call, and carries the line's id", async () => {
    expect(await takeRound(taster, "ai-write")).toEqual({ ok: true, paidBy: "free", auditId: 41, agentId: taster.agentId });
    expect(db.rpc).toHaveBeenCalledWith("ins_take_free_round", {
      p_agent: taster.agentId, p_action: "ai-write", p_target: null,
      p_limit: 10, p_from: "2026-10-10T04:10:00.000Z", p_rounds: ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft", "ai-thanks", "ai-showcase", "ai-saying", "ai-clip", "ai-edit", "ai-describe"],
    });
    // the database wrote the line; nothing is written beside it, and no wallet is touched
    expect(db.insert).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses the round when the free rounds cannot be counted, rather than run it free and uncounted", async () => {
    db.freeError = { message: "connection reset" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await takeRound(taster, "ai-write");
    err.mockRestore();
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.refusal).toMatch(/นับรอบฟรีไม่ได้/);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses when the free-round call throws, too", async () => {
    db.rpc.mockRejectedValueOnce(new Error("fetch failed"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await takeRound(agent, "ai-write")).toMatchObject({ ok: false });
    err.mockRestore();
  });

  it("lets ten rounds sent at 9 of 10 through one at a time: only the one the database let in runs free", async () => {
    // the database's lock makes them queue; it lets the first in and says null to the rest
    let left = 1;
    db.rpc.mockImplementation(async () => ({ data: left-- > 0 ? 7 : null, error: null }));
    wallet.holdWallet.mockResolvedValue(null);
    const passes = await Promise.all(Array.from({ length: 10 }, () => takeRound(taster, "ai-write")));
    expect(passes.filter((p) => p.ok && p.paidBy === "free")).toHaveLength(1);
    expect(passes.filter((p) => !p.ok)).toHaveLength(9);
  });

  it("holds the round's price in the wallet once the free rounds are used", async () => {
    freeUsed();
    const held = holdSatang("ai-draw", 2);
    expect(await takeRound(agent, "ai-draw", "piece-1"))
      .toEqual({ ok: true, paidBy: "wallet", holdId: "h1", heldSatang: held, multiplier: 2, agentId: agent.agentId });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-draw", target: "piece-1", detail: { wallet: true } });
  });

  it("holds a picture reading's own price once the free rounds are used", async () => {
    freeUsed();
    expect(await takeRound(agent, "ai-describe"))
      .toEqual({ ok: true, paidBy: "wallet", holdId: "h1", heldSatang: 100, multiplier: 2, agentId: agent.agentId });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, 100, "ai-describe");
  });

  it("holds the price it is told instead of the round's default, times the multiplier", async () => {
    freeUsed();
    const res = await takeRound(agent, "ai-draw", "piece-1", 0.46);
    expect(res).toMatchObject({ ok: true, paidBy: "wallet", heldSatang: 92, multiplier: 2, agentId: agent.agentId });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, 92, "ai-draw");
  });

  it("holds a fixed price as it is, untouched by the multiplier (owner, 2026-10-12)", async () => {
    freeUsed();
    const res = await takeRound(agent, "ai-draw", "piece-1", { satang: 500 });
    expect(res).toMatchObject({ ok: true, paidBy: "wallet", heldSatang: 500, multiplier: 2 });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, 500, "ai-draw");
  });

  it("keeps the round's default hold when a fixed price is not a positive whole number of satang", async () => {
    freeUsed();
    const held = holdSatang("ai-draw", 2);
    for (const bad of [0, -100, 1.5, NaN]) {
      wallet.holdWallet.mockClear();
      await takeRound(agent, "ai-draw", "piece-1", { satang: bad });
      expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    }
  });

  it("keeps the round's default hold when the price it is told is not a positive number", async () => {
    freeUsed();
    const held = holdSatang("ai-draw", 2);
    for (const bad of [0, -1, NaN, Infinity]) {
      wallet.holdWallet.mockClear();
      await takeRound(agent, "ai-draw", "piece-1", bad);
      expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    }
  });

  it("refuses and sends the agent to top up when the wallet has not got it", async () => {
    freeUsed();
    wallet.holdWallet.mockResolvedValueOnce(null);
    const r = await takeRound(agent, "ai-write");
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.refusal).toMatch(/เติมเงิน.*กระเป๋าเงิน/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("says the wallet is paused, not that it is short, when a refund or a dispute froze it", async () => {
    freeUsed();
    wallet.holdWallet.mockResolvedValueOnce(null);
    wallet.walletFrozen.mockResolvedValueOnce(true);
    const r = await takeRound(agent, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/พักไว้.*ติดต่อสำนักงาน/);
    expect(r.ok === false && r.refusal).not.toMatch(/เติมเงิน/);
  });

  it("says the old words while the owner has the wallet off", async () => {
    freeUsed();
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2, agentId: agent.agentId });
    const r = await takeRound(taster, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/รอบฟรีครบ 10 ครั้ง/);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("says the old words when the wallet cannot be read, rather than letting the round through", async () => {
    freeUsed();
    wallet.walletSettings.mockRejectedValueOnce(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await takeRound(agent, "ai-write");
    err.mockRestore();
    expect(r.ok).toBe(false);
  });
});

describe("takeRound for an outside member (owner, 2026-10-13)", () => {
  const member: Viewer = { ...agent, kind: "member", agentId: "00000000-0000-4000-8000-000000000009", tenantId: null };
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
  const start = new Date("2026-10-12T03:00:00Z");
  const live = { status: "live", period: { rowId: 1, kind: "paid", start, end: new Date(start.getTime() + 30 * 86_400_000) }, end: new Date(start.getTime() + 30 * 86_400_000) };

  it("refuses an expired member without counting a round", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: { status: "expired", end: start }, settings: on });
    expect(await takeRound(member, "ai-write")).toEqual({ ok: false, refusal: PASS_EXPIRED });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses a member with no pass at all the same way", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: { status: "none" }, settings: on });
    expect(await takeRound(member, "ai-write")).toEqual({ ok: false, refusal: PASS_EXPIRED });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("refuses when the pass cannot be read, rather than let the round through", async () => {
    access.memberAccess.mockRejectedValue(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await takeRound(member, "ai-write")).toEqual({ ok: false, refusal: PASS_UNREADABLE });
    err.mockRestore();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("gives a live member no free round: the round is held from the pass's credit, then their own money (owner, 2026-10-17)", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    freeUsed();
    expect(await takeRound(member, "ai-write")).toMatchObject({ ok: true, paidBy: "wallet", holdId: "h1" });
    expect(db.rpc).toHaveBeenCalledWith("ins_take_free_round", expect.objectContaining({
      p_agent: member.agentId, p_limit: 0, p_from: start.toISOString(),
    }));
    // ins_wallet_hold takes from the credit first (supabase/migrations/20261120_member_credit.sql)
    expect(wallet.holdWallet).toHaveBeenCalledWith(member.agentId, holdSatang("ai-write", 2), "ai-write");
    expect(access.memberAccess).toHaveBeenCalledTimes(1);
  });

  it("says the credit and the wallet together fell short, not that free rounds ran out", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    freeUsed();
    wallet.holdWallet.mockResolvedValueOnce(null);
    const r = await takeRound(member, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/^เครดิตและเงินในกระเป๋าไม่พอ — รอบนี้ต้องมีอย่างน้อย ฿10\.00/);
  });

  it("says Studio cannot be paid for when the wallet is off", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    freeUsed();
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2, agentId: member.agentId });
    const r = await takeRound(member, "ai-write");
    expect(r.ok === false && r.refusal).toBe("ตอนนี้ยังใช้เครดิตและกระเป๋าเงินไม่ได้ครับ");
  });

  it("keeps the one-time ten while the switch is off", async () => {
    access.memberAccess.mockResolvedValue({ gated: false });
    expect(await takeRound(member, "ai-write")).toMatchObject({ ok: true, paidBy: "free" });
    expect(db.rpc).toHaveBeenCalledWith("ins_take_free_round", expect.objectContaining({
      p_limit: FREE_ROUNDS, p_from: FREE_ROUNDS_FROM.toISOString(),
    }));
  });

  it("never asks about a pass for the owner", async () => {
    await takeRound({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }, "ai-write");
    expect(access.memberAccess).not.toHaveBeenCalled();
  });
});
