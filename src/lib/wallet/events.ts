import { PASS_PURPOSE } from "@/lib/members/pass-checkout";
import { addPaidPass, linkPassPaymentIntent, revokePaidPass } from "@/lib/members/pass-store";
import { stripe } from "@/lib/stripe/client";
import { formatBaht } from "./money";
import { clawBack, creditTopUp, linkPaymentIntent, markTopUp, topUpStatus, type ClawbackKind } from "./store";

/**
 * What a Stripe event means for a wallet. Money is added here and nowhere else: when Stripe
 * says a Checkout Session is paid — on checkout.session.completed for a card, and on
 * async_payment_succeeded for a payment that settles later. The amount is what Stripe
 * charged (amount_total), never the metadata.
 *
 * And taken back here (owner, 2026-10-01): when a top-up's payment is refunded in Stripe
 * (charge.refunded, full or partial) or disputed by the payer's bank (charge.dispute.created),
 * the amount comes out of the wallet as far as its balance goes, the rest is written down as a
 * shortfall, and the wallet is frozen until the owner unfreezes it on /admin/wallet.
 *
 * A member's 30-day pass is bought through the same webhook (owner, 2026-10-13): a paid session
 * whose metadata says purpose "member_pass" adds a paid pass instead of crediting a wallet, and a
 * refund or dispute of that payment takes the pass back instead of touching a wallet.
 */

