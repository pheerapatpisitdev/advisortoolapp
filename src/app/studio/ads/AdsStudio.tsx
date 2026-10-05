"use client";
import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdResult } from "@/lib/ads/results";
import type { CampaignRow } from "@/lib/ads/campaign-table";
import { studioHref } from "@/lib/ads/manager-view";
import { switchedOn } from "@/lib/ads/sent-view";
import type { PersonOption } from "../PersonPicker";
import type { AdsStudioHome } from "./actions";
import type { Room } from "./AdEditor";
import { CampaignRoom } from "./CampaignRoom";
import { CampaignSettings } from "./CampaignSettings";
import { CampaignTable } from "./CampaignTable";
import { Columns } from "./Columns";
import { NewCampaignForm } from "./NewCampaignForm";
import { PageSettings, type PageContactRead } from "./PageSettings";
import type { AdRules } from "./rules";
import { TONES } from "./styles";
import { TopBar } from "./TopBar";

/**
 * /studio/ads laid out as Ads Manager is (desktop redesign, 2026-10-05): the top bar (TopBar),
 * then the tabs แคมเปญ · โฆษณา · ตั้งค่าเพจ. แคมเปญ is the Page's campaigns as one table
 * (CampaignTable); โฆษณา is the open campaign's room (CampaignRoom); ตั้งค่าเพจ is the Page's
 * contacts and ad-account connection, beside ตั้งค่าแคมเปญ with a campaign open. A new campaign
 * (?new=1, or a Page with none) is made in the tools column as before. Every choice is a new
 * address (studioHref), so a reload, the back button and a link all land where they were.
 */

export type StudioView =
  | {
    kind: "campaigns";
    /** the Page's campaigns, or why they could not be read */
    rows: CampaignRow[] | { error: string };
    results: Record<string, AdResult>;
    resultsError: string | null;
    fetchedAt: string | null;
  }
  | { kind: "room"; room: Room; productName: string; people: PersonOption[] }
  /** ตั้งค่าเพจ; `room` is the open campaign's, for ตั้งค่าแคมเปญ, null with none */
  | { kind: "page"; room: Room | null; productName: string; people: PersonOption[] }
  /** making a campaign; `back` is the one that was open, for ยกเลิก */
  | { kind: "new"; back: string | null; people: PersonOption[] }
  /** the campaign asked for could not be read */
  | { kind: "error"; id: string; error: string };

type Tab = "campaigns" | "ads" | "page";
const TABS: { key: Tab; label: string }[] = [
  { key: "campaigns", label: "แคมเปญ" },
  { key: "ads", label: "โฆษณา" },
  { key: "page", label: "ตั้งค่าเพจ" },
];

const STEPS = [
  { title: "สร้างแคมเปญ", text: "เลือกแบบประกัน ใส่สิ่งที่อยากเน้น น้ำเสียงแบรนด์ ภาพและโมเดลถ้ามี" },
  { title: "สร้างโฆษณา", text: "เลือกมุม คนอ่าน และอายุในตารางเบี้ย แล้วสร้างทีละ 1–4 ชิ้น" },
  { title: "ติ๊กแล้วส่ง", text: "ติ๊กแอดในแท็บร่าง ส่งขึ้น Facebook แบบหยุดไว้ ตรวจแล้วค่อยเปิดใช้" },
];

/** ตั้งค่าแคมเปญ on its own tab: nothing is being written here, so there is nothing to save first. */
function CampaignSettingsTab({ room, productName, people }: { room: Room; productName: string; people: PersonOption[] }) {
  const saveFirst = useRef<(() => Promise<boolean>) | null>(null);
  return (
    <CampaignSettings
      key={room.campaign.id}
      campaign={room.campaign} productName={productName} people={people}
      sent={room.counts.sent > 0} live={room.sends.filter(switchedOn).length}
      folded={false} writing={false} saveFirst={saveFirst}
    />
  );
}

