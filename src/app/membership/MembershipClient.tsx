"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ReferralCard } from "@/components/referral/ReferralCard";
import { priceLabel } from "@/components/shell/PassReminder";
import { daysLeft, onTrial, PASS_DAYS, type PassRow, type Period } from "@/lib/members/pass";
import type { ReferralCardData } from "@/lib/referrals/card";
import { shortName } from "@/lib/referrals/referral";
import { CARD_FROM_THB, formatBaht } from "@/lib/wallet/money";
import { passConfirmed, startPass } from "./actions";

/** The pass as the page reads it: PassState with its dates as ISO strings. */
export type PassView =
  | { status: "live"; kind: Period["kind"]; end: string; periodEnd: string }
  | { status: "expired"; end: string }
  | { status: "none" };

const TZ = "Asia/Bangkok";
const fullDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short" });

/** one line of the history, in the mockup's words (owner, 2026-10-13) */
function historyLabel(r: PassRow): string {
  switch (r.kind) {
    case "trial": return `ทดลองใช้ฟรี · +${r.days} วัน`;
    case "paid": return `จ่าย ${priceLabel(r.amountSatang ?? 0)} · +${r.days} วัน`;
    case "granted": return `เพิ่มให้โดยเจ้าของ · +${r.days} วัน${r.note ? ` · ${r.note}` : ""}`;
    // the note is the friend's name (supabase/migrations/20261103_referrals.sql)
    case "referral": return `ชวนเพื่อน${r.note ? ` · คุณ${shortName(r.note)}` : ""} · +${r.days} วัน`;
    // the webhook notes "refund …" or "dispute …" (src/lib/members/pass-store.ts revokePaidPass)
    case "revoked": return r.note?.startsWith("dispute") ? "ยกเลิกเพราะโต้แย้งการชำระเงิน"
      // a friend's refund takes back the days they earned; the note says which (src/lib/wallet/events.ts)
      : r.note?.startsWith("เพื่อน") ? `ยกเลิกวันชวนเพื่อน เพราะ${r.note}`
      : "ยกเลิกเพราะคืนเงิน";
  }
}

/** polls every two seconds for up to thirty after Stripe sends the member back */
const POLL_MS = 2000;
const POLL_TRIES = 15;

