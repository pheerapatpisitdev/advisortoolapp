import type Stripe from "stripe";
import { cardAllowed, toSatang, type TopUpThb } from "./money";

/** this checkout's label in the Stripe Dashboard, to tell its sessions from any other flow's */
export const CHECKOUT_TAG = "studio-wallet-qmxhrtvb";

/**
 * The Checkout Session for one top-up. The price is written inline — no Product to keep in the
 * Dashboard — and the payment methods are not named: PromptPay and cards are switched on in
 * the Dashboard, and a card is left out below ฿150, where its fixed fee eats the top-up
 * (owner, 2026-09-30).
 */
export function checkoutParams(a: { agentId: string; thb: TopUpThb; origin: string }): Stripe.Checkout.SessionCreateParams {
  const satang = toSatang(a.thb);
  const params: Stripe.Checkout.SessionCreateParams & { integration_identifier: string } = {
    mode: "payment",
    client_reference_id: a.agentId,
    line_items: [{ quantity: 1, price_data: { currency: "thb", unit_amount: satang, product_data: { name: `เติมเงิน Studio ฿${a.thb}` } } }],
    metadata: { agent_id: a.agentId, amount_satang: String(satang) },
    success_url: `${a.origin}/studio/wallet?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${a.origin}/studio/wallet`,
    integration_identifier: CHECKOUT_TAG,
  };
  if (!cardAllowed(a.thb)) params.excluded_payment_method_types = ["card"];
  return params;
}
