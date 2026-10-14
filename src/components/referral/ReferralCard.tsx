"use client";
import { useState } from "react";
import { priceLabel } from "@/components/shell/PassReminder";
import { NEW_REWARD_MS, tally, type FriendView } from "@/lib/referrals/referral";
import type { ReferralCardData } from "@/lib/referrals/card";

/**
 * ชวนเพื่อน (owner, 2026-10-14; mockup v5): the viewer's own invitation link, how to send it,
 * and the friends it brought. On /membership (studio theme, --ct-*) and on /home (--hm-*): each
 * colour reads the one page's token and falls back to the other's.
 */
const panel = "bg-[var(--ct-panel,var(--hm-panel))]";
const hair = "border-[var(--ct-hair,var(--hm-hair))]";
const mute = "text-[var(--ct-mute,var(--hm-mute))]";
const solid = "bg-[var(--ct-solid,var(--hm-solid))] text-[var(--ct-solid-ink,var(--hm-solid-ink))]";
const ground = "bg-[var(--ct-ground,var(--hm-ground))]";

const TZ = "Asia/Bangkok";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { timeZone: TZ, day: "numeric", month: "short" });

/** "+3 วัน" for a member, "฿10" for an agent */
export const rewardLabel = (kind: ReferralCardData["kind"], n: number) => (kind === "member" ? `+${n} วัน` : priceLabel(n));

function pill(f: FriendView, kind: ReferralCardData["kind"]): { text: string; tone: "ok" | "wait" | "no" } {
  switch (f.status) {
    case "rewarded": return { text: `${rewardLabel(kind, f.reward)}${f.rewardedAt ? ` · ${shortDate(f.rewardedAt)}` : ""}`, tone: "ok" };
    case "capped": return { text: "จ่ายแล้ว · ครบเพดานเดือนนั้น", tone: "wait" };
    case "revoked": return { text: "ยกเลิก · เพื่อนขอเงินคืน", tone: "no" };
    case "trial": return { text: "ทดลองใช้ · รอจ่าย", tone: "wait" };
    case "lapsed": return { text: "หมดทดลอง · ไม่ได้จ่าย", tone: "no" };
    case "waiting": return { text: "สมัครแล้ว · รอจ่าย", tone: "wait" };
  }
}

const TONE = {
  ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
  wait: "bg-[var(--ct-warn-bg,var(--bot-sand-soft))] text-[var(--ct-warn-ink,var(--bot-sand-ink))]",
  no: "bg-[var(--ct-alert-bg,var(--bot-red-soft))] text-[var(--ct-alert,var(--bot-red-ink))]",
};

export function ReferralCard({ card, now }: { card: ReferralCardData; now: string }) {
  const [copied, setCopied] = useState(false);
  const { joined, paid, reward } = tally(card.friends);
  const each = rewardLabel(card.kind, card.per);
  const gift = card.kind === "member" ? `ใช้ฟรี ${each}` : `${each} เข้ากระเป๋า Studio`;
  const message = `มาใช้ AdvisorTool ด้วยกัน เครื่องคิดเบี้ย ถาม AI และ Studio ทำโพสต์ สมัครด้วย Gmail ทดลองใช้ฟรี ${card.link}`;
  const fresh = card.friends.filter((f) => f.status === "rewarded" && f.rewardedAt
    && new Date(now).getTime() - new Date(f.rewardedAt).getTime() < NEW_REWARD_MS);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // a browser that refuses the clipboard: the link stays on screen to copy by hand
    }
  };
  // the phone's own share sheet reaches Messenger and the rest; without one, copying is the way
  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        return; // closed by the person, or refused: nothing to say
      }
    }
    await copy();
  };

  return (
    <section className={`rounded-xl border ${hair} ${panel} p-4`} aria-labelledby="referral-title">
      <h2 id="referral-title" className="font-semibold">ชวนเพื่อน รับ{card.kind === "member" ? `ใช้ฟรี ${each}` : ` ${each}`} ต่อคน</h2>
      <p className={`mt-1 text-sm ${mute}`}>เพื่อนสมัครผ่านลิงก์นี้และจ่ายค่าสมาชิกครั้งแรก คุณได้{gift}</p>

      {fresh.length > 0 && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${TONE.ok}`}>
          🎉 {fresh.map((f) => `คุณ${f.name}`).join(", ")} จ่ายค่าสมาชิกแล้ว คุณได้{card.kind === "member" ? `ใช้ฟรี ` : " "}{rewardLabel(card.kind, fresh.reduce((s, f) => s + f.reward, 0))}
        </p>
      )}

      <div className={`mt-3 flex items-center gap-2 rounded-lg border ${hair} ${ground} py-1.5 pl-3 pr-1.5`}>
        <code className="min-w-0 flex-1 truncate text-sm">{card.link.replace(/^https?:\/\//, "")}</code>
        <button type="button" onClick={copy} className={`min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold ${solid}`}>
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={`https://line.me/R/share?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
           className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold no-underline ${solid}`}>
          ส่งทาง LINE
        </a>
        <button type="button" onClick={share}
                className="min-h-11 rounded-lg border border-[var(--ct-solid,var(--hm-solid))] text-sm font-semibold text-[var(--ct-accent,var(--hm-accent))]">
          แชร์ช่องทางอื่น
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[["สมัครแล้ว", String(joined)], ["จ่ายแล้ว", String(paid)], ["ได้รับ", rewardLabel(card.kind, reward)]].map(([label, value]) => (
          <div key={label} className={`rounded-lg ${ground} px-2 py-2`}>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            <dt className={`text-xs ${mute}`}>{label}</dt>
          </div>
        ))}
      </dl>

      {card.friends.length > 0 && (
        <ul className={`mt-3 divide-y rounded-lg border ${hair} divide-[var(--ct-hair,var(--hm-hair))]`}>
          {card.friends.map((f, i) => {
            const p = pill(f, card.kind);
            return (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">คุณ{f.name}</span>
                <span className={`shrink-0 rounded-full px-2 text-xs ${TONE[p.tone]}`}>{p.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className={`mt-2 text-xs ${mute}`}>
        ได้สูงสุด {rewardLabel(card.kind, card.cap).replace(/^\+/, "")} ต่อเดือน · ถ้าเพื่อนขอเงินคืน รางวัลจะถูกหักคืน
      </p>
    </section>
  );
}
