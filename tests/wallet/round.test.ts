import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A wallet round is charged what its calls really cost, times the owner's multiplier — and
 * nothing when it gave the agent nothing.
 */

const wallet = vi.hoisted(() => ({ settleWallet: vi.fn(), releaseWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { delivered, inWalletRound, meterCost, payRound } = await import("@/lib/wallet/round");

const pass = { ok: true as const, paidBy: "wallet" as const, holdId: "h1", heldSatang: 1000, multiplier: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  wallet.settleWallet.mockResolvedValue(0);
  wallet.releaseWallet.mockResolvedValue(undefined);
});

describe("payRound on a wallet round", () => {
  it("charges the calls' real cost times the multiplier", async () => {
    const r = await payRound(pass, async () => {
      meterCost(0.61);
      meterCost(0.59);
      return { ok: true, items: [1] };
    });
    expect(r).toEqual({ ok: true, items: [1] });
    expect(wallet.settleWallet).toHaveBeenCalledWith("h1", 240, expect.closeTo(1.2, 9));
    expect(wallet.releaseWallet).not.toHaveBeenCalled();
  });

  it("warns once, with the hold and the cost, when the cost outgrew the hold, and charges the hold", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await payRound(pass, async () => {
      meterCost(3);
      meterCost(3);
      return { ok: true };
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("h1");
    expect(warn.mock.calls[0][0]).toContain("1200");
    expect(warn.mock.calls[0][0]).toContain("1000");
    expect(wallet.settleWallet).toHaveBeenCalledWith("h1", 1000, 6);
    warn.mockRestore();
  });

  it("says nothing when the cost fits the hold", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await payRound(pass, async () => {
      meterCost(5);
      return { ok: true };
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is a wallet round only inside the run", async () => {
    expect(inWalletRound()).toBe(false);
    await payRound(pass, async () => {
      expect(inWalletRound()).toBe(true);
      return { ok: true };
    });
    expect(inWalletRound()).toBe(false);
  });

  it("gives the whole hold back when the round throws, and throws on", async () => {
    await expect(payRound(pass, async () => {
      meterCost(1);
      throw new Error("model down");
    })).rejects.toThrow("model down");
    expect(wallet.releaseWallet).toHaveBeenCalledWith("h1");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });

  it("gives the whole hold back when the round gave nothing", async () => {
    await payRound(pass, async () => {
      meterCost(1);
      return { ok: false, error: "บันทึกไม่สำเร็จ" };
    });
    expect(wallet.releaseWallet).toHaveBeenCalledWith("h1");
    expect(wallet.settleWallet).not.toHaveBeenCalled();
  });

  it("charges a round that stopped part way but saved pieces", async () => {
    await payRound(pass, async () => {
      meterCost(0.5);
      return { ok: false, error: "บันทึกได้ 2 จาก 3 ชิ้น", items: [1, 2] };
    });
    expect(wallet.settleWallet).toHaveBeenCalledWith("h1", 100, 0.5);
  });

  it("still answers when settling fails: the hold is swept back later", async () => {
    wallet.settleWallet.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await payRound(pass, async () => ({ ok: true }))).toEqual({ ok: true });
    err.mockRestore();
  });

  it("keeps two rounds running at once on their own meters", async () => {
    await Promise.all([
      payRound({ ...pass, holdId: "a" }, async () => { meterCost(1); await new Promise((r) => setTimeout(r, 5)); meterCost(1); return { ok: true }; }),
      payRound({ ...pass, holdId: "b" }, async () => { meterCost(0.1); return { ok: true }; }),
    ]);
    expect(wallet.settleWallet).toHaveBeenCalledWith("a", 400, 2);
    expect(wallet.settleWallet).toHaveBeenCalledWith("b", 20, 0.1);
  });
});

describe("payRound on a free or staff round", () => {
  it("just runs it, touching no wallet", async () => {
    expect(await payRound({ ok: true, paidBy: "free" }, async () => {
      expect(inWalletRound()).toBe(false);
      meterCost(5);
      return { ok: true };
    })).toEqual({ ok: true });
    expect(wallet.settleWallet).not.toHaveBeenCalled();
    expect(wallet.releaseWallet).not.toHaveBeenCalled();
  });
});

describe("delivered", () => {
  it("is a round that went through, or saved something before it stopped", () => {
    expect(delivered({ ok: true })).toBe(true);
    expect(delivered({ ok: false, items: [1] })).toBe(true);
    expect(delivered({ ok: false })).toBe(false);
    expect(delivered({ ok: false, items: [] })).toBe(false);
  });
});