export type WalletAction =
  | { kind: "credit"; sessionId: string; agentId: string; satang: number; paymentIntent: string | null }
  | { kind: "pass"; sessionId: string; memberId: string; satang: number; paymentIntent: string | null }
  | { kind: "mark"; sessionId: string; status: "failed" | "expired" }
  | { kind: "clawback"; reason: ClawbackKind; paymentIntent: string; ref: string; satang: number; note: string }
  /** `loud`: money moved at Stripe and none moved here, so a person must look (review, 2026-10-01) */
  | { kind: "ignore"; why: string; loud?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionLike {
  id?: unknown; mode?: unknown; currency?: unknown; amount_total?: unknown; payment_status?: unknown; client_reference_id?: unknown;
  payment_intent?: unknown; metadata?: unknown;
}
interface ChargeLike { id?: unknown; currency?: unknown; amount_refunded?: unknown; payment_intent?: unknown }
interface DisputeLike { id?: unknown; currency?: unknown; amount?: unknown; payment_intent?: unknown; charge?: unknown }

/** an id Stripe sent as a string, or inside the object when it was expanded */
const idOf = (v: unknown): string | null =>
  typeof v === "string" && v ? v
    : v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" ? (v as { id: string }).id : null;

/** metadata is ours, but read as Stripe sent it: it may be missing or not an object */
const purposeOf = (metadata: unknown): unknown =>
  metadata && typeof metadata === "object" ? (metadata as { purpose?: unknown }).purpose : undefined;

const wholeSatang = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export function actionFor(event: { type: string; data: { object: unknown } }): WalletAction {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = obj as SessionLike;
      const sessionId = typeof s.id === "string" ? s.id : "";
      if (s.payment_status !== "paid") return { kind: "ignore", why: `not paid yet (${String(s.payment_status)})` };
      // a pass and a top-up are checked alike; only what the money buys differs
      const isPass = purposeOf(s.metadata) === PASS_PURPOSE;
      const what = isPass ? "pass" : "session";
      // paid from here on: anything that stops the credit is money taken and not given, said aloud
      const paidBut = (why: string): WalletAction => ({ kind: "ignore", why: `paid ${what} ${sessionId || "(no id)"}: ${why}`, loud: true });
      if (s.mode !== "payment") return paidBut(`mode ${String(s.mode)}`);
      if (s.currency !== "thb") return paidBut(`currency ${String(s.currency)}`);
      if (typeof s.client_reference_id !== "string" || !UUID.test(s.client_reference_id)) return paidBut(isPass ? "no member" : "no agent");
      if (typeof s.amount_total !== "number" || !Number.isInteger(s.amount_total) || s.amount_total <= 0) return paidBut("no amount");
      if (!sessionId) return paidBut("no session id");
      const paymentIntent = idOf(s.payment_intent);
      if (isPass) return { kind: "pass", sessionId, memberId: s.client_reference_id, satang: s.amount_total, paymentIntent };
      return { kind: "credit", sessionId, agentId: s.client_reference_id, satang: s.amount_total, paymentIntent };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const sessionId = idOf((obj as SessionLike).id);
      const status = event.type === "checkout.session.expired" ? "expired" : "failed";
      return sessionId ? { kind: "mark", sessionId, status } : { kind: "ignore", why: "no session id" };
    }
    case "charge.refunded": {
      // amount_refunded is the charge's refunded total so far; the database takes what is new of it
      const c = obj as ChargeLike;
      const chargeId = idOf(c.id);
      const paymentIntent = idOf(c.payment_intent);
      const loud = (why: string): WalletAction => ({ kind: "ignore", why: `refunded charge ${chargeId ?? "(no id)"}: ${why}`, loud: true });
      if (!chargeId) return loud("no charge id");
      if (!paymentIntent) return loud("no payment intent");
      if (c.currency !== "thb") return loud(`currency ${String(c.currency)}`);
      if (!wholeSatang(c.amount_refunded) || c.amount_refunded === 0) return loud(`amount_refunded ${String(c.amount_refunded)}`);
      return {
        kind: "clawback", reason: "refund", paymentIntent, ref: chargeId, satang: c.amount_refunded,
        note: `คืนเงินยอดเติมผ่าน Stripe รวม ${formatBaht(c.amount_refunded)}`,
      };
    }
    case "charge.dispute.created": {
      const d = obj as DisputeLike;
      const disputeId = idOf(d.id);
      const paymentIntent = idOf(d.payment_intent);
      const loud = (why: string): WalletAction => ({ kind: "ignore", why: `dispute ${disputeId ?? "(no id)"} of charge ${idOf(d.charge) ?? "?"}: ${why}`, loud: true });
      if (!disputeId) return loud("no dispute id");
      if (!paymentIntent) return loud("no payment intent");
      if (d.currency !== "thb") return loud(`currency ${String(d.currency)}`);
      if (!wholeSatang(d.amount) || d.amount === 0) return loud(`amount ${String(d.amount)}`);
      return {
        kind: "clawback", reason: "dispute", paymentIntent, ref: disputeId, satang: d.amount,
        note: `ธนาคารผู้จ่ายโต้แย้งยอดเติม ${formatBaht(d.amount)}`,
      };
    }
    default:
      return { kind: "ignore", why: event.type };
  }
}

/**
 * The Checkout Session a PaymentIntent paid, asked of Stripe — for a top-up paid before the
 * PaymentIntent was kept with it (20261001_wallet_refunds_free_rounds.sql). The live key is
 * restricted to Checkout Sessions; reading them should be within that, but if Stripe says no,
 * this says so in the log and gives up: the refund is then the owner's to take back by hand.
 * Its purpose tells a member pass's session from a top-up's (owner, 2026-10-13).
 */
async function sessionOfPayment(paymentIntent: string): Promise<{ id: string; purpose: string | null } | null> {
  try {
    const list = await stripe().checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
    const s = list.data[0];
    if (!s || s.mode !== "payment") return null;
    const purpose = purposeOf(s.metadata);
    return { id: s.id, purpose: typeof purpose === "string" ? purpose : null };
  } catch (e) {
    console.error(`stripe: could not look up the Checkout Session of ${paymentIntent} (does the key read Checkout Sessions?):`, e);
    return null;
  }
}

