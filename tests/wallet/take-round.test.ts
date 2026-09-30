import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Who pays for a round: staff nobody, then the free month, then the agent's wallet (owner, 2026-09-30). */

const db = vi.hoisted(() => ({ used: 0, insert: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => table === "ins_ai_settings"
      ? { select: () => ({ maybeSingle: async () => ({ data: { member_ai_month: 20, trial_ai_month: 5 }, error: null }) }) }
      : {
        select: () => ({ eq: () => ({ in: () => ({ gte: async () => ({ count: db.used, error: null }) }) }) }),
        insert: db.insert,
      },
  }),
}));
const wallet = vi.hoisted(() => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { takeRound } = await import("@/lib/auth/quota");
const { holdSatang } = await import("@/lib/wallet/money");

const agent: Viewer = {
  agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.used = 0;
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2 });
  wallet.holdWallet.mockResolvedValue("h1");
});

describe("takeRound", () => {
  it("lets staff through, counting nothing", async () => {
    expect(await takeRound({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }, "ai-write"))
      .toEqual({ ok: true, paidBy: "staff" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("uses the free month first, and counts the round", async () => {
    db.used = 19;
    expect(await takeRound(agent, "ai-write")).toEqual({ ok: true, paidBy: "free" });
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-write", target: null });
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("holds the round's price in the wallet once the free month is used", async () => {
    db.used = 20;
    const held = holdSatang("ai-draw", 2);
    expect(await takeRound(agent, "ai-draw", "piece-1"))
      .toEqual({ ok: true, paidBy: "wallet", holdId: "h1", heldSatang: held, multiplier: 2 });
    expect(wallet.holdWallet).toHaveBeenCalledWith(agent.agentId, held, "ai-draw");
    expect(db.insert).toHaveBeenCalledWith({ agent_id: agent.agentId, action: "ai-draw", target: "piece-1", detail: { wallet: true } });
  });

  it("refuses and sends the agent to top up when the wallet has not got it", async () => {
    db.used = 20;
    wallet.holdWallet.mockResolvedValueOnce(null);
    const r = await takeRound(agent, "ai-write");
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.refusal).toMatch(/เติมเงิน.*กระเป๋าเงิน/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("says the old words while the owner has the wallet off", async () => {
    db.used = 20;
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2 });
    const r = await takeRound(agent, "ai-write");
    expect(r.ok === false && r.refusal).toMatch(/20 ครั้งต่อเดือน/);
    expect(wallet.holdWallet).not.toHaveBeenCalled();
  });

  it("says the old words when the wallet cannot be read, rather than letting the round through", async () => {
    db.used = 20;
    wallet.walletSettings.mockRejectedValueOnce(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await takeRound(agent, "ai-write");
    err.mockRestore();
    expect(r.ok).toBe(false);
  });
});
