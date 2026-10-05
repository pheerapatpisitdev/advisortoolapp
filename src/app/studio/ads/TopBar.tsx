"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { studioHref } from "@/lib/ads/manager-view";
import type { Connection } from "./actions";
import { solid } from "./styles";

/**
 * Ads Studio's top bar (desktop redesign, 2026-10-05): the name, the Page, the connected ad
 * account (or a link to connect one under ตั้งค่าเพจ), the results range (7 / 30 วัน, kept in
 * ?days=), and + สร้าง — a small menu of แคมเปญใหม่ and, with a campaign open, โฆษณาในแคมเปญนี้.
 * On a phone the parts wrap onto more lines.
 */
export function TopBar({ pages, pageId, connection, days, hrefs }: {
  pages: { pageId: string; pageName: string }[];
  /** the Page the studio is of; null when the owner has none */
  pageId: string | null;
  connection: Connection;
  days: 7 | 30;
  hrefs: {
    /** the same view over another range */
    days: (d: 7 | 30) => string;
    /** ตั้งค่าเพจ, where an ad account is connected */
    settings: string;
    newCampaign: string;
    /** the open campaign's ads; null with none open */
    newAd: string | null;
  };
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  // the menu closes on Esc (focus back on its button) and on a press anywhere else
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); opener.current?.focus(); } };
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [menu]);

  const [first, ...more] = connection.accounts;
  const item = "flex min-h-11 w-full items-center px-3 text-sm hover:bg-[var(--ct-soft)]";

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--ct-hair)] pb-3">
      <h1 className="mr-1 text-lg font-semibold">Ads Studio</h1>

      {pageId && pages.length > 0 && (
        <label className="flex min-w-0 items-center gap-2">
          <span className="sr-only">เพจ</span>
          <select
            value={pageId}
            onChange={(e) => router.push(studioHref({ page: e.target.value, campaign: null, tab: "campaigns", days }))}
            className="min-h-11 max-w-[16rem] rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm font-medium outline-none focus:border-[var(--ct-accent)]"
          >
            {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
          </select>
        </label>
      )}

      {first ? (
        <span
          title={connection.accounts.map((a) => `${a.name} (${a.id}) · ${a.currency ?? "?"}`).join("\n")}
          className="inline-flex min-h-11 min-w-0 items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-ground)] px-3 text-sm"
        >
          <span className="truncate">{first.name}</span>
          <span className="shrink-0 text-[var(--ct-mute)]">· {first.currency ?? "?"}{more.length > 0 ? ` +${more.length}` : ""}</span>
        </span>
      ) : (
        <Link href={hrefs.settings} className="inline-flex min-h-11 items-center rounded-full border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] px-3 text-sm text-[var(--ct-warn-ink)]">
          ยังไม่เชื่อมบัญชีโฆษณา
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="sr-only">ช่วงผลลัพธ์</span>
          <select
            value={days}
            onChange={(e) => router.push(hrefs.days(e.target.value === "30" ? 30 : 7))}
            className="min-h-11 rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-sm outline-none focus:border-[var(--ct-accent)]"
          >
            <option value="7">7 วันล่าสุด</option>
            <option value="30">30 วันล่าสุด</option>
          </select>
        </label>

        {pageId && (
          <div ref={box} className="relative">
            <button
              ref={opener} type="button" aria-haspopup="menu" aria-expanded={menu}
              onClick={() => setMenu((m) => !m)} className={solid}
            >
              + สร้าง
            </button>
            {menu && (
              <div role="menu" aria-label="สร้าง" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] py-1 shadow-lg">
                <Link role="menuitem" href={hrefs.newCampaign} onClick={() => setMenu(false)} className={item}>แคมเปญใหม่</Link>
                {hrefs.newAd && (
                  <Link role="menuitem" href={hrefs.newAd} onClick={() => setMenu(false)} className={item}>โฆษณาในแคมเปญนี้</Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
