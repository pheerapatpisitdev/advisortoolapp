import type { Metadata } from "next";
import { gatePage } from "@/lib/auth/viewer";
import { parseDays } from "@/lib/ads/manager-view";
import { parseStudioTab } from "@/lib/ads/studio-url";
import { CONTENT_PRODUCTS } from "@/lib/content/products";
import { AdsStudio } from "./AdsStudio";
import { ResultsBoard } from "./ResultsBoard";
import { adsPage, boardAction, postsForAds } from "./run-actions";
import { TONES } from "./styles";

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
  const board = tab === "results" && home.pageId ? await boardAction(home.pageId, days) : null;
  const results = !board ? null : board.ok ? (
    <ResultsBoard data={board} days={days} capBaht={home.connection.maxDailyBudgetThb} />
  ) : (
    <p role="alert" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านผลแอดไม่ได้ — {board.error}</p>
  );

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
      results={results}
    />
  );
}
