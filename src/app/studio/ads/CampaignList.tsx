"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { posterUrl } from "@/lib/content/poster";
import { ask } from "../ask";
import { deleteAdCampaign, type AdsStudioHome } from "./actions";
import { ConnectBar } from "./ConnectBar";
import { field, solid, TONES } from "./styles";

/**
 * /studio/ads: one Page's ad campaigns. The Page's name heads it with a picker for the others,
 * the ad-account strip sits under it, then a card per campaign with its newest poster and how
 * many of its ads are drafts, approved and sent, and a ลบ that asks first. With no campaign yet, three steps and
 * a button to start. A new campaign is made in the wizard (/studio/ads/new?page=…).
 */

const STEPS = [
  { title: "สร้างแคมเปญ", text: "เลือกแบบประกัน ให้ AI เสนอฮุก กลุ่มคน มุมขาย และสไตล์ภาพ แล้วแก้ได้ตามใจ" },
  { title: "สร้างและอนุมัติ", text: "สร้างแอดจากคิวครั้งละ 1 / 2 / 4 ชิ้นพร้อมรูป แล้วกด ✓ อนุมัติ หรือ ✕ ทิ้ง บนการ์ด" },
  { title: "ส่งขึ้น Facebook", text: "ส่งทุกชิ้นที่อนุมัติครั้งเดียวเป็นแอดหยุดไว้ ตรวจแล้วค่อยเปิดใช้ทั้งชุด" },
];

const newHref = (pageId: string) => `/studio/ads/new?page=${encodeURIComponent(pageId)}`;

function Counts({ counts }: { counts: AdsStudioHome["campaigns"][number]["counts"] }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--ct-mute)]">
      <span>ร่าง <b className="font-semibold tabular-nums">{counts.draft}</b></span>
      <span>อนุมัติแล้ว <b className="font-semibold tabular-nums">{counts.approved}</b></span>
      <span className={counts.sent ? "text-[var(--ct-accent)]" : ""}>ส่งแล้ว <b className="font-semibold tabular-nums">{counts.sent}</b></span>
    </p>
  );
}

type Campaign = AdsStudioHome["campaigns"][number];

/** The card's ลบ: asks in the page, then deletes. A refusal (an ad still switched on) shows under the card. */
function DeleteCampaign({ campaign, onError }: { campaign: Campaign; onError: (e: string | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const sent = campaign.counts.sent > 0;
  const onClick = async () => {
    const message = `ลบแคมเปญ "${campaign.name}" และแอดทั้งหมดในแคมเปญนี้ออกจาก Ads Studio?${sent
      ? "\n\nแอดที่ส่งขึ้น Facebook แล้วจะยังอยู่ในตัวจัดการโฆษณา (หยุดไว้) ถ้าไม่ใช้แล้วให้ลบที่นั่นด้วย"
      : ""}\n\nลบแล้วกู้คืนไม่ได้`;
    if (!(await ask(message, "ลบแคมเปญ"))) return;
    onError(null);
    start(async () => {
      const res = await deleteAdCampaign(campaign.id);
      if (res.ok) router.refresh();
      else onError(res.error);
    });
  };
  return (
    <button
      type="button" onClick={onClick} disabled={pending} aria-label={`ลบแคมเปญ ${campaign.name}`}
      className="absolute right-2 top-2 min-h-11 rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)]/90 px-3.5 text-sm text-[var(--ct-alert)] shadow-sm backdrop-blur hover:bg-[var(--ct-alert-bg)] disabled:opacity-50"
    >
      {pending ? "กำลังลบ…" : "ลบ"}
    </button>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="relative">
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
      <DeleteCampaign campaign={c} onError={setError} />
      {error && <p role="alert" className={`mt-2 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>{error}</p>}
    </li>
  );
}

export function CampaignList({ home, outcome, warn, detail }: {
  home: AdsStudioHome;
  outcome: string | null;
  warn: string | null;
  detail: string | null;
}) {
  const router = useRouter();
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
        {page && (
          <Link href={newHref(page.pageId)} className={`${solid} inline-flex items-center no-underline`}>+ สร้างแคมเปญ</Link>
        )}
      </header>

      <ConnectBar connection={home.connection} outcome={outcome} warn={warn} detail={detail} />

      {!page ? (
        <p className="rounded-2xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
          ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน
        </p>
      ) : home.error ? (
        <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านรายการแคมเปญไม่ได้ — {home.error}</p>
      ) : home.campaigns.length === 0 ? (
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
          <Link href={newHref(page.pageId)} className={`${solid} mt-4 inline-flex items-center no-underline`}>เริ่มสร้างแคมเปญแรก</Link>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {home.campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
        </ul>
      )}
    </div>
  );
}
