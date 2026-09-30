import { creditTopUp, markTopUp } from "./store";

/**
 * What a Stripe event means for a wallet. Money is added here and nowhere else: when Stripe
 * says a Checkout Session is paid — on checkout.session.completed for a card, and on
 * async_payment_succeeded for a payment that settles later. The amount is what Stripe
 * charged (amount_total), never the metadata.
 */

export type WalletAction =
  | { kind: "credit"; sessionId: string; agentId: string; satang: number }
  | { kind: "mark"; sessionId: string; status: "failed" | "expired" }
  | { kind: "ignore"; why: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionLike {
  id?: unknown; mode?: unknown; currency?: unknown; amount_total?: unknown; payment_status?: unknown; client_reference_id?: unknown;
}

export function actionFor(event: { type: string; data: { object: unknown } }): WalletAction {
  const s = (event.data?.object ?? {}) as SessionLike;
  const sessionId = typeof s.id === "string" ? s.id : "";
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (s.payment_status !== "paid") return { kind: "ignore", why: `not paid yet (${String(s.payment_status)})` };
      if (s.mode !== "payment") return { kind: "ignore", why: `mode ${String(s.mode)}` };
      if (s.currency !== "thb") return { kind: "ignore", why: `currency ${String(s.currency)}` };
      if (typeof s.client_reference_id !== "string" || !UUID.test(s.client_reference_id)) return { kind: "ignore", why: "no agent" };
      if (typeof s.amount_total !== "number" || !Number.isInteger(s.amount_total) || s.amount_total <= 0) return { kind: "ignore", why: "no amount" };
      if (!sessionId) return { kind: "ignore", why: "no session id" };
      return { kind: "credit", sessionId, agentId: s.client_reference_id, satang: s.amount_total };
    }
    case "checkout.session.async_payment_failed":
      return sessionId ? { kind: "mark", sessionId, status: "failed" } : { kind: "ignore", why: "no session id" };
    case "checkout.session.expired":
      return sessionId ? { kind: "mark", sessionId, status: "expired" } : { kind: "ignore", why: "no session id" };
    default:
      return { kind: "ignore", why: event.type };
  }
}

/** Throws only when the database does: the webhook then answers 500 and Stripe sends it again. */
export async function applyWalletAction(a: WalletAction): Promise<string> {
  if (a.kind === "ignore") return "ignored";
  if (a.kind === "mark") {
    await markTopUp(a.sessionId, a.status);
    return a.status;
  }
  const r = await creditTopUp(a.sessionId, a.agentId, a.satang);
  // paid at Stripe, but not a top-up opened here for this agent: a person must look
  if (r === "unknown") console.error(`stripe session ${a.sessionId} paid for agent ${a.agentId}, but no top-up of theirs was opened here`);
  return r;
}
