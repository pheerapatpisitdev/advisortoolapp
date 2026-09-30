import Stripe from "stripe";

/**
 * The one Stripe client, made on first use so a build without the key still builds. The API
 * version is fixed here: a Stripe upgrade is a change we make, not one that happens to us
 * (owner, 2026-09-30).
 */
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
  return client;
}
