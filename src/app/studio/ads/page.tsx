import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { AD_LIMITS, MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { adsStudioHome } from "./actions";
import { CampaignList } from "./CampaignList";

export const dynamic = "force-dynamic";
// the Facebook login comes back here, and the actions run as this page; 300 s is what the Hobby
// plan allows, as on the other Studio pages
export const maxDuration = 300;
export const metadata: Metadata = { title: "Ads Studio | Studio" };

/**
 * Ads Studio's list of campaigns for one Page (owner, 2026-10-04). The owner's alone: an ad
 * spends the ad account, and the connection it uses can change the account, not only read it.
 * The Facebook login for that connection comes back here with ?fb=<outcome>.
 */
export default async function StudioAdsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; fb?: string; warn?: string; detail?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const { page, fb, warn, detail } = await searchParams;
  const home = await adsStudioHome(page);
  return (
    <CampaignList
      home={home}
      products={CONTENT_PRODUCTS.map((p) => ({ href: p.href, name: p.name }))}
      rules={{ maxAngles: MAX_ANGLES, maxTones: MAX_TONES, limits: AD_LIMITS }}
      outcome={fb ?? null}
      warn={warn ?? null}
      detail={detail ?? null}
    />
  );
}
