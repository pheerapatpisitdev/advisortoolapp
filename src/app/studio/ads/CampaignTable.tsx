"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdResult } from "@/lib/ads/results";
import { footLine, switchPlan, switchQuestion, tableLine, type CampaignRow } from "@/lib/ads/campaign-table";
import { deleteQuestion } from "@/lib/ads/campaign-view";
import { switchedOn } from "@/lib/ads/sent-view";
import { ask } from "../ask";
import { activateSendAction, deleteAdCampaign, pauseSendAction } from "./actions";
import { when } from "./SentSend";
import { TONES } from "./styles";

/**
 * The แคมเปญ tab (desktop redesign, 2026-10-05): one dense row per campaign, as Ads Manager
 * lists them — the เปิด/หยุด switch, the name with its state and plan, piece counts, the budget
 * running now and what its sent ads did over the range, a ⋯ menu with ลบแคมเปญ, and the totals
 * at the foot. The switch turns off by pausing every send that is on (one question naming them
 * all) and on by switching on the newest send, with the sent tab's own questions; it is shut
 * while the campaign has no send. The table scrolls inside its own frame on a narrow screen.
 */

const STATE: Record<"on" | "paused" | "draft", { label: string; tone: string }> = {
  on: { label: "กำลังวิ่ง", tone: "bg-[var(--ct-soft)] text-[var(--ct-accent)]" },
  paused: { label: "หยุดไว้", tone: "bg-[var(--ct-ground)] text-[var(--ct-mute)]" },
  draft: { label: "ร่าง", tone: "border border-dashed border-[var(--ct-line)] text-[var(--ct-mute)]" },
};

const th = "border-b border-[var(--ct-line)] px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-[var(--ct-mute)]";
const td = "border-b border-[var(--ct-hair)] px-3 py-2 align-top";
const numCell = `${td} text-right tabular-nums whitespace-nowrap`;

