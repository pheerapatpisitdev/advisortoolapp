/**
 * The languages the iHealthy Ultra page can be read in.
 *
 * Thai is the page and the others are readings of it: every visitor arrives in Thai, and the
 * switch at the top is the only way into another language. The choice is kept in a cookie
 * with no expiry of its own, so it lasts while the browser is open — a reload does not throw
 * a Chinese reader back into Thai — and a visit next week starts in Thai again.
 */
export const LANGS = ["th", "en", "zh", "ru", "my", "fr", "de"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_COOKIE = "ihu-lang";

/** What each language calls itself, which is what a reader who cannot read Thai looks for. */
export const LANG_NAME: Record<Lang, string> = {
  th: "ไทย",
  en: "English",
  zh: "中文",
  ru: "Русский",
  my: "မြန်မာ",
  fr: "Français",
  de: "Deutsch",
};

/** The `lang` attribute, so a screen reader and the browser's own font fallback get it right. */
export const HTML_LANG: Record<Lang, string> = {
  th: "th",
  en: "en",
  zh: "zh-Hans",
  ru: "ru",
  my: "my",
  fr: "fr",
  de: "de",
};

/** Anything that is not one of the four reads as Thai, which is the page as it was written. */
export function parseLang(value: string | undefined): Lang {
  return (LANGS as readonly string[]).includes(value ?? "") ? (value as Lang) : "th";
}

/**
 * A figure as the reader's language groups it (owner, 2026-11-16, ก on mockup
 * https://claude.ai/artifact/L9eji4qWrFwkANrygUWj8b): German readers group thousands with a dot,
 * 8.000 and 2.000.000; every other language keeps the comma the pages have always used.
 */
export const NUMBER_LOCALE: Record<Lang, string> = {
  th: "en-US", en: "en-US", zh: "en-US", ru: "en-US", my: "en-US", fr: "en-US", de: "de-DE",
};

export function figure(value: number, lang: Lang, opts?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(NUMBER_LOCALE[lang], opts);
}
