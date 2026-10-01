import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Starting a top-up: only the five amounts, only an agent, only while the owner has it on. */

const AGENT: Viewer = {
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "2", name: "ตัวแทน", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: true, staff: null,
};
const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
const wallet = vi.hoisted(() => ({
  walletSettings: vi.fn(), openTopUp: vi.fn(), topUpState: vi.fn(), balanceSatang: vi.fn(), walletFrozen: vi.fn(),
}));
vi.mock("@/lib/wallet/store", () => wallet);
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ stripe: () => ({ checkout: { sessions: { create } } }) }));
vi.mock("@/lib/site-url", () => ({ siteOrigin: () => "https://x.test" }));

const { startTopUp, topUpStatus } = await import("@/app/studio/wallet/actions");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = AGENT;
  wallet.walletSettings.mockResolvedValue({ enabled: true, multiplier: 2 });
  wallet.openTopUp.mockResolvedValue(undefined);
  wallet.walletFrozen.mockResolvedValue(false);
  create.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" });
});

describe("startTopUp", () => {
  it("opens a Checkout Session and remembers it for the agent", async () => {
    expect(await startTopUp(100)).toEqual({ ok: true, url: "https://checkout.stripe.com/c/cs_test_1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: AGENT.agentId, success_url: "https://x.test/studio/wallet?paid={CHECKOUT_SESSION_ID}" }));
    expect(wallet.openTopUp).toHaveBeenCalledWith("cs_test_1", AGENT.agentId, 10000);
  });

  it("refuses any amount but the five, and asks Stripe nothing", async () => {
    for (const v of [1, 49.5, 1000, "500", null]) expect(await startTopUp(v)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses while the owner has the wallet off", async () => {
    wallet.walletSettings.mockResolvedValueOnce({ enabled: false, multiplier: 2 });
    expect(await startTopUp(100)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses while a refund or a dispute has the wallet frozen, and asks Stripe nothing (owner, 2026-10-01)", async () => {
    wallet.walletFrozen.mockResolvedValueOnce(true);
    const r = await startTopUp(100);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/ติดต่อสำนักงาน/);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses staff, who write without a wallet", async () => {
    who.viewer = { ...AGENT, staff: { owner: false, publish: true, connect: false, admin: false } };
    expect(await startTopUp(100)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("says so in Thai when Stripe refuses", async () => {
    create.mockRejectedValueOnce(new Error("No valid payment method types"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await startTopUp(50)).toEqual({ ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
    err.mockRestore();
  });
});

describe("topUpStatus", () => {
  it("reads the asker's own top-up and their balance", async () => {
    wallet.topUpState.mockResolvedValueOnce("paid");
    wallet.balanceSatang.mockResolvedValueOnce(10000);
    expect(await topUpStatus("cs_test_1")).toEqual({ status: "paid", balanceSatang: 10000 });
    expect(wallet.topUpState).toHaveBeenCalledWith("cs_test_1", AGENT.agentId);
  });

  it("does not look up a session id that is not one", async () => {
    expect(await topUpStatus("'; drop table")).toEqual({ status: null, balanceSatang: 0 });
    expect(wallet.topUpState).not.toHaveBeenCalled();
  });
});
