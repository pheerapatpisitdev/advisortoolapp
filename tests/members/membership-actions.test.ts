import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";
import { DEFAULT_PASS_SETTINGS } from "@/lib/members/pass";

/**
 * Renewing a member's pass from /membership (owner, 2026-10-13): only an outside member, only
 * while the owner has the pass switched on, at the owner's price. Stripe and the database are
 * mocked; nothing here reaches either.
 */

const MEMBER: Viewer = {
  kind: "member", agentId: "00000000-0000-4000-8000-000000000003", code: "m@example.com", name: "สมาชิก",
  tenantId: null, tenantSlug: "", tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
};
const AGENT: Viewer = {
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "2", name: "ตัวแทน", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

const who = vi.hoisted(() => ({ viewer: null as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ requireMember: async () => who.viewer }));
const store = vi.hoisted(() => ({ passSettings: vi.fn(), passPaid: vi.fn() }));
vi.mock("@/lib/members/pass-store", () => store);
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ stripe: () => ({ checkout: { sessions: { create } } }) }));
vi.mock("@/lib/site-url", () => ({ siteOrigin: () => "https://x.test" }));

const { startPass, passConfirmed } = await import("@/app/membership/actions");
const { passCheckoutParams } = await import("@/lib/members/pass-checkout");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = MEMBER;
  store.passSettings.mockResolvedValue({ ...DEFAULT_PASS_SETTINGS, enabled: true, satang: 12900 });
  create.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" });
});

describe("startPass", () => {
  it("opens a Checkout Session for the member at the owner's price", async () => {
    expect(await startPass()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/cs_test_1" });
    expect(create).toHaveBeenCalledWith(passCheckoutParams({ memberId: MEMBER.agentId, satang: 12900, origin: "https://x.test" }));
  });

  it("refuses a UnitOS agent and asks Stripe nothing", async () => {
    who.viewer = AGENT;
    expect(await startPass()).toEqual({ ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปครับ" });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses while the owner has the pass switched off: members use the app free", async () => {
    store.passSettings.mockResolvedValueOnce({ ...DEFAULT_PASS_SETTINGS, enabled: false });
    expect(await startPass()).toEqual({ ok: false, error: "ตอนนี้สมาชิกใช้งานได้ฟรี ยังไม่ต้องต่ออายุครับ" });
    expect(create).not.toHaveBeenCalled();
  });

  it("says so in Thai when Stripe refuses", async () => {
    create.mockRejectedValueOnce(new Error("No valid payment method types"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await startPass()).toEqual({ ok: false, error: "เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
    err.mockRestore();
  });

  it("refuses rather than charging when the settings cannot be read", async () => {
    store.passSettings.mockRejectedValueOnce(new Error("down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await startPass()).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("passConfirmed", () => {
  it("turns away a malformed session id without asking the database", async () => {
    for (const v of ["", "cs_test_", "pi_123", "cs_test_1; drop", "cs_prod_abc", 42 as unknown as string]) {
      expect(await passConfirmed(v)).toBe(false);
    }
    expect(store.passPaid).not.toHaveBeenCalled();
  });

  it("asks whether this member's own session was paid", async () => {
    store.passPaid.mockResolvedValueOnce(true);
    expect(await passConfirmed("cs_live_a1B2")).toBe(true);
    expect(store.passPaid).toHaveBeenCalledWith("cs_live_a1B2", MEMBER.agentId);
  });
});