/** a used-up bar: what is left of how many */
function Meter({ label, left, of, unit }: { label: string; left: number; of: number; unit: string }) {
  const share = of > 0 ? Math.min(100, Math.round((left / of) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm tabular-nums">
        <span>{label}</span>
        <span><b>{left}</b> / {of} {unit}</span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[var(--ct-soft)]" role="presentation">
        <div className="h-full rounded-full bg-[var(--ct-solid)]" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

/** what every 30 days brings, on the live and the expired page alike (owner, 2026-10-14; mockup YK9xNTXv) */
function PassGets({ rounds, videos, detail }: { rounds: number; videos: number; detail: boolean }) {
  const items: [string, string][] = [
    ["ถาม AI ไม่จำกัด", "วางแผนประกัน ถามเบี้ย ถามเงื่อนไข"],
    [`Studio ฟรี ${rounds} รอบ`, "เขียนโพสต์ วาดรูป ภาพปกคลิป ถอดรูปเป็น prompt"],
    ...(videos > 0 ? [[`วิดีโอนำเสนอฟรี ${videos} คลิป`, "คลิปนำเสนอแบบประกันพร้อมเสียงพากย์"] as [string, string]] : []),
  ];
  return (
    <ul className="space-y-1.5">
      {items.map(([what, more]) => (
        <li key={what} className="grid grid-cols-[1.25rem_1fr] gap-1.5 text-sm">
          <span aria-hidden className="font-bold text-[var(--bot-ok)]">✓</span>
          <span>
            {what}
            {detail && <span className="block text-xs text-[var(--ct-mute)]">{more}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MembershipClient({ on, pass, now, rounds, videos, passRounds, passVideos, priceSatang, balanceSatang, rows, paid, referral = null }: {
  /** false while the owner has the pass switched off: members use the app free */
  on: boolean;
  pass: PassView;
  now: string;
  /** this period's free Studio rounds; null when they could not be counted or there is no live pass */
  rounds: { left: number; limit: number } | null;
  /** this period's free วิดีโอนำเสนอ; null when they could not be counted or there is no live pass */
  videos: { left: number; of: number } | null;
  /** what a renewal brings, from the owner's settings */
  passRounds: number;
  passVideos: number;
  priceSatang: number;
  /** null when the wallet could not be read */
  balanceSatang: number | null;
  rows: PassRow[];
  /** the Checkout Session Stripe came back with, if any */
  paid: string | null;
  /** ชวนเพื่อน (owner, 2026-10-14); null when off or unreadable */
  referral?: ReferralCardData | null;
}) {
  const router = useRouter();
  const [waiting, setWaiting] = useState<"checking" | "late" | null>(paid ? "checking" : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!paid) return;
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const done = await passConfirmed(paid).catch(() => false);
      if (stop) return;
      if (done) {
        setWaiting(null);
        // the status above was read before the days came: read the page again
        router.refresh();
        return;
      }
      if (++tries >= POLL_TRIES) {
        setWaiting("late");
        router.refresh();
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => { stop = true; };
  }, [paid, router]);

  const renew = () => start(async () => {
    setError(null);
    const r = await startPass();
    if (r.ok) window.location.assign(r.url);
    else setError(r.error);
  });

  if (!on) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <section className="rounded-xl bg-[var(--ct-soft)] p-5 text-[var(--ct-accent)]">
          <p className="text-sm">สถานะสมาชิก</p>
          <p className="mt-1 text-2xl font-semibold">ตอนนี้สมาชิกใช้งานได้ฟรี</p>
          <p className="mt-1 text-sm">ถาม AI และ Studio ใช้ได้ตามปกติ</p>
        </section>
      </div>
    );
  }

  const nowDate = new Date(now);
  const live = pass.status === "live" ? pass : null;
  // the owner's list uses the same rule (review, 2026-10-13); the view has no period start or
  // row id, which onTrial does not read, so the period's end stands in for its start
  const trial = live != null && onTrial({
    status: "live",
    end: new Date(live.end),
    period: { rowId: 0, kind: live.kind, start: new Date(live.periodEnd), end: new Date(live.periodEnd) },
  });
  const left = live ? daysLeft(new Date(live.end), nowDate) : 0;
  const card = priceSatang >= CARD_FROM_THB * 100;
  const method = card ? "พร้อมเพย์ หรือ บัตร" : "จ่ายด้วยพร้อมเพย์";
  const history = [...rows].reverse();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-xl font-semibold">สมาชิก</h1>

      {live ? (
        <section className={`rounded-xl p-5 ${trial ? "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]" : "bg-[var(--ct-soft)] text-[var(--ct-accent)]"}`}>
          <p className="text-sm">สถานะสมาชิก</p>
          <p className="mt-1 text-2xl font-semibold">{trial ? "ทดลองใช้ฟรีถึง" : "ใช้ได้ถึง"} {fullDate(live.end)}</p>
          <p className="mt-1 text-sm">เหลือ {left} วัน · ถาม AI ไม่จำกัด</p>
        </section>
      ) : (
        <section className="rounded-xl bg-[var(--ct-alert-bg)] p-5 text-[var(--ct-alert)]">
          <p className="text-sm">สถานะสมาชิก</p>
          <p className="mt-1 text-2xl font-semibold">หมดอายุแล้ว</p>
          <p className="mt-1 text-sm">
            {pass.status === "expired" ? `เมื่อ ${fullDate(pass.end)} · ` : ""}ต่ออายุเพื่อใช้ต่อ
          </p>
        </section>
      )}

      {!live && (
        <section className="space-y-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <p className="font-semibold">ต่ออายุ {priceLabel(priceSatang)} ได้ {PASS_DAYS} วัน</p>
          <PassGets rounds={passRounds} videos={passVideos} detail={false} />
        </section>
      )}

      {waiting === "checking" && <p className="text-sm font-medium" role="status">กำลังยืนยันการชำระเงิน…</p>}
      {waiting === "late" && <p className="text-sm" role="status">ยังไม่ได้รับการยืนยันจาก Stripe — วันจะเพิ่มเข้ามาเองเมื่อ Stripe แจ้ง ลองเปิดหน้านี้ใหม่ภายหลังนะครับ</p>}

      {live && (rounds || videos) && (
        <section className="space-y-2.5 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <p className="font-semibold">รอบนี้เหลือ</p>
          {rounds && <Meter label="Studio ฟรี" left={rounds.left} of={rounds.limit} unit="รอบ" />}
          {videos && videos.of > 0 && <Meter label="วิดีโอนำเสนอฟรี" left={videos.left} of={videos.of} unit="คลิป" />}
          <p className="text-sm text-[var(--ct-mute)]">
            {trial
              ? `ช่วงทดลองได้ตามนี้ · จ่ายแล้วได้ใหม่ทุก ${PASS_DAYS} วัน`
              : `ได้ใหม่ ${shortDate(live.periodEnd)} · ที่เหลือไม่สะสม · เกินแล้วหักกระเป๋าตามราคา`}
          </p>
        </section>
      )}

      {live && (
        <section className="space-y-2 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <p className="font-semibold">ทุก {PASS_DAYS} วันได้</p>
          <PassGets rounds={passRounds} videos={passVideos} detail />
        </section>
      )}

      {referral && <ReferralCard card={referral} now={now} />}

      <div className="space-y-2">
        <button type="button" disabled={pending} onClick={renew}
          className="block w-full rounded-xl bg-[var(--ct-solid)] px-4 py-3 text-center font-semibold text-[var(--ct-solid-ink)] disabled:opacity-50">
          {live && !trial ? "ต่ออายุอีก" : "ต่ออายุ"} {PASS_DAYS} วัน {priceLabel(priceSatang)}
          <span className="block text-xs font-normal opacity-85">
            {live && !trial ? `นับต่อจาก ${shortDate(live.end)} · ${method}` : method}
          </span>
        </button>
        {error && <p className="text-sm text-[var(--ct-alert)]" role="alert">{error}</p>}
        {trial && <p className="text-xs text-[var(--ct-mute)]">จ่ายตอนนี้ วันทดลองที่เหลือไม่หาย {PASS_DAYS} วันนับต่อจาก {shortDate(live.end)}</p>}
        {!live && balanceSatang !== null && balanceSatang > 0 && (
          <p className="text-xs text-[var(--ct-mute)]">เงินในกระเป๋า Studio {formatBaht(balanceSatang)} ยังอยู่ครบ ใช้ได้อีกเมื่อต่ออายุ</p>
        )}
      </div>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">ประวัติ</h2>
          <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)]">
            {history.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0">{historyLabel(r)}</span>
                <span className="shrink-0 tabular-nums text-[var(--ct-mute)]">{fullDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
