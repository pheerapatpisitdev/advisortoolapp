"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { posterUrl } from "@/lib/content/poster";
import { DEFAULT_RUN_BAHT, DEFAULT_RUN_DAYS, RUN_DAYS, spendCeiling, type RunDays } from "@/lib/ads/run-path";
import type { PostOutcome, RunResult } from "@/lib/ads/run";
import { XIcon } from "../ui/icons";
import type { Connection } from "./connection";
import { retryRunAction, runPostsAction, type PostCard } from "./run-actions";
import { field, plain, solid, TONES } from "./styles";

/**
 * ยิงแอดทักแชท (spec 2026-10-07): the ticked posts as Click-to-Messenger ads, running at once.
 * Two figures — baht a day for each post and how many days — and the most it can spend, said in
 * plain words before ยิงเลย. The ad account is asked only when more than one in baht is connected.
 * Once back, one line per post: running (and whether a boost became a new ad), or Meta's reason,
 * with ลองใหม่ where a row was made. The budget typed is kept in this browser for next time.
 */

const BUDGET_KEY = "ads-run-budget";
const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

function keptBudget(): string {
  try {
    const v = localStorage.getItem(BUDGET_KEY);
    return v && /^\d+$/.test(v) ? v : String(DEFAULT_RUN_BAHT);
  } catch {
    return String(DEFAULT_RUN_BAHT);
  }
}

