"use client";
import { useState, useTransition } from "react";
import type { DemoView } from "@/lib/auth/demo";
import { saveDemoCap, toggleDemo, wipeDemoNow } from "./demo-actions";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** บัญชีสาธิต (owner chose 1ก 2ข 3ก, 2026-11-11, mockup Fm1t9Ejk): one row, as the mockup drew it. */
export function DemoAccount({ view }: { view: DemoView | null }) {
  const [cap, setCap] = useState(view ? String(view.capSatang / 100) : "300");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!view) return <p role="alert" className="text-sm text-[var(--bot-red-ink)]">อ่านบัญชีสาธิตไม่ได้ ลองโหลดหน้าใหม่</p>;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    setError(undefined);
    const r = await fn().catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ" }));
    if (!r.ok) setError(r.error ?? "ทำรายการไม่สำเร็จ");
    else after?.();
  });

  const pct = view.capSatang > 0 ? Math.min(100, Math.round((view.todaySatang / view.capSatang) * 100)) : 100;
  const cell = "px-3 py-2 text-sm tabular-nums text-[var(--bot-ink)]";
  const head = "px-3 py-2 text-left text-xs font-semibold text-white";

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-[var(--bot-line)]">
        <table className="w-full min-w-[560px] border-collapse">
          <thead className="bg-[var(--bot-navy)]">
            <tr><th className={head}>รหัส</th><th className={head}>สถานะ</th><th className={head}>ใช้ไปวันนี้</th><th className={head}>ใช้ไปเดือนนี้</th><th className={head}>เพดานต่อวัน</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${cell} font-medium`}>012345</td>
              <td className={cell}>
                <button
                  type="button" role="switch" aria-checked={view.open} disabled={pending}
                  onClick={() => run(() => toggleDemo(!view.open))}
                  className="inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <span className={`relative h-5 w-9 rounded-full ${view.open ? "bg-[var(--bot-ok)]" : "bg-[var(--bot-line)]"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${view.open ? "right-0.5" : "left-0.5"}`} />
                  </span>
                  <span className="text-sm font-semibold">{view.open ? "เปิด" : "ปิด"}</span>
                </button>
              </td>
              <td className={cell}>
                {baht(view.todaySatang)}
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--bot-line)]">
                  <div className={`h-full ${pct >= 80 ? "bg-[var(--bot-red)]" : "bg-[var(--bot-navy)]"}`} style={{ width: `${pct}%` }} />
                </div>
              </td>
              <td className={cell}>{baht(view.monthSatang)}</td>
              <td className={cell}>
                {editing ? (
                  <span className="inline-flex items-center gap-2">
                    ฿<input
                      id="demo-cap" aria-label="เพดานต่อวัน (บาท)" value={cap} inputMode="numeric"
                      onChange={(e) => setCap(e.target.value.replace(/[^\d]/g, ""))}
                      className="w-20 rounded border border-[var(--bot-line)] px-2 py-1 text-sm tabular-nums"
                    />
                    <button type="button" disabled={pending || cap === ""} onClick={() => run(() => saveDemoCap(cap), () => setEditing(false))}
                      className="rounded bg-[var(--bot-navy)] px-2 py-1 text-xs text-white disabled:opacity-40">บันทึก</button>
                    <button type="button" onClick={() => setEditing(false)} className="text-xs text-[var(--bot-ink-mute)] underline">ยกเลิก</button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    {baht(view.capSatang).replace(".00", "")}
                    <button type="button" onClick={() => setEditing(true)} className="rounded border border-[var(--bot-line)] px-2 py-0.5 text-xs">แก้</button>
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--bot-ink-mute)]">
        <span>
          ล้างงานที่ลูกค้าสร้างทุกคืนตี 3
          {view.wipedAt ? ` · ล้างล่าสุด ${new Date(view.wipedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        <button type="button" disabled={pending} onClick={() => run(() => wipeDemoNow())}
          className="rounded border border-[var(--bot-line)] px-2 py-1 text-xs text-[var(--bot-ink)] disabled:opacity-50">ล้างตอนนี้</button>
      </div>
      {error && <p role="alert" className="text-xs text-[var(--bot-red-ink)]">{error}</p>}
    </div>
  );
}
