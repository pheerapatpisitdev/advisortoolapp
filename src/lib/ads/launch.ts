import { graph } from "./graph";

/**
 * What is left of the one-by-one launch engine: the verified-advertiser id the batch send
 * (send.ts) names on its ad sets, and a read of what Meta says an ad is doing.
 */

/**
 * The verified identity (Business settings → การอนุญาตและการตรวจสอบยืนยัน) every ad set
 * reaching Thailand must name as advertiser and payer. Ad sets made through the API do not take
 * the ad account's default, and Meta has no public API to look the id up, so the owner sets it.
 */
export function thVerifiedIdentity(env: Record<string, string | undefined> = process.env): string | null {
  const id = (env.META_TH_VERIFIED_IDENTITY_ID ?? "").trim();
  return /^\d+$/.test(id) ? id : null;
}

/** What Meta made of the ad (ACTIVE, PAUSED, DISAPPROVED, ...), or null when it would not say. */
export async function adEffectiveStatus(adId: string, token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  // the id becomes a Graph path; a stray "/" or "?" would ask Meta about something else
  if (!/^\w+$/.test(adId)) return null;
  const r = await graph(fetchFn, token, `${adId}?fields=effective_status`);
  if (!r.ok) return null;
  return typeof r.body.effective_status === "string" ? r.body.effective_status : null;
}
