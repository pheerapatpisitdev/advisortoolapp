import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { actionFor, applyWalletAction } from "@/lib/wallet/events";

/**
 * Stripe telling us about a top-up's Checkout Session. The only place money enters a wallet.
 * The Dashboard endpoint sends four events: checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and
 * checkout.session.expired. A repeat is harmless — the crediting function keys on the session.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new NextResponse("not configured", { status: 500 });
  }
  // made outside the try below: a missing STRIPE_SECRET_KEY is our fault, and answering it as a
  // bad signature (400) would tell Stripe not to send the event again
  let client;
  try {
    client = stripe();
  } catch (e) {
    console.error("stripe client unavailable:", e);
    return new NextResponse("not configured", { status: 500 });
  }
  // the signature is computed over the exact bytes Stripe sent, so the body is read as text
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("no signature", { status: 400 });
  let event;
  try {
    event = client.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new NextResponse("bad signature", { status: 400 });
  }
  try {
    const done = await applyWalletAction(actionFor(event));
    return NextResponse.json({ received: true, done });
  } catch (e) {
    console.error(`stripe event ${event.id} (${event.type}) failed:`, e);
    return new NextResponse("retry", { status: 500 });
  }
}
