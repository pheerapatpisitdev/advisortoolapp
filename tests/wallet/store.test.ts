import { beforeEach, describe, expect, it, vi } from "vitest";

/** The wallet's database calls: the right function with the right names, and what a failure means. */

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  settings: { data: null as unknown, error: null as unknown },
  wallet: { data: null as unknown, error: null as unknown },
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: db.rpc,
    from: (table: string) => ({
      select: () => ({
        maybeSingle: async () => db.settings,
        eq: () => ({ maybeSingle: async () => db.wallet }),
      }),
    }),
  }),
}));

const store = await import("@/lib/wallet/store");

beforeEach(() => {
  vi.clearAllMocks();
  db.rpc.mockResolvedValue({ data: null, error: null });
  db.settings = { data: null, error: null };
  db.wallet = { data: null, error: null };
});

describe("walletSettings", () => {
  it("is off at ×2 when the owner never set it", async () => {
    expect(await store.walletSettings()).toEqual({ enabled: false, multiplier: 2 });
  });

  it("reads what the owner set", async () => {
    db.settings = { data: { wallet_enabled: true, wallet_multiplier: "1.5" }, error: null };
    expect(await store.walletSettings()).toEqual({ enabled: true, multiplier: 1.5 });
  });

  it("throws when the settings cannot be read, rather than guess", async () => {
    db.settings = { data: null, error: { message: "down" } };
    await expect(store.walletSettings()).rejects.toThrow("down");
  });
});

describe("holding and settling", () => {
  it("holds through ins_wallet_hold and gives back its id, or null when short", async () => {
    db.rpc.mockResolvedValueOnce({ data: "h1", error: null });
    expect(await store.holdWallet("a1", 1000, "ai-write")).toBe("h1");
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_hold", { p_agent: "a1", p_amount: 1000, p_round: "ai-write" });
    db.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await store.holdWallet("a1", 1000, "ai-write")).toBeNull();
  });

  it("settles with the charge and the real cost", async () => {
    db.rpc.mockResolvedValueOnce({ data: 480, error: null });
    expect(await store.settleWallet("h1", 480, 2.4)).toBe(480);
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_settle", { p_hold: "h1", p_charge: 480, p_cost_thb: 2.4 });
  });

  it("throws what the database said", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(store.releaseWallet("h1")).rejects.toThrow("boom");
  });
});

describe("crediting a top-up", () => {
  it("passes Stripe's session, the agent and the amount paid", async () => {
    db.rpc.mockResolvedValueOnce({ data: "credited", error: null });
    expect(await store.creditTopUp("cs_1", "a1", 10000)).toBe("credited");
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_credit_topup", { p_session: "cs_1", p_agent: "a1", p_amount: 10000, p_payment_intent: null });
  });

  it("keeps the PaymentIntent with it when Stripe sent one", async () => {
    db.rpc.mockResolvedValueOnce({ data: "credited", error: null });
    await store.creditTopUp("cs_1", "a1", 10000, "pi_1");
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_credit_topup", { p_session: "cs_1", p_agent: "a1", p_amount: 10000, p_payment_intent: "pi_1" });
  });
});

describe("taking back a refund or a dispute", () => {
  it("passes the payment, the kind, the reference and the amount, and reads the answer", async () => {
    db.rpc.mockResolvedValueOnce({ data: { result: "clawed", agent: "a1", claimed: 4000, debited: "1500", shortfall: 2500 }, error: null });
    expect(await store.clawBack({ paymentIntent: "pi_1", kind: "refund", ref: "ch_1", satang: 4000, note: "คืนเงิน" }))
      .toEqual({ result: "clawed", agentId: "a1", claimedSatang: 4000, debitedSatang: 1500, shortfallSatang: 2500 });
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_clawback", { p_payment_intent: "pi_1", p_kind: "refund", p_ref: "ch_1", p_amount: 4000, p_note: "คืนเงิน" });
  });

  it("reads anything it does not know as unknown, never as taken", async () => {
    db.rpc.mockResolvedValueOnce({ data: { result: "something" }, error: null });
    expect(await store.clawBack({ paymentIntent: "pi_1", kind: "dispute", ref: "dp_1", satang: 1, note: "x" })).toMatchObject({ result: "unknown" });
  });

  it("throws what the database said", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(store.clawBack({ paymentIntent: "pi_1", kind: "refund", ref: "ch_1", satang: 1, note: "x" })).rejects.toThrow("boom");
  });
});

