"use client";
import { useState } from "react";
import { cancelPending, connectPages } from "./actions";
import { ActionError, useAction } from "./useAction";

export interface Choice { id: string; name: string }

/**
 * Which of the Pages from this login to connect.
 *
 * Ticked, not pressed one at a time: connecting used to end the login, so a person with two
 * Pages had to go round through Facebook twice — and the second trip is what revoked the
 * first Page.
 *
 * Only the Pages already connected start ticked. Everything Facebook handed over used to,
 * on the theory that a Page nobody wanted would not have been ticked on Meta's screen — but
 * Meta's screen lists every Page the account admins, and a login left half-finished came back
 * the next day with all four of the owner's Pages ticked and one tap away from the bot
 * answering on Pages it was never meant for. A connected Page is ticked because its fresh
 * permission from this login is what keeps it answering (the login replaced the old one);
 * a new Page is ticked by the person, on purpose.
 */
export function PagePicker({ pages, connectedIds = [] }: { pages: Choice[]; connectedIds?: string[] }) {
  const { pending, error, run } = useAction();
  const [chosen, setChosen] = useState<string[]>(() =>
    pages.filter((p) => connectedIds.includes(p.id)).map((p) => p.id),
  );

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const connect = () =>
    run(async () => {
      const failed = await connectPages(chosen);
      if (failed.length > 0) throw new Error(`เชื่อมไม่สำเร็จ: ${failed.join(" / ")}`);
    });

  return (
    <div>
      <p className="mb-3 text-sm text-[var(--bot-ink-foot)]">
        ติ๊กเพจที่จะให้บอทตอบ ติ๊กได้หลายเพจและเชื่อมพร้อมกันในครั้งเดียว
        เพจที่ต่อไว้แล้วติ๊กไว้ให้ก่อน เพราะต้องรับสิทธิ์ชุดใหม่จากการเข้าสู่ระบบครั้งนี้
      </p>
      <ul className="mb-3 divide-y divide-[var(--bot-line)] rounded-md border border-[var(--bot-line)]">
        {pages.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                checked={chosen.includes(p.id)}
                onChange={() => toggle(p.id)}
                disabled={pending}
                className="size-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {p.name}
                  {connectedIds.includes(p.id) && (
                    <span className="ml-2 text-xs font-normal text-[var(--bot-ok)]">ต่ออยู่แล้ว</span>
                  )}
                </span>
                <span className="block text-xs text-[var(--bot-ink-mute)]">{p.id}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending || chosen.length === 0}
          onClick={connect}
          className="rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm text-white hover:bg-[var(--bot-navy-lift)] disabled:opacity-50"
        >
          {pending ? "กำลังเชื่อมต่อ…" : `เชื่อมต่อ ${chosen.length} เพจที่เลือก`}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => cancelPending())}
          className="text-sm text-[var(--bot-ink-mute)] underline disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
      <ActionError error={error} />
    </div>
  );
}
