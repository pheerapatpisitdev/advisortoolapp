"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { studioUrl, type StudioTab } from "@/lib/ads/studio-url";
import type { Connection } from "./connection";
import { ConnectionPanel } from "./ConnectionPanel";
import { PostGrid } from "./PostGrid";
import type { PostCard } from "./run-actions";
import { TONES } from "./styles";

/**
 * /studio/ads (spec 2026-10-07): the Page's Organic Studio posts run as Click-to-Messenger ads.
 * The top bar holds the Page, the tabs ยิงแอด · ผลแอด, the results range (on ผลแอด) and the
 * settings icon, which opens the ad-account connection (?settings=1, and always when a Facebook
 * login has just come back). Every choice is in the address (studioUrl).
 */

export function AdsStudio({ pages, pageId, connection, tab, days, settings, outcome, warn, detail, posts, planNames, results }: {
  pages: { pageId: string; pageName: string }[];
  pageId: string | null;
  connection: Connection;
  tab: StudioTab;
  days: 7 | 30;
  settings: boolean;
  outcome: string | null;
  warn: string | null;
  detail: string | null;
  /** ยิงแอด's posts, or why they could not be read; null on ผลแอด */
  posts: { ok: true; posts: PostCard[] } | { ok: false; error: string } | null;
  planNames: Record<string, string>;
  /** ผลแอด, drawn by the page; null on ยิงแอด */
  results: React.ReactNode;
}) {
  const router = useRouter();
  const page = pages.find((p) => p.pageId === pageId) ?? null;
  const url = (o: { tab?: StudioTab; days?: 7 | 30; settings?: boolean; page?: string | null }) => studioUrl({
    page: o.page === undefined ? pageId : o.page, tab: o.tab ?? tab, days: o.days ?? days, settings: o.settings ?? false,
  });
  const showSettings = settings || Boolean(outcome || warn || connection.choices.length > 0);
  const hasBahtAccount = connection.accounts.some((a) => a.currency === "THB");
  const tabClass = (on: boolean) => `-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm ${on ? "border-[var(--ct-accent)] font-medium text-[var(--ct-accent)]" : "border-transparent text-[var(--ct-mute)] hover:text-[var(--ct-ink)]"}`;

  return (
    <div>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--ct-hair)]">
        <h1 className="mr-1 text-lg font-semibold">Ads Studio</h1>
        {page && pages.length > 0 && (
          <label className="flex min-w-0 items-center">
            <span className="sr-only">เพจ</span>
            <select
              value={page.pageId}
              onChange={(e) => router.push(url({ page: e.target.value }))}
              className="min-h-11 max-w-[14rem] rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm font-medium outline-none focus:border-[var(--ct-accent)]"
            >
              {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
            </select>
          </label>
        )}
        <nav role="tablist" aria-label="ส่วนของ Ads Studio" className="flex">
          <Link role="tab" aria-selected={tab === "post"} href={url({ tab: "post" })} className={tabClass(tab === "post")}>ยิงแอด</Link>
          <Link role="tab" aria-selected={tab === "results"} href={url({ tab: "results" })} className={tabClass(tab === "results")}>ผลแอด</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 pb-1">
          {tab === "results" && (
            <label>
              <span className="sr-only">ช่วงผลลัพธ์</span>
              <select
                value={days}
                onChange={(e) => router.push(url({ days: e.target.value === "30" ? 30 : 7 }))}
                className="min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm outline-none focus:border-[var(--ct-accent)]"
              >
                <option value="7">7 วัน</option>
                <option value="30">30 วัน</option>
              </select>
            </label>
          )}
          <Link
            href={url({ settings: !showSettings })} aria-label="ตั้งค่าบัญชีโฆษณา" aria-pressed={showSettings}
            className={`flex size-11 items-center justify-center rounded-lg border ${showSettings ? "border-[var(--ct-accent)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)]"} hover:bg-[var(--ct-soft)]`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 4.3a1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.6 1.1 1.7 1.7 0 0 1 2.3 2.3 1.7 1.7 0 0 0 1.1 2.6 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.1 2.6 1.7 1.7 0 0 1-2.3 2.3 1.7 1.7 0 0 0-2.6 1.1 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.6-1.1 1.7 1.7 0 0 1-2.3-2.3 1.7 1.7 0 0 0-1.1-2.6 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.1-2.6 1.7 1.7 0 0 1 2.3-2.3 1.7 1.7 0 0 0 2.6-1.1Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </header>

      {showSettings && (
        <div className="mt-4 max-w-xl">
          <ConnectionPanel connection={connection} outcome={outcome} warn={warn} detail={detail} />
        </div>
      )}

      {!page ? (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
          ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน
        </p>
      ) : (
        <>
          {!hasBahtAccount && !showSettings && (
            <p role="note" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>
              ยังไม่ได้เชื่อมบัญชีโฆษณา — <Link href={url({ settings: true })} className="underline">กดไอคอนตั้งค่าเพื่อเชื่อม</Link>
            </p>
          )}
          {tab === "post" ? (
            posts && !posts.ok ? (
              <p role="alert" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านโพสต์ของเพจไม่ได้ — {posts.error}</p>
            ) : (
              <PostGrid
                key={page.pageId}
                pageId={page.pageId} pageName={page.pageName} posts={posts?.ok ? posts.posts : []} planNames={planNames}
                connection={connection} resultsHref={url({ tab: "results" })}
              />
            )
          ) : results}
        </>
      )}
    </div>
  );
}
