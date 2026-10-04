"use client";
import { useRouter } from "next/navigation";
import type { WriteCount } from "@/lib/ads/room-view";
import type { PersonOption } from "../PersonPicker";
import type { AdsStudioHome } from "./actions";
import type { Room } from "./AdEditor";
import { CampaignRoom } from "./CampaignRoom";
import { Columns } from "./Columns";
import { ConnectBar } from "./ConnectBar";
import { NewCampaignWizard } from "./NewCampaignWizard";
import type { AdRules } from "./rules";
import { SentRail } from "./SentRail";
import { field, TONES } from "./styles";

/**
 * /studio/ads, one page as Organic Studio is (owner, 2026-10-04): `Ads Studio · <Page>` and the
 * ad-account strip, then three columns. The tools start with the Page and the campaign to work
 * on — "+ แคมเปญใหม่…" turns them into the three steps that make one — and the open campaign's
 * room fills the rest (CampaignRoom). Every choice is a new address, so a reload, the back button
 * and a link all land where they were: ?page=, ?campaign=, ?new=1.
 */

export type StudioView =
  | { kind: "room"; room: Room; productName: string; people: PersonOption[]; autoWrite: WriteCount | 0 }
  /** making a campaign; `back` is the one that was open, for ยกเลิก */
  | { kind: "new"; back: string | null }
  /** the campaign asked for could not be read */
  | { kind: "error"; id: string; error: string };

const STEPS = [
  { title: "เลือกแบบประกัน", text: "ใส่สิ่งที่อยากเน้น น้ำเสียงแบรนด์ และโทนสีถ้ามี" },
  { title: "AI วิเคราะห์", text: "เสนอ ฮุก กลุ่มคน มุมขาย และสไตล์ภาพ แก้ได้ตามใจ" },
  { title: "มิติและสร้าง", text: "ติ๊ก แก้ เพิ่ม แล้วสร้างแอดชุดแรก 1 / 2 / 4 ชิ้น" },
];

const NEW = "new";

export function AdsStudio({ home, view, rules, products, outcome, warn, detail }: {
  home: AdsStudioHome;
  view: StudioView;
  rules: AdRules;
  products: { href: string; name: string }[];
  outcome: string | null;
  warn: string | null;
  detail: string | null;
}) {
  const router = useRouter();
  const page = home.pages.find((p) => p.pageId === home.pageId) ?? null;
  const openId = view.kind === "room" ? view.room.campaign.id : view.kind === "error" ? view.id : null;

  const pickCampaign = (value: string) => {
    if (!page) return;
    router.push(value === NEW
      ? `/studio/ads?page=${encodeURIComponent(page.pageId)}&new=1${openId ? `&campaign=${encodeURIComponent(openId)}` : ""}`
      : `/studio/ads?campaign=${encodeURIComponent(value)}`);
  };

  const pickers = page && (
    <>
      {home.pages.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">เพจ</span>
          <select
            value={page.pageId} className={`${field} font-medium`}
            onChange={(e) => router.push(`/studio/ads?page=${encodeURIComponent(e.target.value)}`)}
          >
            {home.pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">แคมเปญ</span>
        <select value={openId ?? NEW} onChange={(e) => pickCampaign(e.target.value)} className={`${field} font-medium`}>
          {home.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW}>+ แคมเปญใหม่…</option>
        </select>
      </label>
    </>
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold">Ads Studio{page && <span className="font-normal text-[var(--ct-mute)]"> · {page.pageName}</span>}</h1>
        <p className="mt-1 text-sm text-[var(--ct-mute)]">AI เขียนแอดจากข้อมูลจริงของแบบประกันตามมิติของแคมเปญ อนุมัติแล้วส่งขึ้น Facebook แบบหยุดไว้ ตรวจแล้วค่อยเปิดใช้</p>
      </div>
      <div className="mt-3">
        <ConnectBar connection={home.connection} outcome={outcome} warn={warn} detail={detail} />
      </div>

      {!page ? (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">
          ยังไม่มีเพจที่เชื่อมกับระบบ — เชื่อมเพจที่ <a href="/admin/messenger" className="font-medium text-[var(--ct-accent)] underline">หน้าตั้งค่าเพจ</a> ก่อน
        </p>
      ) : home.error ? (
        <p role="alert" className={`mt-5 rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านรายการแคมเปญไม่ได้ — {home.error}</p>
      ) : view.kind === "room" ? (
        <CampaignRoom
          key={view.room.campaign.id}
          room={view.room} pickers={pickers} productName={view.productName} rules={rules} people={view.people} autoWrite={view.autoWrite}
        />
      ) : (
        <Columns
          note={view.kind === "new" ? "ตั้งแคมเปญใหม่ 3 ขั้น แล้วแอดชุดแรกจะขึ้นตรงกลาง" : "เลือกแคมเปญ หรือสร้างแคมเปญใหม่"}
          startOpen
          tools={(folded) => (
            <>
              <div className={`space-y-4 p-4 ${folded ? "hidden lg:block" : ""}`}>{pickers}</div>
              {view.kind === "new" && (
                <NewCampaignWizard
                  pageId={page.pageId} products={products} folded={folded}
                  onCancel={view.back ? () => router.push(`/studio/ads?campaign=${encodeURIComponent(view.back!)}`) : null}
                />
              )}
            </>
          )}
          desk={view.kind === "error" ? (
            <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>เปิดแคมเปญนี้ไม่ได้ — {view.error}</p>
          ) : (
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
          rail={<SentRail rows={[]} pieces={[]} productName="" onShow={null} />}
        />
      )}
    </div>
  );
}
