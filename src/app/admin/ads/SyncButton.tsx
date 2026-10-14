"use client";
import { useState } from "react";
import { syncNow } from "./actions";
import { ActionError, useAction } from "../pages/useAction";
import type { SyncResult } from "@/lib/ads/sync";

/**
 * Runs the same sync the cron runs and says what came back, here, because the cron's own
 * result goes only to a log nobody opens.
 */
export function SyncButton() {
  const { pending, error, run } = useAction();
  const [result, setResult] = useState<SyncResult | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(async () => { setResult(await syncNow()); })}
        className="rounded-md bg-[var(--bot-navy)] px-4 py-2 text-sm text-white hover:bg-[var(--bot-navy-lift)] disabled:opacity-50"
      >
        {pending ? "กำลังดึง…" : "ดึงตอนนี้"}
      </button>
      {result && result.errors.length === 0 && (
        <p className="mt-2 text-sm text-[var(--bot-ok)]">ดึงแล้ว {result.rows.toLocaleString("en-US")} แถว จาก {result.accounts} บัญชี</p>
      )}
      {result?.errors.map((e) => (
        <p key={e.actId} className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">
          {e.name}: {e.message}
        </p>
      ))}
      <ActionError error={error} />
    </div>
  );
}
