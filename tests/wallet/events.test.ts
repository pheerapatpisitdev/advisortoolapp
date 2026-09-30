import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ creditTopUp: vi.fn(), markTopUp: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);

const { actionFor, applyWalletAction } = await import("@/lib/wallet/events");

const AGENT = "00000000-0000-4000-8000-000000000002";
const session = (over: object = {}) => ({
  id: "cs_test_1", object: "checkout.session", mode: "payment", currency: "thb", amount_total: 10000,
  payment_status: "paid", client_reference_id: AGENT, ...over,
});
const ev = (type: string, obj: object) => ({ type, data: { object: obj } });

beforeEach(() => vi.clearAllMocks());

describe("what a Stripe event does to a wallet", () => {
  it("credits a completed session that is paid, with what Stripe charged", () => {
    expect(actionFor(ev("checkout.session.completed", session())))
      .toEqual({ kind: "credit", sessionId: "cs_test_1", agentId: AGENT, satang: 10000 });
  });

  it("waits on a completed session not paid yet — a PromptPay QR still being scanned", () => {
    expect(actionFor(ev("checkout.session.completed", session({ payment_status: "unpaid" })))).toMatchObject({ kind: "ignore" });
  });

  it("credits the async success of a delayed payment", () => {
    expect(actionFor(ev("checkout.session.async_payment_succeeded", session()))).toMatchObject({ kind: "credit" });
  });

  it("marks a failed or expired session", () => {
    expect(actionFor(ev("checkout.session.async_payment_failed", session({ payment_status: "unpaid" }))))
      .toEqual({ kind: "mark", sessionId: "cs_test_1", status: "failed" });
    expect(actionFor(ev("checkout.session.expired", session({ payment_status: "unpaid" }))))
      .toEqual({ kind: "mark", sessionId: "cs_test_1", status: "expired" });
  });

  it("credits nothing in another currency, without an agent, or for no money", () => {
    expect(actionFor(ev("checkout.session.completed", session({ currency: "usd" })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ client_reference_id: null })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ client_reference_id: "not-a-uuid" })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ amount_total: 0 })))).toMatchObject({ kind: "ignore" });
    expect(actionFor(ev("checkout.session.completed", session({ mode: "subscription" })))).toMatchObject({ kind: "ignore" });
  });

  it("ignores every other event", () => {
    expect(actionFor(ev("payment_intent.succeeded", {}))).toMatchObject({ kind: "ignore" });
  });
});

describe("applying it", () => {
  it("credits through the locked function, and says a repeat was a repeat", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("credited").mockResolvedValueOnce("duplicate");
    const credit = { kind: "credit" as const, sessionId: "cs_test_1", agentId: AGENT, satang: 10000 };
    expect(await applyWalletAction(credit)).toBe("credited");
    expect(await applyWalletAction(credit)).toBe("duplicate");
    expect(wallet.creditTopUp).toHaveBeenCalledWith("cs_test_1", AGENT, 10000);
  });

  it("logs a session nobody opened here and credits nothing", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("unknown");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction({ kind: "credit", sessionId: "cs_x", agentId: AGENT, satang: 1 })).toBe("unknown");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("marks, and ignores", async () => {
    expect(await applyWalletAction({ kind: "mark", sessionId: "cs_test_1", status: "expired" })).toBe("expired");
    expect(wallet.markTopUp).toHaveBeenCalledWith("cs_test_1", "expired");
    expect(await applyWalletAction({ kind: "ignore", why: "x" })).toBe("ignored");
  });
});
