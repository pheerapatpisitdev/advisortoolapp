"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { posterUrl } from "@/lib/content/poster";
import { STATUS_LABEL, type BoardRow, type BoardStatus } from "@/lib/ads/board";
import { EXTEND_DAYS, extendedEnd, raisedBudgetMinor } from "@/lib/ads/run-path";
import type { Control } from "@/lib/ads/run-controls";
import { controlAdAction, controlRunAction, refreshResultsAction, retryRunAction, type StuckRun } from "./run-actions";
import { plain, TONES } from "./styles";

/**
 * ผลแอด (spec 2026-10-07): every ad of the Page over the range, those built in Ads Manager too,
 * with spend, chats and cost per chat, and a suggestion — เพิ่มงบ / รอดูต่อ / ควรหยุด — that says
 * why. A run's ad (one post, its own ad set) has หยุด or เปิดต่อ, เพิ่มงบ and ยืดเวลา; the last two
 * ask first with the new figure. Any other ad has หยุด or เปิดต่อ when its account is connected
 * for making ads, and a link to Ads Manager. อัปเดตผลตอนนี้ reads the last days from Meta now,
 * as the nightly sync does. Runs that stopped before their ad (a lost answer, a refusal, a closed
 * dialog) are listed above as รายการค้าง with ลองใหม่ (carries on from the saved step) and เลิก
 * (pauses what was made and frees the post to run again).
 */

export interface BoardData {
  rows: BoardRow[];
  totals: { spend: number; chats: number; costPerChat: number | null };
  baseline: number;
  fetchedAt: string | null;
  controllable: string[];
  stuck: StuckRun[];
}

