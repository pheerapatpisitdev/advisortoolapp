"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markUpdatesRead } from "../whats-new/actions";

/**
 * The bar under the greeting while anything in มีอะไรใหม่ is unread (owner chose 1ข, 2026-11-14, mockup
 * https://claude.ai/artifact/NW7M5MzvhWiZHymbyU34hs): how many, the first titles, the way there, and × to put
 * it away, which marks them read. It comes back with the next update.
 */
export function NewsBar({ count, titles }: { count: number; titles: string }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const dismiss = () => {
    setGone(true);
    markUpdatesRead().then((r) => { if (r.ok) router.refresh(); });
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3.5 py-2.5 text-sm"
      style={{ background: "var(--bot-navy-soft)", borderColor: "var(--bot-blue)", color: "var(--bot-navy)" }}
    >
      <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-full" style={{ background: "var(--bot-navy)", color: "var(--bot-surface)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2H5zM10 20.5a2.2 2.2 0 0 0 4 0" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <b className="block">มีอัปเดตใหม่ {count} เรื่อง</b>
        <span className="block text-[13px]" style={{ color: "var(--bot-navy-lift)" }}>{titles}</span>
      </div>
      <Link href="/whats-new" className="font-semibold underline underline-offset-[3px]" style={{ color: "var(--bot-navy)" }}>ดูว่ามีอะไรใหม่</Link>
      <button type="button" onClick={dismiss} aria-label="ปิดแถบนี้ (นับว่าอ่านแล้ว)" title="ปิด" className="-mr-1 rounded px-1.5 text-xl leading-none" style={{ color: "var(--hm-mute)" }}>×</button>
    </div>
  );
}
