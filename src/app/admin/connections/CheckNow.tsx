"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkNowAction } from "./actions";

/** The page's one button: ask all four ways in again, then show what came back. */
export function CheckNow({ checkedAt }: { checkedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    const r = await checkNowAction().catch(() => ({ ok: false as const, error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" }));
    setBusy(false);
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  return (
    <div className="grid justify-items-end gap-1">
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="rounded-md border border-[var(--bot-navy)] bg-[var(--bot-navy)] px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "กำลังตรวจ…" : "ตรวจตอนนี้"}
      </button>
      <span className="text-xs text-[var(--bot-ink-mute)]">{checkedAt}</span>
      {error && <span role="alert" className="text-xs text-[var(--bot-red-ink)]">{error}</span>}
    </div>
  );
}