const baht = (n: number | null) => (n === null ? "—" : `฿${Math.round(n).toLocaleString("en-US")}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const at = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

const STATUS_TONE: Record<BoardStatus, string> = {
  running: "bg-[var(--ct-soft)] text-[var(--ct-accent)]",
  paused: "bg-[var(--ct-ground)] text-[var(--ct-mute)]",
  review: "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]",
  rejected: "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]",
  ended: "bg-[var(--ct-ground)] text-[var(--ct-mute)]",
  unknown: "bg-[var(--ct-ground)] text-[var(--ct-mute)]",
};
const ADVICE: Record<"raise" | "wait" | "stop", { label: string; tone: string }> = {
  raise: { label: "เพิ่มงบ", tone: "bg-[var(--ct-soft)] text-[var(--ct-accent)] border-[var(--ct-accent)]" },
  wait: { label: "รอดูต่อ", tone: "border-[var(--ct-line)] text-[var(--ct-mute)]" },
  stop: { label: "ควรหยุด", tone: "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)] border-[var(--ct-alert-line)]" },
};

const managerLink = (actId: string, adId: string) =>
  `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${actId.replace(/^act_/, "")}&selected_ad_ids=${adId}`;

function Row({ row, canControl, capBaht }: { row: BoardRow; canControl: boolean; capBaht: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ control: Control; text: string } | null>(null);
  const run = row.run;
  const pausable = row.status === "running" || row.status === "review";

  async function act(press: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const out = await press();
      if (out.ok) { setAsking(null); router.refresh(); } else setError(out.error ?? "ทำรายการไม่สำเร็จ");
    } catch {
      setError("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  const onRun = (control: Control) => act(async () => {
    const out = await controlRunAction(run!.id, control);
    return out.ok ? { ok: true } : out;
  });

  const ask = (control: "raise" | "extend") => {
    if (!run) return;
    const text = control === "raise"
      ? `งบใหม่ ${baht(raisedBudgetMinor(run.dailyBudgetMinor, capBaht) / 100)}/วัน (จาก ${baht(run.dailyBudgetMinor / 100)})`
      : `จบใหม่ ${day(extendedEnd(run.endAt, new Date()))} (เพิ่ม ${EXTEND_DAYS} วัน)`;
    setAsking({ control, text });
  };

  return (
    <li className="py-3">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 md:grid-cols-[3rem_minmax(0,1fr)_5rem_3.5rem_5rem_minmax(0,14rem)] md:items-center">
        {row.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
          <img src={posterUrl(row.poster)} alt="" className="size-12 rounded-md object-cover" />
        ) : <span className="size-12 rounded-md bg-[var(--ct-ground)]" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--ct-mute)]">
            <span className={`rounded px-1.5 py-0.5 ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
            {run ? <span>{baht(run.dailyBudgetMinor / 100)}/วัน · ถึง {day(run.endAt)}</span> : row.campaignName && <span className="truncate">{row.campaignName}</span>}
          </p>
          {/* on a phone the figures sit under the title */}
          <p className="mt-1 text-xs tabular-nums md:hidden">ใช้ไป {baht(row.spend)} · {row.chats} แชท · {baht(row.costPerChat)}/แชท</p>
        </div>
        <span className="hidden text-right text-sm tabular-nums md:block">{baht(row.spend)}</span>
        <span className="hidden text-right text-sm tabular-nums md:block">{row.chats}</span>
        <span className="hidden text-right text-sm tabular-nums md:block">{baht(row.costPerChat)}</span>
        <div className="col-span-2 min-w-0 md:col-span-1">
          {row.advice && (
            <p className="text-xs">
              <span className={`mr-1.5 inline-block rounded-full border px-2 py-0.5 font-medium ${ADVICE[row.advice.kind].tone}`}>{ADVICE[row.advice.kind].label}</span>
              <span className="text-[var(--ct-mute)]">{row.advice.reason}</span>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {run ? (
              <>
                {pausable && <button type="button" disabled={busy} onClick={() => onRun("pause")} className={plain}>หยุด</button>}
                {row.status === "paused" && <button type="button" disabled={busy} onClick={() => onRun("resume")} className={plain}>เปิดต่อ</button>}
                {row.status !== "ended" && <button type="button" disabled={busy} onClick={() => ask("raise")} className={plain}>เพิ่มงบ</button>}
                <button type="button" disabled={busy} onClick={() => ask("extend")} className={plain}>ยืดเวลา</button>
              </>
            ) : (
              <>
                {canControl && pausable && (
                  <button type="button" disabled={busy} onClick={() => act(() => controlAdAction(row.adId, row.actId, "PAUSED"))} className={plain}>หยุด</button>
                )}
                {canControl && row.status === "paused" && (
                  <button type="button" disabled={busy} onClick={() => act(() => controlAdAction(row.adId, row.actId, "ACTIVE"))} className={plain}>เปิดต่อ</button>
                )}
                <a href={managerLink(row.actId, row.adId)} target="_blank" rel="noreferrer" className={`${plain} inline-flex items-center no-underline`}>เปิดใน Ads Manager</a>
              </>
            )}
          </div>
          {asking && (
            <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TONES.ok}`}>
              <span className="min-w-0">{asking.text}</span>
              <button type="button" disabled={busy} onClick={() => onRun(asking.control)} className={plain}>{busy ? "กำลังทำ…" : "ยืนยัน"}</button>
              <button type="button" disabled={busy} onClick={() => setAsking(null)} className="min-h-11 rounded-lg px-3 text-sm text-[var(--ct-mute)]">ยกเลิก</button>
            </div>
          )}
          {error && <p role="alert" className="mt-1 text-xs text-[var(--ct-alert)]">{error}</p>}
        </div>
      </div>
    </li>
  );
}

/** One stuck run: its post, why it stopped, ลองใหม่ and เลิก. */
function Stuck({ s }: { s: StuckRun }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "drop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function press(kind: "retry" | "drop") {
    setBusy(kind);
    setError(null);
    try {
      const out = kind === "retry" ? await retryRunAction(s.runId) : await controlRunAction(s.runId, "drop");
      if (out.ok) router.refresh();
      else setError(out.error ?? "ทำรายการไม่สำเร็จ");
    } catch {
      setError("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      {s.poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
        <img src={posterUrl(s.poster)} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : <span className="size-12 shrink-0 rounded-md bg-[var(--ct-ground)]" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{s.title}</p>
        <p className="mt-0.5 break-words text-xs text-[var(--ct-warn-ink)]">{s.error ?? `กำลังทำอยู่หรือหยุดกลางทาง · เริ่ม ${at(s.createdAt)}`}</p>
        {error && <p role="alert" className="mt-1 text-xs text-[var(--ct-alert)]">{error}</p>}
      </div>
      <div className="flex gap-1.5">
        <button type="button" disabled={busy !== null} onClick={() => press("retry")} className={plain}>{busy === "retry" ? "กำลังลอง…" : "ลองใหม่"}</button>
        <button type="button" disabled={busy !== null} onClick={() => press("drop")} className={plain}>{busy === "drop" ? "กำลังเลิก…" : "เลิก"}</button>
      </div>
    </li>
  );
}

export function ResultsBoard({ data, days, capBaht }: { data: BoardData; days: 7 | 30; capBaht: number }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const controllable = new Set(data.controllable);

  async function refresh() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const out = await refreshResultsAction();
      if (!out.ok) setSyncNote(out.error);
      else if (out.errors.length > 0) setSyncNote(`อ่านบางบัญชีไม่ได้ — ${out.errors.join(" / ")}`);
      router.refresh();
    } catch {
      setSyncNote("การเชื่อมต่อหลุด ลองใหม่อีกครั้ง");
    } finally {
      setSyncing(false);
    }
  }

  const tiles = [
    { label: `ใช้ไป ${days} วัน`, value: baht(data.totals.spend) },
    { label: "แชท", value: data.totals.chats.toLocaleString("en-US") },
    { label: "เฉลี่ย/แชท", value: baht(data.totals.costPerChat) },
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-[var(--ct-ground)] px-3 py-2.5">
            <p className="text-xs text-[var(--ct-mute)]">{t.label}</p>
            <p className="text-lg font-semibold tabular-nums sm:text-xl">{t.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--ct-mute)]">
        <span>ค่าเฉลี่ยของเพจ 30 วัน {baht(data.baseline)}/แชท</span>
        <span>{data.fetchedAt ? `อัปเดตล่าสุด ${at(data.fetchedAt)}` : "ยังไม่มีตัวเลขจาก Facebook"}</span>
        <button type="button" onClick={refresh} disabled={syncing} className={`${plain} ml-auto`}>
          {syncing ? "กำลังอัปเดต…" : "อัปเดตผลตอนนี้"}
        </button>
      </div>
      {syncNote && <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>{syncNote}</p>}

      {data.stuck.length > 0 && (
        <section aria-label="รายการค้าง" className={`rounded-xl border px-3 sm:px-4 ${TONES.warn}`}>
          <h2 className="pt-3 text-sm font-medium">รายการค้าง {data.stuck.length} — ยิงไม่ครบ ยังไม่มีแอด</h2>
          <ul className="divide-y divide-[var(--ct-warn-line)]">
            {data.stuck.map((s) => <Stuck key={s.runId} s={s} />)}
          </ul>
        </section>
      )}

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-5 text-sm text-[var(--ct-mute)]">ยังไม่มีแอดที่รันในช่วงนี้ — เลือกโพสต์ในแท็บยิงแอด</p>
      ) : (
        <div className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] px-3 sm:px-4">
          <div aria-hidden className="hidden grid-cols-[3rem_minmax(0,1fr)_5rem_3.5rem_5rem_minmax(0,14rem)] gap-3 border-b border-[var(--ct-hair)] py-2 text-xs text-[var(--ct-mute)] md:grid">
            <span /><span>โพสต์ / แอด</span><span className="text-right">ใช้ไป</span><span className="text-right">แชท</span><span className="text-right">฿/แชท</span><span>แนะนำ</span>
          </div>
          <ul className="divide-y divide-[var(--ct-hair)]">
            {data.rows.map((r) => <Row key={r.adId} row={r} canControl={controllable.has(r.adId)} capBaht={capBaht} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
