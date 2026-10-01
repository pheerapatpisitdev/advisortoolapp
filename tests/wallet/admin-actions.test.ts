import { beforeEach, describe, expect, it, vi } from "vitest";

const staff = vi.hoisted(() => ({ requireStaff: vi.fn() }));
vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  staff.requireStaff.mockResolvedValue(OWNER);
  return { ...asOwner, requireStaff: staff.requireStaff };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const wallet = vi.hoisted(() => ({ saveWalletSettings: vi.fn(async () => {}), adjustWallet: vi.fn(), unfreezeWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { adjustAgentWallet, saveWallet, unfreezeAgentWallet } = await import("@/app/admin/wallet/actions");
const { OWNER } = await import("../helpers/signed-in");
const AGENT = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  staff.requireStaff.mockResolvedValue(OWNER);
});

describe("saveWallet", () => {
  it("saves the switch and the multiplier", async () => {
    expect(await saveWallet(true, "1.5")).toEqual({ ok: true });
    expect(wallet.saveWalletSettings).toHaveBeenCalledWith({ enabled: true, multiplier: 1.5 });
  });

  it("is open to an admin: the switch and the multiplier are not the owner's alone", async () => {
    await saveWallet(true, "2");
    expect(staff.requireStaff).toHaveBeenCalledWith("admin");
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

  it("asks for the owner, not just an admin, and moves nothing for anyone else", async () => {
    await adjustAgentWallet(AGENT, "20", "ของขวัญ");
    expect(staff.requireStaff).toHaveBeenCalledWith("owner");
    staff.requireStaff.mockRejectedValueOnce(new Error("ไม่มีสิทธิ์ใช้ส่วนนี้"));
    await expect(adjustAgentWallet(AGENT, "20", "ของขวัญ")).rejects.toThrow("ไม่มีสิทธิ์");
    expect(wallet.adjustWallet).toHaveBeenCalledTimes(1);
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

describe("unfreezeAgentWallet (owner, 2026-10-01)", () => {
  it("lifts the freeze with the owner's reason", async () => {
    wallet.unfreezeWallet.mockResolvedValueOnce(2500);
    expect(await unfreezeAgentWallet(AGENT, " ชำระส่วนที่ขาดแล้ว ")).toEqual({ ok: true });
    expect(wallet.unfreezeWallet).toHaveBeenCalledWith(AGENT, "ชำระส่วนที่ขาดแล้ว");
  });

  it("is the owner's alone, like an adjustment", async () => {
    wallet.unfreezeWallet.mockResolvedValueOnce(0);
    await unfreezeAgentWallet(AGENT, "x");
    expect(staff.requireStaff).toHaveBeenCalledWith("owner");
    staff.requireStaff.mockRejectedValueOnce(new Error("ไม่มีสิทธิ์ใช้ส่วนนี้"));
    await expect(unfreezeAgentWallet(AGENT, "x")).rejects.toThrow("ไม่มีสิทธิ์");
    expect(wallet.unfreezeWallet).toHaveBeenCalledTimes(1);
  });

  it("needs a reason and a real id", async () => {
    expect(await unfreezeAgentWallet(AGENT, "  ")).toMatchObject({ ok: false });
    expect(await unfreezeAgentWallet("x", "เหตุผล")).toMatchObject({ ok: false });
    expect(wallet.unfreezeWallet).not.toHaveBeenCalled();
  });

  it("says so when the wallet was not frozen", async () => {
    wallet.unfreezeWallet.mockResolvedValueOnce(null);
    expect(await unfreezeAgentWallet(AGENT, "เหตุผล")).toEqual({ ok: false, error: "กระเป๋านี้ไม่ได้ถูกพักอยู่" });
  });
});
