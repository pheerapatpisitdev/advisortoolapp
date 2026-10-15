"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * The calendar's Page switch (owner, 2026-10-15, option ก): still one Page at a time, but chosen
 * here rather than by going back to its card on /studio. `hrefs` keeps the month and the view.
 */
export function PagePicker({ pages, current, hrefs }: {
  pages: { pageId: string; pageName: string }[];
  current: string;
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      id="calendar-page"
      aria-label="เลือกเพจ"
      value={current}
      disabled={pending}
      onChange={(e) => start(() => router.push(hrefs[e.target.value]))}
      className="min-h-tap max-w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 text-base font-normal disabled:opacity-60"
    >
      {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
    </select>
  );
}
