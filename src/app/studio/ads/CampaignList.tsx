"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { posterUrl } from "@/lib/content/poster";
import type { AdsStudioHome } from "./actions";
import { ConnectBar } from "./ConnectBar";
import { NewCampaign } from "./NewCampaign";
import type { AdRules } from "./rules";
import { field, solid, TONES } from "./styles";

/**
 * /studio/ads: one Page's ad campaigns. The Page's name heads it with a picker for the others,
 * the ad-account strip sits under it, then a card per campaign with its newest poster and how
 * many of its ads are drafts, launched and switched on. With no campaign yet, three steps and
 * a button to start.
 */

const STEPS = [
  { title: "สร้างแคมเปญ", text: "เลือกแบบประกัน จำนวนมุมขายและน้ำเสียง แล้วระบบเขียนแอดชุดแรกให้" },
  { title: "แก้แอด", text: "เกลาข้อความ วาดภาพโปสเตอร์ ดูตัวอย่างในฟีดก่อนยิง" },
  { title: "ยิงแอด", text: "บันทึกเป็นแอดหยุดไว้บน Facebook ตรวจใน Ads Manager แล้วค่อยเปิดใช้" },
];

function Counts({ counts }: { counts: AdsStudioHome["campaigns"][number]["counts"] }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--ct-mute)]">
      <span>ร่าง <b className="font-semibold tabular-nums">{counts.draft}</b></span>
      <span>ยิงแล้ว <b className="font-semibold tabular-nums">{counts.launched}</b></span>
      <span className={counts.live ? "text-[var(--ct-accent)]" : ""}>เปิดใช้ <b className="font-semibold tabular-nums">{counts.live}</b></span>
    </p>
  );
}

export function CampaignList({ home, products, rules, outcome, warn, detail }: {
  home: AdsStudioHome;
  products: { href: string; name: string }[];
  rules: AdRules;
  outcome: string | null;
  warn: string | null;
  detail: string | null;
}) {
  const router = useRouter();
  const [making, setMaking] = useState(false);
  const page = home.pages.find((p) => p.pageId === home.pageId) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--ct-mute)]">Ads Studio</p>
          <h1 className="truncate text-xl font-semibold">{page?.pageName ?? "ยังไม่มีเพจ"}</h1>
          {home.pages.length > 1 && (
            <label className="mt-2 block max-w-xs">
              <span className="sr-only">เลือกเพจ</span>
              <select
                value={home.pageId ?? ""} className={field}
                onChange={(e) => router.push(`/studio/ads?page=${encodeURIComponent(e.target.value)}`)}
              >
                {home.pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
              </select>
            </label>
          )}
        </div>
        {page && !making && (
          <button type="button" onClick={() => setMaking(true)} className={solid}>+ สร้างแคมเปญ</button>
        )}
      </header>

      <ConnectBar connection={home.connection} outcome={outcome} warn={warn} detail={detail} />

      {making && page && (
        <NewCampaign pageId={page.pageId} pageName={page.pageName} products={products} rules={rules} onClose={() => setMaking(false)} />
      )}

      {!page ? (
        <p className="rounded-2xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
          ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน
        </p>
      ) : home.error ? (
        <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านรายการแคมเปญไม่ได้ — {home.error}</p>
      ) : home.campaigns.length === 0 ? (
        !making && (
          <section className="rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5 sm:p-6">
            <h2 className="font-semibold">ยังไม่มีแคมเปญของเพจนี้</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-xl bg-[var(--ct-ground)] p-4">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[var(--ct-solid)] text-sm font-semibold text-[var(--ct-solid-ink)]">{i + 1}</span>
                  <p className="mt-2 text-sm font-medium">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ct-mute)]">{s.text}</p>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setMaking(true)} className={`${solid} mt-4`}>เริ่มสร้างแคมเปญแรก</button>
          </section>
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {home.campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/studio/ads/${c.id}`} className="block overflow-hidden rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] hover:border-[var(--ct-line)] focus-visible:border-[var(--ct-accent)]">
                {c.coverPoster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                  <img src={posterUrl(c.coverPoster)} alt="" loading="lazy" className="aspect-square w-full bg-[var(--ct-ground)] object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-[var(--ct-ground)] text-sm text-[var(--ct-mute)]">ยังไม่มีโปสเตอร์</div>
                )}
                <div className="space-y-1 p-4">
                  <h2 className="truncate font-semibold">{c.name}</h2>
                  <Counts counts={c.counts} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
