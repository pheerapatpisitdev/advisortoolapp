"use client";
import { useMemo, useState } from "react";
import { posterUrl } from "@/lib/content/poster";
import type { Connection } from "./connection";
import type { PostCard } from "./run-actions";
import { RunDialog } from "./RunDialog";
import { chip, field, solid } from "./styles";

/**
 * ยิงแอด (spec 2026-10-07): the Page's Organic Studio posts as cards, ticked to run as Messenger
 * ads. ขึ้นเพจแล้ว (the default) is what is on the Page or scheduled for it — boosted as it stands;
 * ร่าง is what is not — made into a new ad from its words and picture. A card says how it would
 * run; one scheduled ahead, one already running, one with a stuck run (retried or dropped on
 * ผลแอด first) or one that cannot run is not tickable and says why. The bar at the foot opens the run dialog with the ticked posts.
 */

type Filter = "page" | "draft";

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

/** the line under a card's title, and whether it may be ticked */
function lineOf(p: PostCard): { text: string; tone: "mute" | "warn" | "ok"; tickable: boolean } {
  if (p.live) return { text: "กำลังรัน", tone: "ok", tickable: false };
  if (p.stuck) return { text: "ค้างอยู่ — ลองใหม่หรือเลิกในแท็บผลแอด", tone: "warn", tickable: false };
  switch (p.path.kind) {
    case "boost": return { text: "บนเพจ", tone: "mute", tickable: true };
    case "new": return { text: "ร่าง · ทำเป็นแอดใหม่", tone: "warn", tickable: true };
    case "scheduled": return { text: `ขึ้นเพจ ${when(p.path.at)}`, tone: "mute", tickable: false };
    case "none": return { text: p.path.reason, tone: "warn", tickable: false };
  }
}

const onPage = (p: PostCard) => p.path.kind === "boost" || p.path.kind === "scheduled";

export function PostGrid({ pageId, pageName, posts, planNames, connection, resultsHref }: {
  pageId: string;
  pageName: string;
  posts: PostCard[];
  /** each plan's name, by its href */
  planNames: Record<string, string>;
  connection: Connection;
  /** ผลแอด, where the dialog's ดูผลแอด goes */
  resultsHref: string;
}) {
  const [filter, setFilter] = useState<Filter>("page");
  const [plan, setPlan] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);

  const plans = useMemo(() => [...new Set(posts.map((p) => p.planHref))], [posts]);
  const shown = posts.filter((p) => (filter === "page" ? onPage(p) : !onPage(p)) && (!plan || p.planHref === plan));
  const picked = posts.filter((p) => ticked.has(p.id));

  const toggle = (id: string) => setTicked((was) => {
    const next = new Set(was);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (posts.length === 0) {
    return (
      <p className="mt-5 rounded-xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
        ยังไม่มีโพสต์ของเพจนี้ — <a href="/studio" className="font-medium text-[var(--ct-accent)] underline">ทำโพสต์ใน Organic Studio</a>
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={filter === "page"} onClick={() => setFilter("page")} className={chip(filter === "page")}>ขึ้นเพจแล้ว</button>
        <button type="button" aria-pressed={filter === "draft"} onClick={() => setFilter("draft")} className={chip(filter === "draft")}>ร่าง</button>
        {plans.length > 1 && (
          <label className="ml-auto">
            <span className="sr-only">แบบประกัน</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={`${field} w-auto`}>
              <option value="">ทุกแบบประกัน</option>
              {plans.map((h) => <option key={h} value={h}>{planNames[h] ?? h}</option>)}
            </select>
          </label>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ct-mute)]">{filter === "page" ? "ยังไม่มีโพสต์ที่ขึ้นเพจ" : "ไม่มีร่างที่ยังไม่ได้โพสต์"}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => {
            const line = lineOf(p);
            const on = ticked.has(p.id);
            const tone = line.tone === "ok" ? "text-[var(--ct-accent)]" : line.tone === "warn" ? "text-[var(--ct-warn-ink)]" : "text-[var(--ct-mute)]";
            return (
              <li key={p.id}>
                <button
                  type="button" aria-pressed={on} disabled={!line.tickable} onClick={() => toggle(p.id)}
                  className={`block w-full rounded-xl border bg-[var(--ct-panel)] p-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${on ? "border-2 border-[var(--ct-accent)]" : "border-[var(--ct-hair)] hover:border-[var(--ct-line)]"}`}
                >
                  <span className="relative block">
                    {p.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                      <img src={posterUrl(p.poster)} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-[var(--ct-ground)] object-cover" />
                    ) : (
                      <span className="block aspect-square w-full rounded-lg bg-[var(--ct-ground)]" />
                    )}
                    {on && <span aria-hidden className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]">✓</span>}
                  </span>
                  <span className="mt-2 line-clamp-2 block font-medium">{p.title || "(ไม่มีหัวข้อ)"}</span>
                  <span className={`mt-0.5 block text-xs ${tone}`}>{line.text}</span>
                  {p.lastCostPerChat !== null && (
                    <span className="block text-xs text-[var(--ct-accent)]">เคยยิง ฿{Math.round(p.lastCostPerChat).toLocaleString("en-US")}/แชท</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picked.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 py-3">
          <span className="text-sm">เลือก {picked.length} โพสต์</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTicked(new Set())} className="min-h-11 rounded-lg px-3 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-soft)]">ล้าง</button>
            <button type="button" onClick={() => setOpen(true)} className={solid}>ยิงแอด {picked.length} โพสต์</button>
          </div>
        </div>
      )}

      {open && (
        <RunDialog
          pageId={pageId} pageName={pageName} posts={picked} connection={connection} resultsHref={resultsHref}
          onClose={() => setOpen(false)}
          onRan={(ok) => setTicked((was) => new Set([...was].filter((id) => !ok.includes(id))))}
        />
      )}
    </div>
  );
}