describe("unfreezing", () => {
  it("gives back the shortfall let go, or null when the wallet was not frozen", async () => {
    db.rpc.mockResolvedValueOnce({ data: "2500", error: null });
    expect(await store.unfreezeWallet("a1", "ชำระส่วนที่ขาดแล้ว")).toBe(2500);
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_unfreeze", { p_agent: "a1", p_note: "ชำระส่วนที่ขาดแล้ว" });
    db.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await store.unfreezeWallet("a1", "x")).toBeNull();
  });
});

describe("handing back a free round", () => {
  it("renames its line through ins_return_free_round", async () => {
    db.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await store.returnFreeRound(41)).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("ins_return_free_round", { p_id: 41 });
  });
});

describe("walletChargedThb", () => {
  it("is what agents paid for this month, as a number", async () => {
    db.rpc.mockResolvedValueOnce({ data: "4.25", error: null });
    expect(await store.walletChargedThb(new Date("2026-09-01T00:00:00+07:00"))).toBe(4.25);
  });

  it("is 0 when it cannot be read: the ceiling then counts agents' rounds too, and stops sooner, never later", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "no such function" } });
    expect(await store.walletChargedThb(new Date())).toBe(0);
  });
});

describe("balanceSatang", () => {
  it("sweeps dead holds first, then reads the balance; no wallet is ฿0", async () => {
    expect(await store.balanceSatang("a1")).toBe(0);
    expect(db.rpc).toHaveBeenCalledWith("ins_wallet_sweep_holds");
    db.wallet = { data: { balance_satang: "8420" }, error: null };
    expect(await store.balanceSatang("a1")).toBe(8420);
  });
});

describe("walletStatus and walletFrozen", () => {
  it("say whether a refund or a dispute froze the wallet", async () => {
    db.wallet = { data: { balance_satang: "300", frozen_at: "2026-10-01T03:00:00Z" }, error: null };
    expect(await store.walletStatus("a1")).toEqual({ satang: 300, frozen: true });
    expect(await store.walletFrozen("a1")).toBe(true);
    db.wallet = { data: { balance_satang: 300, frozen_at: null }, error: null };
    expect(await store.walletFrozen("a1")).toBe(false);
  });

  it("walletFrozen is false when it cannot be read: only the words of a refusal hang on it", async () => {
    db.wallet = { data: null, error: { message: "down" } };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await store.walletFrozen("a1")).toBe(false);
    err.mockRestore();
  });
});

describe("walletView", () => {
  it("is null while the owner has the wallet off", async () => {
    expect(await store.walletView("a1")).toBeNull();
  });

  it("is the balance and the multiplier while it is on", async () => {
    db.settings = { data: { wallet_enabled: true, wallet_multiplier: 2 }, error: null };
    db.wallet = { data: { balance_satang: 5000 }, error: null };
    expect(await store.walletView("a1")).toEqual({ satang: 5000, multiplier: 2 });
  });

  it("is null while a refund or a dispute has the wallet frozen: it pays for nothing then", async () => {
    db.settings = { data: { wallet_enabled: true, wallet_multiplier: 2 }, error: null };
    db.wallet = { data: { balance_satang: 5000, frozen_at: "2026-10-01T03:00:00Z" }, error: null };
    expect(await store.walletView("a1")).toBeNull();
  });

  it("is null when anything cannot be read: the page then shows the free rounds only", async () => {
    db.settings = { data: null, error: { message: "down" } };
    expect(await store.walletView("a1")).toBeNull();
  });
});
