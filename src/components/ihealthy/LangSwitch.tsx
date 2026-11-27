"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { HTML_LANG, LANG_COOKIE, LANG_NAME, LANGS, type Lang } from "@/lib/ihealthy-lang";

/**
 * The languages, each written in itself — a reader who cannot read Thai is looking for
 * "中文", not for the Thai word for Chinese.
 *
 * One button at the top right that opens a card of the seven (owner, 2026-11-23, ก on mockup
 * https://claude.ai/artifact/FHVRdRXnzHYhcQ2vqHu1x1). It used to be a row of seven buttons,
 * which ran wider than a phone: ไทย and English were pushed off the left edge and sat under
 * the round ☰ menu button, where they could not be tapped.
 *
 * The choice is a cookie and a refresh rather than a second address: the page is rendered on
 * the server, contract prose and all, and the refresh keeps everything the reader had set in
 * the form — a refreshed route keeps its client state — while the words around it change.
 * No expiry on the cookie, so it lasts as long as the browser session and no longer.
 */
export function LangSwitch(
  { lang, label, cookie = LANG_COOKIE, path = "/ihealthy-ultra" }:
    {
      lang: Lang; label: string;
      /** the cookie and the address it is scoped to; iHealthy's own unless a page has its own (PA) */
      cookie?: string; path?: string;
    },
) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const choose = (next: Lang) => {
    close(true);
    if (next === lang) return;
    document.cookie = `${cookie}=${next}; path=${path}; SameSite=Lax`;
    start(() => router.refresh());
  };

  // A tap anywhere else, or Escape, puts the card away.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    // the keyboard lands on the language already chosen, as a native list would
    items.current[LANGS.indexOf(lang)]?.focus();
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open, lang]);

  const step = (e: React.KeyboardEvent, at: number) => {
    const move = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    items.current[(at + move + LANGS.length) % LANGS.length]?.focus();
  };

  return (
    <nav aria-label={label} aria-busy={pending} className="flex justify-end pt-4 print:hidden">
      <div ref={wrap} className="relative">
        <button
          ref={button} type="button" aria-haspopup="menu" aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-2.5 py-1.5 text-xs text-[var(--lg-white)] transition-opacity ${pending ? "opacity-60" : ""}`}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-none stroke-[var(--lg-mute)]" strokeWidth={1.6}>
            <circle cx="8" cy="8" r="6.2" />
            <path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" />
          </svg>
          <span lang={HTML_LANG[lang]}>{LANG_NAME[lang]}</span>
          <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 fill-none stroke-[var(--lg-mute)] transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.6}>
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        {open && (
          <div
            role="menu" aria-label={label}
            className="absolute right-0 top-full z-30 mt-1.5 flex min-w-[10.5rem] flex-col rounded-lg border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-1 shadow-[0_12px_28px_-10px_rgba(2,33,98,0.35)]"
          >
            {LANGS.map((l, i) => (
              <button
                key={l} ref={(el) => { items.current[i] = el; }}
                type="button" role="menuitemradio" aria-checked={l === lang} lang={HTML_LANG[l]}
                onClick={() => choose(l)} onKeyDown={(e) => step(e, i)}
                className={`flex items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-[var(--lg-panel)] focus-visible:bg-[var(--lg-panel)] ${
                  l === lang ? "font-medium text-[var(--lg-gold-lit)]" : "text-[var(--lg-white)]"
                }`}
              >
                {LANG_NAME[l]}
                {l === lang && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
