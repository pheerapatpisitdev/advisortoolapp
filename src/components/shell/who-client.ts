"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Who } from "@/lib/shell/menu";

/**
 * Who is looking, as the sales pages learn it: they are built ahead of time and served to
 * whoever an advertisement sends, so they cannot ask on the server. The menu asks once the
 * page is up (owner chose ข, 2026-10-14), so an agent standing on one has the same menu as on
 * /home. Kept for the tab's life: moving between sales pages does not ask again or flicker.
 * One question however many parts of the shell ask it (the menu, and the New strip on the page).
 */
let seen: Who | null | undefined;
let asking: Promise<Who | null | undefined> | undefined;

function ask(): Promise<Who | null | undefined> {
  asking ??= fetch("/api/shell/who", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { who?: Who | null } | null) => {
      if (j) seen = j.who ?? null;
      return seen;
    })
    // the menu a customer sees, which is what it already shows
    .catch(() => undefined);
  return asking;
}

/** `given` is the layout's own answer: null for nobody, left out on pages that never ask */
export function useWho(given: Who | null | undefined): Who | null | undefined {
  const [found, setFound] = useState<Who | null | undefined>(seen);
  useEffect(() => {
    if (given !== undefined || seen !== undefined) return;
    let live = true;
    void ask().then((who) => { if (live && who !== undefined) setFound(who); });
    return () => { live = false; };
  }, [given]);
  // a page that did not ask, and nobody signed in: no account box, as before
  return given !== undefined ? given : found ?? undefined;
}

/**
 * The changed pages opened in this tab (ป้าย New, owner chose ก ก ก, 2026-11-24). The server keeps the mark
 * per person; this is so the menu drops New at once, where its `who` is not asked again on every page
 * (Studio's layout, the sales pages).
 */
const opened = new Set<string>();
const watchers = new Set<() => void>();
let version = 0;

export function markOpened(ids: string[]): void {
  const fresh = ids.filter((id) => !opened.has(id));
  if (fresh.length === 0) return;
  for (const id of fresh) opened.add(id);
  version += 1;
  for (const w of watchers) w();
  // not awaited and not retried: a mark that is lost leaves New up until the next visit
  void fetch("/api/shell/opened", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: fresh }), keepalive: true })
    .catch(() => { /* New stays up */ });
}

export const wasOpened = (id: string) => opened.has(id);

/** re-renders its caller when a page is opened */
export function useOpened(): number {
  return useSyncExternalStore((w) => { watchers.add(w); return () => { watchers.delete(w); }; }, () => version, () => 0);
}
