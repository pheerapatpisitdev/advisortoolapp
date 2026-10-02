import { beforeEach, describe, expect, it, vi } from "vitest";

/** A round settled after the answer went back: a clip's render, collected by a poll or a webhook. */

const w = vi.hoisted(() => ({ settleWallet: vi.fn(async () => 100), releaseWallet: vi.fn(async () => undefined), returnFreeRound: vi.fn(async () => true) }));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/store")>()), ...w }));
const { settleLater } = await import("@/lib/wallet/round");
beforeEach(() => vi.clearAllMocks());

describe("settleLater", () => {
  it("charges a delivered wallet round its cost times the multiplier, never past the hold", async () => {
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, true, 0.9);
    expect(w.settleWallet).toHaveBeenCalledWith("h", 180, 0.9);
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, true, 9);
    expect(w.settleWallet).toHaveBeenLastCalledWith("h", 600, 9);
    expect(w.releaseWallet).not.toHaveBeenCalled();
  });
  it("hands a failed wallet round's hold back, and a failed free round back to the count", async () => {
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, false, 0);
    expect(w.releaseWallet).toHaveBeenCalledWith("h");
    await settleLater({ paidBy: "free", auditId: 7 }, false, 0);
    expect(w.returnFreeRound).toHaveBeenCalledWith(7);
    expect(w.settleWallet).not.toHaveBeenCalled();
  });
  it("does nothing for staff, or for a free round that delivered", async () => {
    await settleLater({ paidBy: "staff" }, true, 1);
    await settleLater({ paidBy: "free", auditId: 7 }, true, 1);
    expect(w.settleWallet).not.toHaveBeenCalled();
    expect(w.returnFreeRound).not.toHaveBeenCalled();
  });
  it("logs, by the hold's id only, a delivered round whose hold was already gone (final review, 2026-10-02)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    w.settleWallet.mockResolvedValueOnce(null as unknown as number);
    await expect(settleLater({ paidBy: "wallet", holdId: "h-gone", heldSatang: 600, multiplier: 2 }, true, 0.9)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain("h-gone");
    expect(String(err.mock.calls[0][0])).toMatch(/not charged/);
    // a hold that was there says nothing
    err.mockClear();
    await settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, true, 0.9);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
  it("logs a settle that fails instead of throwing: the hold is swept back to the agent", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    w.settleWallet.mockRejectedValueOnce(new Error("db down"));
    await expect(settleLater({ paidBy: "wallet", holdId: "h", heldSatang: 600, multiplier: 2 }, true, 0.9)).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
