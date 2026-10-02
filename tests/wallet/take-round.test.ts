import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Who pays for a round: staff nobody, then the ten free rounds, then the agent's wallet (owner, 2026-09-30). */

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

const { takeRound } = await import("@/lib/auth/quota");
const { holdSatang } = await import("@/lib/wallet/money");

const agent: Viewer = {
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

/** what the free-round function answers: the round's line, or null once ten are used */
const freeUsed = () => { db.free = null; };

beforeEach(() => {
  vi.clearAllMocks();
  db.free = 41;
  db.freeError = null;
  db.rpc.mockImplementation(async () => ({ data: db.free, error: db.freeError }));
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2 });
  wallet.holdWallet.mockResolvedValue("h1");
  wallet.walletFrozen.mockResolvedValue(false);
});

describe("takeRound", () => {
  it("lets staff through, counting nothing", async () => {
    expect(await takeRound({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }, "ai-write"))
      .toEqual({ ok: true, paidBy: "staff" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("uses the free rounds first, counted and written down in one locked call, and carries the line's id", async () => {
    expect(await takeRound(agent, "ai-write")).toEqual({ ok: true, paidBy: "free", auditId: 41 });
    expect(db.rpc).toHaveBeenCalledWith("ins_take_free_round", {
      p_agent: agent.agentId, p_action: "ai-write", p_target: null,
      p_limit: 10, p_from: "2026-09-30T17:00:00.000Z", p_rounds: ["ai-write", "ai-recruit", "ai-claim", "ai-draw", "ai-knowledge", "ai-draft", "ai-clip"],
    });
    // the database wrote the line; nothing is written beside it, and no wallet is touched
    expect(db.insert).not.toHaveBeenCalled();
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("refuses the round when the free rounds cannot be counted, rather than run it free and uncounted", async () => {
    db.freeError = { message: "connection reset" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await takeRound(agent, "ai-write");
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
    const passes = await Promise.all(Array.from({ length: 10 }, () => takeRound(agent, "ai-write")));
    expect(passes.filter((p) => p.ok && p.paidBy === "free")).toHaveLength(1);
    expect(passes.filter((p) => !p.ok)).toHaveLength(9);
  });

  it("holds the round's price in the wallet once the free rounds are used", async () => {
    freeUsed();
    const held = holdSatang("ai-draw", 2);
    expect(await takeRound(agent, "ai-draw", "piece-1"))
      .toEqual({ ok: true, paidBy: "wallet", holdId: "h1", heldSatang: held, multiplier: 2 });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-draw", target: "piece-1", detail: { wallet: true } });
  });

  it("holds the price it is told instead of the round's default, times the multiplier", async () => {
    freeUsed();
    const res = await takeRound(agent, "ai-draw", "piece-1", 0.46);
    expect(res).toMatchObject({ ok: true, paidBy: "wallet", heldSatang: 92, multiplier: 2 });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, 92, "ai-draw");
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
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2 });
    const r = await takeRound(agent, "ai-write");
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
