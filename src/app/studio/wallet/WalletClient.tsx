"use client";
import { useEffect, useState, useTransition } from "react";
import { cardAllowed, formatBaht, TOPUP_THB, type TopUpThb } from "@/lib/wallet/money";
import type { WalletEntry } from "@/lib/wallet/store";
import { startTopUp, topUpStatus } from "./actions";

const ROUND_NAMES: Record<string, string> = {
  "ai-write": "เขียนโพสต์", "ai-recruit": "หาทีม", "ai-knowledge": "ความรู้", "ai-draft": "เขียนเอง",
  "ai-claim": "รีวิวเคลม", "ai-draw": "วาดภาพ",
};

const entryLabel = (e: WalletEntry) =>
  e.kind === "topup" ? "เติมเงิน" : e.kind === "charge" ? ROUND_NAMES[e.round ?? ""] ?? "ใช้ AI" : `ปรับโดยเจ้าของ${e.note ? ` (${e.note})` : ""}`;

const signed = (satang: number) => `${satang >= 0 ? "+" : "−"}${formatBaht(Math.abs(satang))}`;

/** polls every two seconds for up to a minute after Stripe sends the agent back */
const POLL_MS = 2000;
const POLL_TRIES = 30;

export function WalletClient({ enabled, balanceSatang, entries, rounds, paid }: {
  enabled: boolean;
  balanceSatang: number;
  entries: WalletEntry[];
  rounds: { used: number; limit: number };
  paid: string | null;
}) {
  const [balance, setBalance] = useState(balanceSatang);
  const [waiting, setWaiting] = useState<"checking" | "late" | "failed" | null>(paid ? "checking" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!paid) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await topUpStatus(paid).catch(() => null);
      if (stop) return;
      if (r?.status === "paid") {
        setBalance(r.balanceSatang);
        setWaiting(null);
        // the history above was read before the money came: read the page again
        window.location.replace("/studio/wallet");
        return;
      }
      if (r?.status === "failed" || r?.status === "expired") return setWaiting("failed");
      if (++tries >= POLL_TRIES) return setWaiting("late");
      setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { stop = true; };
  }, [paid]);

  const topUp = (thb: TopUpThb) => start(async () => {
    setError(null);
    const r = await startTopUp(thb);
    if (r.ok) window.location.assign(r.url);
    else setError(r.error);
  });

  const freeLeft = Math.max(0, rounds.limit - rounds.used);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-5">
        <p className="text-sm text-[var(--ct-mute)]">ยอดในกระเป๋า</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatBaht(balance)}</p>
        <p className="mt-2 text-sm text-[var(--ct-mute)]">
          รอบฟรีเหลือ {freeLeft}/{rounds.limit} ครั้ง · หมดแล้วจึงตัดจากกระเป๋าตามต้นทุนจริงของงาน
        </p>
        {waiting === "checking" && <p className="mt-3 text-sm font-medium" role="status">กำลังยืนยันการชำระเงิน…</p>}
        {waiting === "late" && <p className="mt-3 text-sm" role="status">ยังไม่ได้รับการยืนยันจาก Stripe — ยอดจะเข้าเองเมื่อ Stripe แจ้ง ลองเปิดหน้านี้ใหม่ภายหลังนะครับ</p>}
        {waiting === "failed" && <p className="mt-3 text-sm text-[var(--ct-warn-ink)]" role="status">การชำระเงินไม่สำเร็จ ยังไม่ได้ตัดเงินครับ</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">เติมเงิน</h2>
        {enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOPUP_THB.map((thb) => (
                <button key={thb} type="button" disabled={pending} onClick={() => topUp(thb)}
                  className="min-h-14 rounded-lg border border-[var(--ct-line)] px-3 py-2 text-left disabled:opacity-50">
                  <span className="block text-base font-semibold">฿{thb}</span>
                  <span className="block text-xs text-[var(--ct-mute)]">{cardAllowed(thb) ? "PromptPay / บัตร" : "PromptPay"}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-[var(--ct-warn-ink)]" role="alert">{error}</p>}
            <p className="text-xs text-[var(--ct-mute)]">ชำระผ่าน Stripe · เงินในกระเป๋าไม่มีวันหมดอายุ และใช้ได้กับ AI ใน Studio เท่านั้น</p>
          </>
        ) : (
          <p className="text-sm text-[var(--ct-mute)]">ตอนนี้ยังเติมเงินไม่ได้ครับ</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">ประวัติ</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--ct-mute)]">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{entryLabel(e)}</span>
                  <span className="block text-xs text-[var(--ct-mute)]">{new Date(e.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${e.amountSatang >= 0 ? "font-medium" : "text-[var(--ct-mute)]"}`}>{signed(e.amountSatang)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
