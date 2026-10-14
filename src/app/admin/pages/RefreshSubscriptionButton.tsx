"use client";
import { refreshSubscription } from "./actions";
import { ActionError, useAction } from "./useAction";

export function RefreshSubscriptionButton({ pageId }: { pageId: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => refreshSubscription(pageId))}
        className="rounded-md border border-[var(--bot-line)] px-3 py-1.5 text-sm text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-50"
      >
        {pending ? "กำลังสมัคร…" : "สมัครรับเหตุการณ์ใหม่"}
      </button>
      <ActionError error={error} />
    </>
  );
}
