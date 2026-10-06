import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { parseDays } from "@/lib/ads/manager-view";
import { parseStudioTab } from "@/lib/ads/studio-url";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { AdsStudio } from "./AdsStudio";
import { adsPage, postsForAds } from "./run-actions";

export const dynamic = "force-dynamic";
// a run makes several Meta requests per post, each allowed 30 s, and starts no new post after
// 120 s (src/lib/ads/run.ts); the Facebook login comes back here too. 300 s is what the Hobby
// plan allows, as on the other Studio pages.
export const maxDuration = 300;
export const metadata: Metadata = { title: "Ads Studio | Studio" };

/**
 * Ads Studio (spec 2026-10-07): the owner's alone — a run spends the ad account at once. The
 * address holds every choice: ?page=<id> (the owner's first Page without one), ?tab=post|results,
 * ?days=7|30 for the results, ?settings=1 for the ad-account connection. The Facebook login comes
 * back with ?fb=<outcome> (and ?warn=, ?detail=), which opens the connection to say how it went.
 * Each tab reads only what it shows.
 */
export default async function StudioAdsPage({ searchParams }: {
  searchParams: Promise<{ page?: string; tab?: string; days?: string; settings?: string; fb?: string; warn?: string; detail?: string }>;
}) {
  await gatePage("/studio/ads", "owner");
  const q = await searchParams;
  const tab = parseStudioTab(q.tab);
  const days = parseDays(q.days);
  const home = await adsPage(q.page);
  const posts = tab === "post" && home.pageId ? await postsForAds(home.pageId) : null;

  return (
    <AdsStudio
      pages={home.pages}
      pageId={home.pageId}
      connection={home.connection}
      tab={tab}
      days={days}
      settings={q.settings === "1"}
      outcome={q.fb ?? null}
      warn={q.warn ?? null}
      detail={q.detail ?? null}
      posts={posts}
      planNames={Object.fromEntries(CONTENT_PRODUCTS.map((p) => [p.href, p.name]))}
      results={null}
    />
  );
}
