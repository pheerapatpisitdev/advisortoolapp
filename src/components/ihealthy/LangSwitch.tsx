"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { HTML_LANG, LANG_COOKIE, LANG_NAME, LANGS, type Lang } from "@/lib/ihealthy-lang";

/**
 * The four languages, each written in itself — a reader who cannot read Thai is looking for
 * "中文", not for the Thai word for Chinese.
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
  const choose = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${cookie}=${next}; path=${path}; SameSite=Lax`;
    start(() => router.refresh());
  };
  return (
    <nav
      aria-label={label}
      aria-busy={pending}
      className={`flex justify-end gap-1.5 pt-4 print:hidden ${pending ? "opacity-60" : ""}`}
    >
      {LANGS.map((l) => (
        <button
          key={l} type="button" lang={HTML_LANG[l]} aria-pressed={l === lang} onClick={() => choose(l)}
          className={`rounded-sm border px-2.5 py-1 text-xs transition-colors ${
            l === lang
              ? "lg-metal-face border-[var(--lg-gold)] font-medium"
              : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
          }`}
        >
          {LANG_NAME[l]}
        </button>
      ))}
    </nav>
  );
}