export function AdsStudio({ home, view, openId, days, contact, rules, products, outcome, warn, detail }: {
  home: AdsStudioHome;
  view: StudioView;
  /** the campaign open (the ads tab's, tinted in the table); null with none */
  openId: string | null;
  days: 7 | 30;
  /** the open Page's contacts, for ตั้งค่าเพจ; null where they are not shown */
  contact: PageContactRead | null;
  rules: AdRules;
  products: { href: string; name: string }[];
  outcome: string | null;
  warn: string | null;
  detail: string | null;
}) {
  const router = useRouter();
  const page = home.pages.find((p) => p.pageId === home.pageId) ?? null;
  const tab: Tab = view.kind === "room" || view.kind === "error" ? "ads" : view.kind === "page" ? "page" : "campaigns";
  const href = (o: { tab?: Tab; campaign?: string | null; days?: 7 | 30 }) => studioHref({
    page: page?.pageId ?? null,
    campaign: o.campaign === undefined ? openId : o.campaign,
    tab: o.tab ?? tab,
    days: o.days ?? days,
  });
  // a new campaign keeps the open one as the way back (ยกเลิก)
  const newHref = page ? `/studio/ads?page=${encodeURIComponent(page.pageId)}&new=1${openId ? `&campaign=${encodeURIComponent(openId)}` : ""}` : "";

  const pageSettings = (folded: boolean) => page && contact && (
    <PageSettings
      key={page.pageId}
      pageId={page.pageId} contact={contact} connection={home.connection}
      outcome={outcome} warn={warn} detail={detail} folded={folded}
    />
  );

  const back = (
    <Link href={href({ tab: "campaigns" })} className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--ct-accent)] hover:underline">
      ← แคมเปญทั้งหมด
    </Link>
  );

  return (
    <div>
      <TopBar
        pages={home.pages} pageId={page?.pageId ?? null} connection={home.connection} days={days}
        hrefs={{
          days: (d) => href({ days: d }),
          settings: href({ tab: "page" }),
          newCampaign: newHref,
          newAd: openId && view.kind !== "new" ? href({ tab: "ads" }) : null,
        }}
      />

      {!page ? (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
          ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน
        </p>
      ) : home.error ? (
        <p role="alert" className={`mt-5 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านรายการแคมเปญไม่ได้ — {home.error}</p>
      ) : (
        <>
          <div role="tablist" aria-label="ส่วนของ Ads Studio" className="mt-3 flex max-w-full gap-1 overflow-x-auto border-b border-[var(--ct-hair)]">
            {TABS.map((t) => {
              const cls = (on: boolean) => `-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm ${on ? "border-[var(--ct-accent)] font-medium text-[var(--ct-accent)]" : "border-transparent text-[var(--ct-mute)] hover:text-[var(--ct-ink)]"}`;
              // the ads tab needs a campaign: shut, saying how to open one
              if (t.key === "ads" && !openId) {
                return (
                  <span key={t.key} role="tab" aria-selected={false} aria-disabled="true" title="เลือกแคมเปญในตารางก่อน" className={`${cls(false)} cursor-not-allowed opacity-50`}>
                    {t.label}
                  </span>
                );
              }
              return (
                <Link key={t.key} role="tab" aria-selected={tab === t.key} href={href({ tab: t.key })} className={cls(tab === t.key)}>
                  {t.label}
                </Link>
              );
            })}
          </div>

          {view.kind === "campaigns" ? (
            <div className="mt-4">
              <CampaignTable
                rows={view.rows} results={view.results} resultsError={view.resultsError} fetchedAt={view.fetchedAt}
                pageId={page.pageId} pageName={page.pageName} openId={openId}
                open={(id) => href({ tab: "ads", campaign: id })}
              />
            </div>
          ) : view.kind === "room" ? (
            <CampaignRoom
              key={view.room.campaign.id}
              room={view.room} pickers={back} pageSettings={() => null} productName={view.productName} rules={rules} people={view.people}
            />
          ) : view.kind === "page" ? (
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">{pageSettings(false)}</div>
              {view.room && (
                <div className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
                  <CampaignSettingsTab room={view.room} productName={view.productName} people={view.people} />
                </div>
              )}
            </div>
          ) : view.kind === "error" ? (
            <p role="alert" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>เปิดแคมเปญนี้ไม่ได้ — {view.error}</p>
          ) : (
            <Columns
              note="ตั้งแคมเปญใหม่ แล้วสร้างโฆษณาได้ในแท็บโฆษณาของแคมเปญ"
              startOpen
              tools={(folded) => (
                <>
                  {home.campaigns.length > 0 && <div className={`px-4 pt-3 ${folded ? "hidden lg:block" : ""}`}>{back}</div>}
                  <NewCampaignForm
                    pageId={page.pageId} products={products} people={view.people} folded={folded}
                    onCancel={view.back
                      ? () => router.push(href({ tab: "ads", campaign: view.back }))
                      : home.campaigns.length > 0 ? () => router.push(href({ tab: "campaigns", campaign: null })) : null}
                  />
                  {pageSettings(folded)}
                </>
              )}
              desk={(
                <div className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-8 text-sm text-[var(--ct-mute)]">
                  <p className="text-center font-medium text-[var(--ct-ink)]">
                    {home.campaigns.length === 0 ? "ยังไม่มีแคมเปญของเพจนี้ — เริ่มที่แผงเครื่องมือ" : "แคมเปญใหม่ — ตั้งค่าที่แผงเครื่องมือ"}
                  </p>
                  <ol className="mx-auto mt-4 grid max-w-2xl gap-3 @lg:grid-cols-3">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="rounded-lg bg-[var(--ct-ground)] p-3">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[var(--ct-solid)] text-xs font-semibold text-[var(--ct-solid-ink)]">{i + 1}</span>
                        <p className="mt-2 font-medium text-[var(--ct-ink)]">{s.title}</p>
                        <p className="mt-1 text-xs leading-relaxed">{s.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            />
          )}
        </>
      )}
    </div>
  );
}