export function RunDialog({ pageId, pageName, posts, connection, resultsHref, onClose, onRan }: {
  pageId: string;
  pageName: string;
  posts: PostCard[];
  connection: Connection;
  resultsHref: string;
  onClose: () => void;
  /** the posts that are running now, for the grid to untick */
  onRan: (contentIds: string[]) => void;
}) {
  const router = useRouter();
  const accounts = connection.accounts.filter((a) => a.currency === "THB");
  const cap = connection.maxDailyBudgetThb;
  const [actId, setActId] = useState(accounts[0]?.id ?? "");
  const [budget, setBudget] = useState(String(DEFAULT_RUN_BAHT));
  const [days, setDays] = useState<RunDays>(DEFAULT_RUN_DAYS);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [lost, setLost] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  // the budget last used here; read after the first render, since the server has no browser storage
  useEffect(() => { setBudget(keptBudget()); }, []);

  useEffect(() => {
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = scroll; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const tick = window.setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    const stay = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stay);
    return () => { window.clearInterval(tick); window.removeEventListener("beforeunload", stay); };
  }, [busy]);

  const amount = /^\d+$/.test(budget.trim()) ? Number(budget.trim()) : null;
  const over = amount !== null && amount > cap;
  const ready = Boolean(actId) && amount !== null && amount >= 1 && !over && posts.length > 0;

  async function run() {
    if (!ready || busy) return;
    setBusy(true);
    setSeconds(0);
    setLost(false);
    try { localStorage.setItem(BUDGET_KEY, String(amount)); } catch { /* not kept */ }
    try {
      const out = await runPostsAction({ pageId, actId, contentIds: posts.map((p) => p.id), dailyBudgetBaht: amount!, days });
      setResult(out);
      if (out.ok) onRan(out.outcomes.filter((o) => o.ok).map((o) => o.contentId));
    } catch {
      setLost(true);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function retry(o: PostOutcome) {
    if (!o.runId || retrying) return;
    setRetrying(o.runId);
    try {
      const again = await retryRunAction(o.runId);
      setResult((r) => (r && r.ok ? { ok: true, outcomes: r.outcomes.map((x) => (x.runId === o.runId ? { ...again, contentId: x.contentId } : x)) } : r));
      if (again.ok) onRan([o.contentId]);
    } catch {
      setLost(true);
    } finally {
      setRetrying(null);
      router.refresh();
    }
  }

  const titleOf = (id: string) => posts.find((p) => p.id === id)?.title || "(ไม่มีหัวข้อ)";
  const posterOf = (id: string) => posts.find((p) => p.id === id)?.poster ?? null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="run-title" className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[var(--ct-scrim)] p-4">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="run-title" className="font-semibold">ยิงแอดทักแชท</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">ปุ่ม “ส่งข้อความ” เปิดแชทเพจ {pageName} บอทตอบต่อ · ไทย อายุ 20+</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิด" className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--ct-soft)] disabled:opacity-50">
            <XIcon className="size-5" />
          </button>
        </div>

        {!result && !lost && (
          <fieldset disabled={busy} className="m-0 min-w-0 space-y-3 border-0 p-0">
            <legend className="sr-only">งบ จำนวนวัน และบัญชีโฆษณา</legend>
            {accounts.length === 0 ? (
              <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.warn}`}>ยังไม่ได้เชื่อมบัญชีโฆษณาสกุลบาท — กดไอคอนตั้งค่าเพื่อเชื่อม</p>
            ) : accounts.length > 1 ? (
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">บัญชีโฆษณา</span>
                <select value={actId} onChange={(e) => setActId(e.target.value)} className={field}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                </select>
              </label>
            ) : (
              <p className="text-xs text-[var(--ct-mute)]">บัญชีโฆษณา <span className="font-medium text-[var(--ct-ink)]">{accounts[0].name}</span> · THB</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">งบต่อโพสต์/วัน (บาท)</span>
                <input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" inputMode="numeric" min={1} max={cap} step={1} className={`${field} tabular-nums`} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--ct-mute)]">นานกี่วัน</span>
                <select value={days} onChange={(e) => setDays(Number(e.target.value) as RunDays)} className={field}>
                  {RUN_DAYS.map((d) => <option key={d} value={d}>{d} วัน</option>)}
                </select>
              </label>
            </div>
            {over && (
              <p role="alert" className="text-xs font-medium text-[var(--ct-alert)]">เกินเพดาน {baht(cap)} ต่อโพสต์ต่อวัน — ลดงบก่อนจึงจะยิงได้</p>
            )}
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {posts.map((p) => (
                <li key={p.id} className="w-14 shrink-0">
                  {p.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                    <img src={posterUrl(p.poster)} alt={p.title} className="aspect-square w-full rounded-md object-cover" />
                  ) : <span className="block aspect-square w-full rounded-md bg-[var(--ct-ground)]" />}
                </li>
              ))}
            </ul>
            <p className="text-sm">
              {amount !== null && !over
                ? <>{posts.length} โพสต์ × {baht(amount)} × {days} วัน = <span className="font-semibold">ใช้สูงสุด {baht(spendCeiling(posts.length, amount, days))}</span></>
                : "ใส่งบต่อวันเป็นบาทเต็มจำนวน"}
            </p>
            <button type="button" onClick={run} disabled={!ready || busy} className={`${solid} w-full`}>
              {busy ? `กำลังยิงบน Facebook… ${seconds} วินาที` : "ยิงเลย"}
            </button>
            {busy && <p role="status" className="text-xs text-[var(--ct-mute)]">ราว 10 วินาทีต่อโพสต์ อย่าปิดหน้านี้จนกว่าจะเสร็จ</p>}
          </fieldset>
        )}

        {lost && (
          <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>
            การเชื่อมต่อหลุด ยังไม่รู้ว่ายิงไปถึงไหน — ดูแท็บผลแอดก่อนกดยิงซ้ำ
          </p>
        )}
        {result && !result.ok && (
          <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONES.bad}`}>{result.error}</p>
        )}
        {result?.ok && (
          <ul aria-live="polite" className="divide-y divide-[var(--ct-hair)] rounded-lg border border-[var(--ct-hair)]">
            {result.outcomes.map((o) => {
              const poster = posterOf(o.contentId);
              return (
                <li key={o.contentId} className="flex items-start gap-3 p-2">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
                    <img src={posterUrl(poster)} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                  ) : <span className="size-12 shrink-0 rounded-md bg-[var(--ct-ground)]" />}
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-medium">{titleOf(o.contentId)}</span>
                    <span className={`block break-words text-xs ${o.ok ? "text-[var(--ct-accent)]" : "text-[var(--ct-alert)]"}`}>
                      {o.ok ? (o.note ? `กำลังรัน · ${o.note}` : "กำลังรัน") : o.error}
                    </span>
                  </span>
                  {!o.ok && o.runId && (
                    <button type="button" onClick={() => retry(o)} disabled={retrying !== null} className={`${plain} shrink-0`}>
                      {retrying === o.runId ? "กำลังลอง…" : "ลองใหม่"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(result || lost) && (
          <div className="flex flex-wrap gap-2">
            <Link href={resultsHref} className={`${solid} inline-flex items-center no-underline`}>ดูผลแอด</Link>
            <button type="button" onClick={onClose} className={plain}>ปิด</button>
          </div>
        )}
      </div>
    </div>
  );
}
