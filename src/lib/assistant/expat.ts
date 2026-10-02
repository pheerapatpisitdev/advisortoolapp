/**
 * The Pages that sell iHealthy Ultra to foreigners, and the language each message is answered in.
 *
 * A list in code rather than a row per Page, the way `voice.ts` keeps the Pages that speak as a
 * man: there are two, the owner named them, and a Page connected tomorrow is a Thai Page until
 * someone says otherwise.
 */
export const EXPAT_PAGES = new Set([
  "112079600278201", // Expat Influencer Insurance
  "112110731809903", // Expat Insurance Thailand by Phet
]);

export function isExpatPage(pageId?: string): boolean {
  return pageId !== undefined && EXPAT_PAGES.has(pageId);
}

export type ChatLang = "en" | "th";

const THAI = /[฀-๿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;

/**
 * English unless the customer writes Thai — the owner's rule for these Pages (2026-10-02).
 *
 * A message that says nothing about its language — an age on its own, a thumbs up — is answered
 * in the language the conversation was already in, so "35" after a Thai question does not turn
 * the reply English. Any other script reads as English: it is the language the agent serves
 * foreigners in.
 */
export function languageOf(text: string, previous?: ChatLang): ChatLang {
  if (THAI.test(text)) return "th";
  if (LATIN_WORD.test(text)) return "en";
  return previous ?? "en";
}
