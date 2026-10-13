import type Stripe from "stripe";
import { CARD_FROM_THB } from "@/lib/wallet/money";

/** what tells the webhook a paid session is a pass and not a wallet top-up */
export const PASS_PURPOSE = "member_pass";

/** this checkout's label in the Stripe Dashboard, apart from the wallet's top-ups */
export const PASS_CHECKOUT_TAG = "member-pass-r7kq2wne";

/**
 * The Checkout Session for one 30-day member pass (owner, 2026-10-13). Built like a top-up
 * (src/lib/wallet/checkout.ts): the price inline, the methods left to the Dashboard, and the
 * card left out below ฿150, where its fixed fee eats a ฿99 pass. The amount Stripe charges is
 * what the webhook credits — the metadata only says what was bought and for whom.
 */
export function passCheckoutParams(a: { memberId: string; satang: number; origin: string }): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams & { integration_identifier: string } = {
    mode: "payment",
    client_reference_id: a.memberId,
    line_items: [{ quantity: 1, price_data: { currency: "thb", unit_amount: a.satang, product_data: { name: "ค่าสมาชิก AdvisorTool 30 วัน" } } }],
    metadata: { purpose: PASS_PURPOSE, member_id: a.memberId },
    success_url: `${a.origin}/membership?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${a.origin}/membership`,
    integration_identifier: PASS_CHECKOUT_TAG,
  };
  if (a.satang < CARD_FROM_THB * 100) params.excluded_payment_method_types = ["card"];
  return params;
}
