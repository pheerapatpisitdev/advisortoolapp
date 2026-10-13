import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({ creditTopUp: vi.fn(), markTopUp: vi.fn(), clawBack: vi.fn(), linkPaymentIntent: vi.fn(), topUpStatus: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);
const pass = vi.hoisted(() => ({ addPaidPass: vi.fn(), revokePaidPass: vi.fn() }));
vi.mock("@/lib/members/pass-store", () => pass);
const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ stripe: () => ({ checkout: { sessions: { list } } }) }));

const { actionFor, applyWalletAction } = await import("@/lib/wallet/events");

const AGENT = "00000000-0000-4000-8000-000000000002";
const session = (over: object = {}) => ({
  id: "cs_test_1", object: "checkout.session", mode: "payment", currency: "thb", amount_total: 10000,
  payment_status: "paid", client_reference_id: AGENT, ...over,
});
const ev = (type: string, obj: object) => ({ type, data: { object: obj } });

const charge = (over: object = {}) => ({
  id: "ch_1", object: "charge", currency: "thb", amount: 10000, amount_refunded: 10000, payment_intent: "pi_1", refunded: true, ...over,
});
const dispute = (over: object = {}) => ({
  id: "dp_1", object: "dispute", currency: "thb", amount: 10000, charge: "ch_1", payment_intent: "pi_1", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // a refund looks for a pass first; most refunds are of top-ups, where it finds none
  pass.revokePaidPass.mockReset().mockResolvedValue("unknown");
});

