import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { AD_LIMITS } from "@/lib/content/ads";
import { adsLaunchSetup } from "./actions";
import { AdsLaunch } from "./AdsLaunch";

export const dynamic = "force-dynamic";
// the launch actions run as this page: up to five Meta requests, each allowed 30 s (src/lib/ads/launch.ts),
// and the page itself asks Meta for every launched ad's status. 300 s is what the Hobby plan allows, as on the
// other Studio pages; the default would cut a slow launch off between two steps.
export const maxDuration = 300;
export const metadata: Metadata = { title: "ยิงแอด | Studio" };

/**
 * Puts an ad piece on Facebook as a paused ad and, in a second press, switches it on (owner,
 * 2026-10-04). The owner's alone: it spends the ad account, and the connection it uses can
 * change the account, not only read it. The Facebook login comes back here with ?fb=<outcome>.
 */
export default async function StudioAdsPage({ searchParams }: { searchParams: Promise<{ fb?: string; warn?: string; detail?: string }> }) {
  await gatePage("/studio/ads", "owner");
  const { fb, warn, detail } = await searchParams;
  const setup = await adsLaunchSetup();
  return <AdsLaunch setup={setup} outcome={fb ?? null} warn={warn ?? null} detail={detail ?? null} limits={AD_LIMITS} />;
}
