"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localeOf, translator, type Key, type Lang } from "@/lib/group-insurance/translations";

/**
 * Which language the page is in, and the two functions that follow from it.
 *
 * A context rather than props because the language reaches every leaf — a plan button, a
 * table stripe, the em-dash in an empty cell — and threading `t` through six levels of
 * component is how a leaf ends up hard-coding Thai.
 *
 * The choice is remembered in `localStorage` under the key the standalone tool used, so an
 * agency that has been running that tool in English keeps its setting when this replaces it.
 *
 * It is read in an effect rather than in the initial state, and that is not a style choice
 * either: this page is prerendered, the server has no `localStorage`, and seeding state from
 * it makes the first client render disagree with the server's and throws away the whole tree.
 * So the first paint is Thai — the setting nine agents in ten have — and English arrives a
 * frame later for the tenth.
 */

const STORAGE_KEY = "group-insurance-lang";

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key) => string;
  /** a number with the separators the language uses */
  fmt: (n: number) => string;
}

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children, fixed }: {
  children: React.ReactNode;
  /** the server's PDF page: the language the quotation was made in, not this browser's setting */
  fixed?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(fixed ?? "th");

  useEffect(() => {
    if (fixed) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "th") setLangState(saved);
    } catch {
      // a browser with storage switched off still gets a working page, in Thai
    }
  }, [fixed]);

  // <html lang> is what a screen reader reads the page's pronunciation rules off, so it has
  // to follow the toggle rather than stay at whatever the document was served as.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // the toggle still works for this visit
    }
  }, []);

  const value = useMemo<LangValue>(() => {
    const locale = localeOf(lang);
    return {
      lang,
      setLang,
      t: translator(lang),
      fmt: (n: number) => Number(n).toLocaleString(locale),
    };
  }, [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang outside LangProvider");
  return value;
}