async function applyClawback(a: Extract<WalletAction, { kind: "clawback" }>): Promise<string> {
  // a pass's payment is never a top-up's: when a pass has it, no wallet is touched (owner, 2026-10-13)
  const p = await revokePaidPass({ paymentIntent: a.paymentIntent, reason: a.reason, ref: a.ref });
  if (p !== "unknown") return `pass-${p}`;
  const ask = () => clawBack({ paymentIntent: a.paymentIntent, kind: a.reason, ref: a.ref, satang: a.satang, note: a.note });
  let r = await ask();
  if (r.result === "unknown") {
    const session = await sessionOfPayment(a.paymentIntent);
    const sessionId = session?.id ?? null;
    /**
     * A pass's refund that came before its pass: no paid pass carries this payment yet (the
     * lookup above said so), so its credit is still being retried. Answered 200, the pass would
     * land later with nothing to take it back (review, 2026-10-13) — thrown, Stripe sends the
     * refund again once the pass is there.
     */
    if (session?.purpose === PASS_PURPOSE) {
      // or the pass is there without its PaymentIntent: write it on, then take the pass back (review, 2026-10-13)
      if (await linkPassPaymentIntent(session.id, a.paymentIntent)) {
        const again = await revokePaidPass({ paymentIntent: a.paymentIntent, reason: a.reason, ref: a.ref });
        if (again !== "unknown") return `pass-${again}`;
      }
      throw new Error(`stripe ${a.reason} ${a.ref} came before the pass of ${session.id}; Stripe will send it again`);
    }
    // a top-up paid before its PaymentIntent was kept: found once through Stripe, then written down
    if (sessionId && await linkPaymentIntent(sessionId, a.paymentIntent)) r = await ask();
    /**
     * Stripe does not promise the order of its events: a refund can come while the credit it
     * undoes is still being retried. Answered 200, it was never sent again, and the credit then
     * landed in a wallet nobody froze (review, 2026-10-11). A top-up opened here and not yet
     * credited throws instead — the webhook answers 500 and Stripe sends the refund again later.
     */
    else if (sessionId && (await topUpStatus(sessionId)) === "open") {
      throw new Error(`stripe ${a.reason} ${a.ref} came before the credit of ${sessionId}; Stripe will send it again`);
    }
  }
  if (r.result === "unknown") {
    console.error(
      `STRIPE ${a.reason.toUpperCase()} NOT TAKEN BACK: ${a.ref} (payment ${a.paymentIntent}, ${a.satang} satang) matches no top-up or member pass here — `
      + "if it is a Studio top-up, take the money back and freeze the wallet by hand on /admin/wallet; "
      + "it may also be a member pass, which a person must take back by hand",
    );
  } else if (r.result === "clawed") {
    // the owner should know a wallet was frozen even before opening /admin/wallet
    console.warn(
      `wallet ${r.agentId} frozen after a ${a.reason} (${a.ref}): claimed ${r.claimedSatang}, took ${r.debitedSatang}, short ${r.shortfallSatang} satang`,
    );
  }
  return r.result;
}

/** Throws only when the database does: the webhook then answers 500 and Stripe sends it again. */
export async function applyWalletAction(a: WalletAction): Promise<string> {
  if (a.kind === "ignore") {
    if (a.loud) console.error(`stripe event ignored though money moved at Stripe — ${a.why}`);
    return "ignored";
  }
  if (a.kind === "mark") {
    await markTopUp(a.sessionId, a.status);
    return a.status;
  }
  if (a.kind === "clawback") return applyClawback(a);
  if (a.kind === "pass") {
    const r = await addPaidPass({ sessionId: a.sessionId, memberId: a.memberId, satang: a.satang, paymentIntent: a.paymentIntent });
    if (r === "unknown") {
      console.error(
        `STRIPE PASS NOT ADDED: session ${a.sessionId} (payment ${a.paymentIntent ?? "?"}, ${a.satang} satang) took money at Stripe `
        + `for member ${a.memberId}, who does not exist here — a person must look`,
      );
    }
    return r;
  }
  const r = await creditTopUp(a.sessionId, a.agentId, a.satang, a.paymentIntent);
  // paid at Stripe, but not a top-up opened here for this agent: a person must look
  if (r === "unknown") console.error(`stripe session ${a.sessionId} paid for agent ${a.agentId}, but no top-up of theirs was opened here`);
  return r;
}
