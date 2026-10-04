import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { AD_LIMITS } from "@/lib/content/ads";
import { adsLaunchSetup } from "./actions";
import { AdsLaunch } from "./AdsLaunch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ยิงแอด | Studio" };

/**
 * Puts an ad piece on Facebook as a paused ad and, in a second press, switches it on (owner,
 * 2026-10-04). The owner's alone: it spends the ad account, and the connection it uses can
 * change the account, not only read it. The Facebook login comes back here with ?fb=<outcome>.
 */
export default async function StudioAdsPage({ searchParams }: { searchParams: Promise<{ fb?: string; detail?: string }> }) {
  await gatePage("/studio/ads", "owner");
  const { fb, detail } = await searchParams;
  const setup = await adsLaunchSetup();
  return <AdsLaunch setup={setup} outcome={fb ?? null} detail={detail ?? null} limits={AD_LIMITS} />;
}
