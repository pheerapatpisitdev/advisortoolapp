"use client";
import { useState } from "react";
import { cancelPendingAds, connectAdAccounts } from "./actions";
import { ActionError, useAction } from "../pages/useAction";

export interface Choice { id: string; name: string }

/** Which of the ad accounts from this login to read. All ticked to start, as with the Pages. */
export function AccountPicker({ accounts }: { accounts: Choice[] }) {
  const { pending, error, run } = useAction();
  const [chosen, setChosen] = useState<string[]>(() => accounts.map((a) => a.id));

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const connect = () =>
    run(async () => {
      const failed = await connectAdAccounts(chosen);
      if (failed.length > 0) throw new Error(`เชื่อมไม่สำเร็จ: ${failed.join(" / ")}`);
    });

  return (
    <div>
      <p className="mb-3 text-sm text-[var(--bot-ink-foot)]">
        เข้าสู่ระบบแล้ว เลือกบัญชีโฆษณาที่จะให้หน้านี้อ่านตัวเลข ติ๊กได้หลายบัญชี
      </p>
      <ul className="mb-3 divide-y divide-[var(--bot-line)] rounded-md border border-[var(--bot-line)]">
        {accounts.map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => toggle(a.id)} disabled={pending} className="size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block text-xs text-[var(--bot-ink-mute)]">{a.id}</span>
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
          {pending ? "กำลังเชื่อมต่อ…" : `เชื่อมต่อ ${chosen.length} บัญชีที่เลือก`}
        </button>
        <button type="button" disabled={pending} onClick={() => run(cancelPendingAds)} className="text-sm text-[var(--bot-ink-mute)] underline disabled:opacity-50">
          ยกเลิก
        </button>
      </div>
      <ActionError error={error} />
    </div>
  );
}
