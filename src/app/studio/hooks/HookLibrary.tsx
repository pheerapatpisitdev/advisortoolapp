"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HOOK_CATEGORIES, HOOK_CATEGORY_LABEL, type HookCategory, type HookTemplate } from "@/lib/content/hooks";
import { CheckIcon, SearchIcon } from "../ui/icons";

/**
 * The formula library as Maryjane's hook-library shows it: a search, a chip per category, and
 * one row per formula with how often it has been used and a way to use it now.
 *
 * "ใช้อันนี้" opens the workbench with the formula already chosen. A formula drawn from a post
 * says which hook it came from, so a good one can be traced back to the post that earned it —
 * to whoever may see that post, and to nobody else: the server leaves the example out for
 * everyone else (store.ts, examplesShown; it was shown to every tenant, review 2026-10-01).
 *
 * The number that leads is how many of its pieces went up on a Page (`posted`), and the list
 * is in that order: the count it had before went up for every piece written with it, the
 * trashed ones too, so the formulas that were tried most sat above the ones that worked.
 */

const WEEK = 7 * 24 * 60 * 60_000;

export function HookLibrary({ items, posted }: { items: HookTemplate[]; posted: Record<string, number> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HookCategory | "ALL">("ALL");
  const [copied, setCopied] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const searchId = useId();
  // the "copied" mark's timer, stopped if the page is left before it runs
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((h) =>
        (category === "ALL" || h.category === category)
        && (!q || h.template.toLowerCase().includes(q) || (h.exampleHook ?? "").toLowerCase().includes(q)))
      // what went up first, then what was written most; the list arrives in the second order already
      .sort((a, b) => (posted[b.id] ?? 0) - (posted[a.id] ?? 0));
  }, [items, query, category, posted]);
  const inCategory = useMemo(() => {
    const n = new Map<HookCategory, number>();
    for (const h of items) n.set(h.category, (n.get(h.category) ?? 0) + 1);
    return n;
  }, [items]);

  async function copy(h: HookTemplate) {
    try {
      await navigator.clipboard.writeText(h.template);
      setCopied(h.id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1500);
    } catch { /* the row still shows the text to select by hand */ }
  }

  const chipCls = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-panel)]"}`;

  return (
    <div className="mt-5 space-y-4">
      <div>
        <label htmlFor={searchId} className="sr-only">ค้นหาสูตรประโยคเปิด</label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ct-mute)]" />
          <input
            id={searchId} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสูตร เช่น ลูก, ภาษี, เรื่องที่ควรรู้"
            className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[var(--ct-accent)]"
          />
        </div>
      </div>
      <div role="group" aria-label="หมวดของสูตร" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={category === "ALL"} onClick={() => setCategory("ALL")} className={chipCls(category === "ALL")}>ทั้งหมด {items.length}</button>
        {HOOK_CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chipCls(category === c)}>
            {HOOK_CATEGORY_LABEL[c]} {inCategory.get(c) ?? 0}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--ct-line)] p-6 text-center text-sm text-[var(--ct-mute)]">ไม่พบสูตรที่ตรงกับคำค้น</p>
      ) : (
        <ul className="divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
          {shown.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-sm">
                  “{h.template}”
                  {h.seed
                    ? <span className="ml-2 text-xs text-[var(--ct-mute)]">ตั้งต้น</span>
                    : now - new Date(h.createdAt).getTime() < WEEK && <span className="ml-2 text-xs text-[var(--ct-accent)]">ใหม่</span>}
                </p>
                {h.exampleHook && <p className="mt-0.5 truncate text-xs text-[var(--ct-mute)]">จากโพสต์: {h.exampleHook}</p>}
              </div>
              <span className="shrink-0 rounded bg-[var(--ct-ground)] px-2 py-1 text-xs text-[var(--ct-mute)]">{HOOK_CATEGORY_LABEL[h.category]}</span>
              <span className="w-20 shrink-0 text-right leading-tight" title="ลงเพจหรือตั้งเวลาแล้ว · เขียนด้วยสูตรนี้ทั้งหมด">
                <span className={`block text-sm tabular-nums ${posted[h.id] ? "font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)]"}`}>ลงเพจ {posted[h.id] ?? 0}</span>
                <span className="block text-xs tabular-nums text-[var(--ct-mute)]">เขียน {h.useCount}</span>
              </span>
              <Link href={`/studio/write?hook=${h.id}`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]">ใช้อันนี้</Link>
              <button type="button" onClick={() => copy(h)} aria-live="polite" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]">
                {copied === h.id ? <><CheckIcon className="size-4 text-[var(--ct-accent)]" />คัดลอกแล้ว</> : "คัดลอก"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
