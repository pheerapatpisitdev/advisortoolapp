"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markQuestionAnswered } from "../crm/actions";

/**
 * "ตอบแล้ว" on one question the assistant could not answer.
 *
 * One tap, no second step: it takes a question off a to-do list and deletes nothing, and a
 * list of ninety asking "แน่ใจไหม" ninety times is a list nobody works through. The refresh
 * afterwards is what takes the row away and brings the tab's count down; without it the row
 * stayed on screen until the page was reloaded by hand.
 */
export function Answered({ id }: { id: number }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          start(async () => {
            const res = await markQuestionAnswered(id);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        className="whitespace-nowrap rounded-lg border border-[var(--bot-line)] px-2.5 py-1.5 text-xs text-[var(--bot-ink-foot)] hover:bg-[var(--bot-band)] disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก…" : "ตอบแล้ว"}
      </button>
      {error && <span className="text-xs text-[var(--bot-red-ink)]">{error}</span>}
    </span>
  );
}
