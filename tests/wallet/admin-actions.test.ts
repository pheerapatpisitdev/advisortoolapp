import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const wallet = vi.hoisted(() => ({ saveWalletSettings: vi.fn(async () => {}), adjustWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { adjustAgentWallet, saveWallet } = await import("@/app/admin/wallet/actions");
const { OWNER } = await import("../helpers/signed-in");
const AGENT = "00000000-0000-4000-8000-000000000002";

beforeEach(() => vi.clearAllMocks());

describe("saveWallet", () => {
  it("saves the switch and the multiplier", async () => {
    expect(await saveWallet(true, "1.5")).toEqual({ ok: true });
    expect(wallet.saveWalletSettings).toHaveBeenCalledWith({ enabled: true, multiplier: 1.5 });
  });

  it("refuses a multiplier out of range and saves nothing", async () => {
    expect(await saveWallet(true, "0.5")).toMatchObject({ ok: false });
    expect(wallet.saveWalletSettings).not.toHaveBeenCalled();
  });
});

describe("adjustAgentWallet", () => {
  it("moves the balance with the owner's name on it", async () => {
    wallet.adjustWallet.mockResolvedValueOnce(7000);
    expect(await adjustAgentWallet(AGENT, "20", "ของขวัญ")).toEqual({ ok: true });
    expect(wallet.adjustWallet).toHaveBeenCalledWith(AGENT, 2000, "ของขวัญ", OWNER.agentId);
  });

  it("says so when it would take the balance below zero", async () => {
    wallet.adjustWallet.mockResolvedValueOnce(null);
    expect(await adjustAgentWallet(AGENT, "-999", "คืนเงิน")).toEqual({ ok: false, error: "หักเกินยอดที่มีในกระเป๋า" });
  });

  it("refuses an agent id that is not one", async () => {
    expect(await adjustAgentWallet("x", "20", "a")).toMatchObject({ ok: false });
    expect(wallet.adjustWallet).not.toHaveBeenCalled();
  });
});