function RowMenu({ row, open, pageId }: { row: CampaignRow; open: boolean; pageId: string }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setShown(false); opener.current?.focus(); } };
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setShown(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", away);
    };
  }, [shown]);

  async function remove() {
    setShown(false);
    const live = row.sends.filter(switchedOn).length;
    if (!(await ask(deleteQuestion({ title: row.name, live, sent: row.sent > 0 }), "ลบแคมเปญ"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteAdCampaign(row.id);
      if (!res.ok) { setError(res.error); setBusy(false); return; }
      // the open campaign is gone: back to the Page's table without it; busy stays on until the page moves
      if (open) router.replace(`/studio/ads?page=${encodeURIComponent(pageId)}`);
      else router.refresh();
    } catch {
      setError("การเชื่อมต่อหลุด ยังไม่รู้ว่าลบแล้วหรือไม่ — เปิดหน้านี้ใหม่เพื่อดู");
      setBusy(false);
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        ref={opener} type="button" aria-haspopup="menu" aria-expanded={shown} disabled={busy}
        aria-label={`ตัวเลือกของแคมเปญ ${row.name}`} onClick={() => setShown((s) => !s)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-lg leading-none hover:bg-[var(--ct-ground)] disabled:opacity-50"
      >
        {busy ? "…" : "⋯"}
      </button>
      {shown && (
        <div role="menu" aria-label={`ตัวเลือกของแคมเปญ ${row.name}`} className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] py-1 shadow-lg">
          <button type="button" role="menuitem" onClick={() => void remove()} className="flex min-h-11 w-full items-center px-3 text-left text-sm text-[var(--ct-alert)] hover:bg-[var(--ct-soft)]">
            ลบแคมเปญ
          </button>
        </div>
      )}
      {error && <p role="alert" className={`absolute right-0 z-10 mt-1 w-64 rounded-lg border px-3 py-2 text-left text-xs ${TONES.bad}`}>{error}</p>}
    </div>
  );
}

function Switch({ row, pageName, onBusy, onError }: {
  row: CampaignRow;
  pageName: string;
  onBusy: (busy: boolean) => void;
  onError: (error: string | null) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const plan = switchPlan(row.sends);
  const on = plan?.kind === "pause";

  async function press() {
    if (!plan) return;
    const question = switchQuestion(plan, { campaign: row.name, page: pageName });
    if (!(await ask(question, plan.kind === "pause" ? "หยุดแคมเปญ" : "เปิดใช้เลย"))) return;
    setBusy(true);
    onBusy(true);
    onError(null);
    const failed: string[] = [];
    try {
      if (plan.kind === "activate") {
        const res = await activateSendAction(plan.send.id);
        if (!res.ok) failed.push(res.error);
      } else {
        // one at a time: each pause is its own Meta call and its own audit line
        for (const s of plan.sends) {
          const res = await pauseSendAction(s.id);
          if (!res.ok) failed.push(plan.sends.length > 1 ? `${s.accountName}: ${res.error}` : res.error);
        }
      }
    } catch {
      failed.push("การเชื่อมต่อหลุด ยังไม่รู้ว่าสำเร็จหรือไม่ — เปิดหน้านี้ใหม่เพื่อดูสถานะก่อนกดซ้ำ");
    } finally {
      setBusy(false);
      onBusy(false);
      if (failed.length > 0) onError(failed.join(" · "));
      router.refresh();
    }
  }

  const label = plan ? (on ? `หยุดแคมเปญ ${row.name}` : `เปิดใช้แคมเปญ ${row.name}`) : `แคมเปญ ${row.name} ยังไม่มีชุดที่ส่งขึ้น Facebook`;
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={!plan || busy} onClick={() => void press()}
      title={plan ? undefined : "ยังไม่มีแอดที่ส่งขึ้น Facebook — ส่งแอดจากแท็บโฆษณาก่อน จึงจะเปิด/หยุดได้"}
      className="inline-flex min-h-11 min-w-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={`relative inline-block h-6 w-10 rounded-full transition-colors ${on ? "bg-[var(--ct-solid)]" : "bg-[var(--ct-line)]"} ${busy ? "motion-safe:animate-pulse" : ""}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-[var(--ct-panel)] shadow transition-[left] ${on ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function CampaignTable({ rows, results, resultsError, fetchedAt, pageId, pageName, openId, open }: {
  /** the Page's campaigns, or why they could not be read */
  rows: CampaignRow[] | { error: string };
  results: Record<string, AdResult>;
  /** the results could not be read: every result cell is "—" and a line says why */
  resultsError: string | null;
  fetchedAt: string | null;
  pageId: string;
  pageName: string;
  /** the campaign open, tinted in the table; null with none */
  openId: string | null;
  /** where pressing a campaign's name goes: its ads */
  open: (id: string) => string;
}) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  if (!Array.isArray(rows)) {
    return <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>อ่านรายการแคมเปญไม่ได้ — {rows.error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">
        ยังไม่มีแคมเปญของเพจนี้ — กด “+ สร้าง” แล้วเลือก “แคมเปญใหม่”
      </p>
    );
  }

  // results that could not be read are none: "—" everywhere, never 0
  const shown: Record<string, AdResult> = resultsError ? {} : results;
  const foot = footLine(rows, shown);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--ct-ground)]">
              <th scope="col" className={`${th} w-14`}>เปิด/หยุด</th>
              <th scope="col" className={th}>แคมเปญ</th>
              <th scope="col" className={`${th} text-right`}>ร่าง · ส่งแล้ว</th>
              <th scope="col" className={`${th} text-right`}>งบ/วัน</th>
              <th scope="col" className={`${th} text-right`}>ใช้ไป</th>
              <th scope="col" className={`${th} text-right`}>การแสดงผล</th>
              <th scope="col" className={`${th} text-right`}>คลิก</th>
              <th scope="col" className={`${th} text-right`}>แชท</th>
              <th scope="col" className={`${th} text-right`}>บาท/แชท</th>
              <th scope="col" className={`${th} w-12`}><span className="sr-only">ตัวเลือก</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const line = tableLine(row, shown[row.id]);
              const state = STATE[line.state];
              const selected = row.id === openId;
              const error = errors[row.id];
              return (
                <tr key={row.id} aria-current={selected ? "true" : undefined} aria-busy={busy[row.id] || undefined} className={selected ? "bg-[var(--ct-soft)]" : "hover:bg-[var(--ct-ground)]"}>
                  <td className={`${td} py-0`}>
                    <Switch
                      row={row} pageName={pageName}
                      onBusy={(b) => setBusy((m) => ({ ...m, [row.id]: b }))}
                      onError={(e) => setErrors((m) => ({ ...m, [row.id]: e }))}
                    />
                  </td>
                  <td className={`${td} min-w-[16rem]`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={open(row.id)} className="font-medium text-[var(--ct-accent)] hover:underline">{row.name}</Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${state.tone}`}>{busy[row.id] ? "กำลังเปลี่ยน…" : state.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--ct-mute)]">{row.planName}</p>
                    {error && <p role="alert" className="mt-1 break-words text-xs text-[var(--ct-alert)]">{error}</p>}
                  </td>
                  <td className={numCell}>{row.drafts.toLocaleString("th-TH")} · {row.sent.toLocaleString("th-TH")}</td>
                  <td className={numCell}>{line.budget}</td>
                  <td className={numCell}>{line.cells.spend}</td>
                  <td className={numCell}>{line.cells.impressions}</td>
                  <td className={numCell}>{line.cells.clicks}</td>
                  <td className={numCell}>{line.cells.messaging}</td>
                  <td className={numCell}>{line.cells.perChat}</td>
                  <td className={`${td} py-0 text-right`}><RowMenu row={row} open={selected} pageId={pageId} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ct-ground)] font-medium">
              <td className="px-3 py-2" />
              <th scope="row" className="px-3 py-2 text-left">รวม {rows.length.toLocaleString("th-TH")} แคมเปญ</th>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{foot.drafts.toLocaleString("th-TH")} · {foot.sent.toLocaleString("th-TH")}</td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{foot.budget}</td>
              {[foot.cells.spend, foot.cells.impressions, foot.cells.clicks, foot.cells.messaging, foot.cells.perChat].map((v, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{v}</td>
              ))}
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      {resultsError ? (
        <p role="alert" className="text-xs text-[var(--ct-alert)]">อ่านผลลัพธ์ของแอดไม่ได้ — {resultsError}</p>
      ) : (
        <p className="text-xs text-[var(--ct-mute)]">
          {fetchedAt ? `อัปเดตล่าสุด ${when(fetchedAt)}` : "ยังไม่มีผลลัพธ์ของแอดในช่วงนี้"} · ผลลัพธ์ดึงจาก Facebook วันละครั้ง อาจช้าได้ถึง 1 วัน
        </p>
      )}
    </div>
  );
}