describe("what a Stripe event does to a wallet", () => {
  it("credits a completed session that is paid, with what Stripe charged", () => {
    expect(actionFor(ev("checkout.session.completed", session())))
      .toEqual({ kind: "credit", sessionId: "cs_test_1", agentId: AGENT, satang: 10000, paymentIntent: null });
  });

  it("keeps the payment's PaymentIntent with the credit, so a refund of it can find the top-up", () => {
    expect(actionFor(ev("checkout.session.completed", session({ payment_intent: "pi_1" })))).toMatchObject({ kind: "credit", paymentIntent: "pi_1" });
    expect(actionFor(ev("checkout.session.completed", session({ payment_intent: { id: "pi_2" } })))).toMatchObject({ paymentIntent: "pi_2" });
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

  it("says aloud when a paid session is not credited, and quietly when it is not paid yet (review, 2026-10-01)", () => {
    for (const over of [{ currency: "usd" }, { client_reference_id: null }, { amount_total: 0 }, { mode: "subscription" }, { id: null }]) {
      expect(actionFor(ev("checkout.session.completed", session(over)))).toMatchObject({ kind: "ignore", loud: true });
    }
    expect(actionFor(ev("checkout.session.completed", session({ payment_status: "unpaid" })))).not.toHaveProperty("loud");
  });

  it("takes back a refund: the charge's refunded total, keyed to its PaymentIntent and charge", () => {
    expect(actionFor(ev("charge.refunded", charge({ amount_refunded: 4000 })))).toMatchObject({
      kind: "clawback", reason: "refund", paymentIntent: "pi_1", ref: "ch_1", satang: 4000,
    });
  });

  it("takes back a dispute's amount, keyed to the dispute", () => {
    expect(actionFor(ev("charge.dispute.created", dispute({ amount: 5000 })))).toMatchObject({
      kind: "clawback", reason: "dispute", paymentIntent: "pi_1", ref: "dp_1", satang: 5000,
    });
  });

  it("says aloud a refund or a dispute it cannot read", () => {
    expect(actionFor(ev("charge.refunded", charge({ payment_intent: null })))).toMatchObject({ kind: "ignore", loud: true });
    expect(actionFor(ev("charge.refunded", charge({ currency: "usd" })))).toMatchObject({ kind: "ignore", loud: true });
    expect(actionFor(ev("charge.refunded", charge({ amount_refunded: 0 })))).toMatchObject({ kind: "ignore", loud: true });
    expect(actionFor(ev("charge.dispute.created", dispute({ amount: "5000" })))).toMatchObject({ kind: "ignore", loud: true });
  });

  it("ignores every other event", () => {
    expect(actionFor(ev("payment_intent.succeeded", {}))).toMatchObject({ kind: "ignore" });
  });
});

describe("applying it", () => {
  it("credits through the locked function, and says a repeat was a repeat", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("credited").mockResolvedValueOnce("duplicate");
    const credit = { kind: "credit" as const, sessionId: "cs_test_1", agentId: AGENT, satang: 10000, paymentIntent: null };
    expect(await applyWalletAction(credit)).toBe("credited");
    expect(await applyWalletAction(credit)).toBe("duplicate");
    expect(wallet.creditTopUp).toHaveBeenCalledWith("cs_test_1", AGENT, 10000, null);
  });

  it("logs a session nobody opened here and credits nothing", async () => {
    wallet.creditTopUp.mockResolvedValueOnce("unknown");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction({ kind: "credit", sessionId: "cs_x", agentId: AGENT, satang: 1, paymentIntent: "pi_9" })).toBe("unknown");
    expect(wallet.creditTopUp).toHaveBeenCalledWith("cs_x", AGENT, 1, "pi_9");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("marks, and ignores", async () => {
    expect(await applyWalletAction({ kind: "mark", sessionId: "cs_test_1", status: "expired" })).toBe("expired");
    expect(wallet.markTopUp).toHaveBeenCalledWith("cs_test_1", "expired");
    expect(await applyWalletAction({ kind: "ignore", why: "x" })).toBe("ignored");
  });
});

describe("taking a refund or a dispute back (owner, 2026-10-01)", () => {
  const refund = { kind: "clawback" as const, reason: "refund" as const, paymentIntent: "pi_1", ref: "ch_1", satang: 4000, note: "คืนเงิน" };

  it("takes it back through the locked function and says the wallet was frozen", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "clawed", agentId: AGENT, claimedSatang: 4000, debitedSatang: 1500, shortfallSatang: 2500 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("clawed");
    expect(wallet.clawBack).toHaveBeenCalledWith({ paymentIntent: "pi_1", kind: "refund", ref: "ch_1", satang: 4000, note: "คืนเงิน" });
    expect(warn.mock.calls[0][0]).toContain("frozen");
    warn.mockRestore();
    expect(list).not.toHaveBeenCalled();
  });

  it("says a repeat was a repeat, asking Stripe nothing", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "duplicate", agentId: AGENT });
    expect(await applyWalletAction(refund)).toBe("duplicate");
    expect(list).not.toHaveBeenCalled();
  });

  it("finds a top-up paid before its PaymentIntent was kept through Stripe, writes it down, and tries again", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" }).mockResolvedValueOnce({ result: "clawed", agentId: AGENT });
    list.mockResolvedValueOnce({ data: [{ id: "cs_old", mode: "payment" }] });
    wallet.linkPaymentIntent.mockResolvedValueOnce(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("clawed");
    warn.mockRestore();
    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
    expect(wallet.linkPaymentIntent).toHaveBeenCalledWith("cs_old", "pi_1");
    expect(wallet.clawBack).toHaveBeenCalledTimes(2);
  });

  it("throws a refund that came before its credit, so Stripe sends it again (review, 2026-10-11)", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" });
    list.mockResolvedValueOnce({ data: [{ id: "cs_new", mode: "payment" }] });
    wallet.linkPaymentIntent.mockResolvedValueOnce(false);
    wallet.topUpStatus.mockResolvedValueOnce("open");
    await expect(applyWalletAction(refund)).rejects.toThrow(/before the credit of cs_new/);
  });

  it("does not hold up a refund whose top-up is settled some other way", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" });
    list.mockResolvedValueOnce({ data: [{ id: "cs_gone", mode: "payment" }] });
    wallet.linkPaymentIntent.mockResolvedValueOnce(false);
    wallet.topUpStatus.mockResolvedValueOnce("expired");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("unknown");
    err.mockRestore();
  });

  it("logs loudly, and takes nothing, when Stripe will not say (a restricted key) or the top-up is not ours", async () => {
    wallet.clawBack.mockResolvedValue({ result: "unknown" });
    list.mockRejectedValueOnce(new Error("The provided key does not have the required permissions"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("unknown");
    expect(err.mock.calls.some((c) => String(c[0]).includes("NOT TAKEN BACK"))).toBe(true);
    expect(wallet.linkPaymentIntent).not.toHaveBeenCalled();
    list.mockResolvedValueOnce({ data: [] });
    expect(await applyWalletAction(refund)).toBe("unknown");
    err.mockRestore();
    wallet.clawBack.mockReset();
  });

  it("throws when the database does, so Stripe sends the event again", async () => {
    wallet.clawBack.mockRejectedValueOnce(new Error("db down"));
    await expect(applyWalletAction(refund)).rejects.toThrow("db down");
  });

  it("logs a loud ignore and moves nothing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction({ kind: "ignore", why: "paid session cs_1: currency usd", loud: true })).toBe("ignored");
    expect(err).toHaveBeenCalledTimes(1);
    expect(await applyWalletAction({ kind: "ignore", why: "payment_intent.succeeded" })).toBe("ignored");
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});

describe("a member pass bought through Stripe (owner, 2026-10-13)", () => {
  const MEMBER = "00000000-0000-4000-8000-000000000003";
  const passSession = (over: object = {}) => session({ client_reference_id: MEMBER, amount_total: 9900, metadata: { purpose: "member_pass", member_id: MEMBER }, ...over });

  it("reads a paid pass session as a pass, with what Stripe charged", () => {
    expect(actionFor(ev("checkout.session.completed", passSession({ payment_intent: "pi_p" }))))
      .toEqual({ kind: "pass", sessionId: "cs_test_1", memberId: MEMBER, satang: 9900, paymentIntent: "pi_p" });
    expect(actionFor(ev("checkout.session.async_payment_succeeded", passSession()))).toMatchObject({ kind: "pass", paymentIntent: null });
  });

  it("keeps a session without the pass purpose a top-up, however its metadata looks", () => {
    expect(actionFor(ev("checkout.session.completed", session()))).toMatchObject({ kind: "credit" });
    for (const metadata of [null, "member_pass", { purpose: "other" }, { agent_id: AGENT, amount_satang: "10000" }]) {
      expect(actionFor(ev("checkout.session.completed", session({ metadata })))).toMatchObject({ kind: "credit" });
    }
  });

  it("waits, quietly, on a pass not paid yet", () => {
    const a = actionFor(ev("checkout.session.completed", passSession({ payment_status: "unpaid" })));
    expect(a).toMatchObject({ kind: "ignore" });
    expect(a).not.toHaveProperty("loud");
  });

  it("says aloud a paid pass it cannot credit", () => {
    for (const over of [{ currency: "usd" }, { client_reference_id: null }, { client_reference_id: "x" }, { amount_total: 0 }, { mode: "subscription" }, { id: null }]) {
      const a = actionFor(ev("checkout.session.completed", passSession(over)));
      expect(a).toMatchObject({ kind: "ignore", loud: true });
      expect((a as { why: string }).why).toContain("pass");
    }
  });

  it("adds the pass once; Stripe sending it again is a repeat (Review Focus 2)", async () => {
    pass.addPaidPass.mockResolvedValueOnce("added").mockResolvedValueOnce("duplicate");
    const a = { kind: "pass" as const, sessionId: "cs_p", memberId: MEMBER, satang: 9900, paymentIntent: "pi_p" };
    expect(await applyWalletAction(a)).toBe("added");
    expect(await applyWalletAction(a)).toBe("duplicate");
    expect(pass.addPaidPass).toHaveBeenCalledWith({ sessionId: "cs_p", memberId: MEMBER, satang: 9900, paymentIntent: "pi_p" });
    expect(pass.addPaidPass).toHaveBeenCalledTimes(2);
    expect(wallet.creditTopUp).not.toHaveBeenCalled();
  });

  it("says aloud a pass paid for a member who is not here", async () => {
    pass.addPaidPass.mockResolvedValueOnce("unknown");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyWalletAction({ kind: "pass", sessionId: "cs_p", memberId: MEMBER, satang: 9900, paymentIntent: null })).toBe("unknown");
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain(MEMBER);
    err.mockRestore();
  });

  it("throws when the database does, so Stripe sends the pass again", async () => {
    pass.addPaidPass.mockRejectedValueOnce(new Error("db down"));
    await expect(applyWalletAction({ kind: "pass", sessionId: "cs_p", memberId: MEMBER, satang: 9900, paymentIntent: null })).rejects.toThrow("db down");
  });

  const refund = { kind: "clawback" as const, reason: "refund" as const, paymentIntent: "pi_p", ref: "ch_p", satang: 9900, note: "คืนเงิน" };

  it("takes a refunded pass back and leaves the wallets alone", async () => {
    pass.revokePaidPass.mockResolvedValueOnce("revoked").mockResolvedValueOnce("duplicate");
    expect(await applyWalletAction(refund)).toBe("pass-revoked");
    expect(pass.revokePaidPass).toHaveBeenCalledWith({ paymentIntent: "pi_p", reason: "refund", ref: "ch_p" });
    expect(await applyWalletAction(refund)).toBe("pass-duplicate");
    expect(wallet.clawBack).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("takes a disputed pass back the same way", async () => {
    pass.revokePaidPass.mockResolvedValueOnce("revoked");
    expect(await applyWalletAction({ ...refund, reason: "dispute", ref: "dp_p" })).toBe("pass-revoked");
    expect(pass.revokePaidPass).toHaveBeenCalledWith({ paymentIntent: "pi_p", reason: "dispute", ref: "dp_p" });
    expect(wallet.clawBack).not.toHaveBeenCalled();
  });

  it("still claws a top-up's refund back when no pass has that payment (Review Focus 3)", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "clawed", agentId: AGENT, claimedSatang: 9900, debitedSatang: 9900, shortfallSatang: 0 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("clawed");
    warn.mockRestore();
    expect(pass.revokePaidPass).toHaveBeenCalledTimes(1);
    expect(wallet.clawBack).toHaveBeenCalledWith({ paymentIntent: "pi_p", kind: "refund", ref: "ch_p", satang: 9900, note: "คืนเงิน" });
  });

  it("throws a pass's refund that came before its pass, so Stripe sends it again (review, 2026-10-13)", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" });
    list.mockResolvedValueOnce({ data: [{ id: "cs_pass", mode: "payment", metadata: { purpose: "member_pass", member_id: MEMBER } }] });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(applyWalletAction(refund)).rejects.toThrow(/before the pass of cs_pass/);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
    expect(list).toHaveBeenCalledWith({ payment_intent: "pi_p", limit: 1 });
    expect(wallet.linkPaymentIntent).not.toHaveBeenCalled();
    expect(wallet.topUpStatus).not.toHaveBeenCalled();
  });

  it("still holds a top-up's refund that came before its credit, through the open top-up", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" });
    list.mockResolvedValueOnce({ data: [{ id: "cs_new", mode: "payment", metadata: { agent_id: AGENT, amount_satang: "9900" } }] });
    wallet.linkPaymentIntent.mockResolvedValueOnce(false);
    wallet.topUpStatus.mockResolvedValueOnce("open");
    await expect(applyWalletAction(refund)).rejects.toThrow(/before the credit of cs_new/);
    expect(wallet.linkPaymentIntent).toHaveBeenCalledWith("cs_new", "pi_p");
  });

  it("still links an old top-up's session that has no metadata, and claws it back", async () => {
    wallet.clawBack.mockResolvedValueOnce({ result: "unknown" }).mockResolvedValueOnce({ result: "clawed", agentId: AGENT });
    list.mockResolvedValueOnce({ data: [{ id: "cs_old", mode: "payment" }] });
    wallet.linkPaymentIntent.mockResolvedValueOnce(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await applyWalletAction(refund)).toBe("clawed");
    warn.mockRestore();
    expect(wallet.linkPaymentIntent).toHaveBeenCalledWith("cs_old", "pi_p");
    expect(wallet.clawBack).toHaveBeenCalledTimes(2);
  });

  it("throws when the pass lookup fails, touching no wallet, so Stripe sends the refund again", async () => {
    pass.revokePaidPass.mockRejectedValueOnce(new Error("db down"));
    await expect(applyWalletAction(refund)).rejects.toThrow("db down");
    expect(wallet.clawBack).not.toHaveBeenCalled();
  });
});
