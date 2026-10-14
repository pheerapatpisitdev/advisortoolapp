"use client";
import { useState, useTransition } from "react";

/**
 * Runs a server action and keeps the reason it failed.
 *
 * These buttons used to drop the promise with `void`, so a rejected action left the button
 * looking untouched and the person guessing. An expired PIN session is the common one: the
 * page still renders, and only the action knows the session has gone.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      }
    });

  return { pending, error, run };
}

export function ActionError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-2 rounded-md bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]">{error}</p>;
}
