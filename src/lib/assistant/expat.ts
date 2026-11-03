/**
 * The Pages that sell iHealthy Ultra to foreigners, and the language each message is answered in.
 *
 * A list in code rather than a row per Page, the way `voice.ts` keeps the Pages that speak as a
 * man: there are three, the owner named them, and a Page connected tomorrow is a Thai Page until
 * someone says otherwise.
 */
export const EXPAT_PAGES = new Set([
  "112079600278201", // Expat Influencer Insurance
  "112110731809903", // Expat Insurance Thailand by Phet
  "107330411059217", // Better Life Insurance — sells to foreigners too (owner, 2026-10-02)
]);

export function isExpatPage(pageId?: string): boolean {
  return pageId !== undefined && EXPAT_PAGES.has(pageId);
}

export type ChatLang = "en" | "th";

const THAI = /[฀-๿]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const NEUTRAL = /^\s*(?:smart|bronze|silver|gold|diamond|platinum|ok(?:ay)?|opd|ipd)\s*[.!]*\s*$/i;

/**
 * English unless the customer writes Thai — the owner's rule for these Pages (2026-10-02).
 *
 * A message that says nothing about its language — an age on its own, a thumbs up, a tapped
 * plan button — is answered in the language the conversation was already in, so "35" after a
 * Thai question does not turn the reply English. Any other script reads as English: it is the language the agent serves
 * foreigners in.
 */
/** What a request for a language may be wrapped in: "ขอ … หน่อยครับ", "… please". */
const POLITE = String.raw`(?:\s*(?:ครับ|คับ|ค่ะ|คะ|ค่า|นะ|น่ะ|จ้า|จ้ะ|หน่อย|ด้วย|ได้(?:ไหม|มั้ย|มั๊ย|ไม๊|ป่าว|ปะ)|please|pls|plz))*\s*[.!?]*\s*$`;
const IN_THAI_WORDS = String.raw`^\s*(?:ขอ|ช่วย|รบกวน)?\s*(?:คุย|พูด|ตอบ|ใช้|เปลี่ยน|พิมพ์)?\s*(?:เป็น)?\s*(?:ภาษา)?\s*`;
const IN_ENGLISH_WORDS = String.raw`^\s*(?:(?:can|could|would) (?:you|we|i)\s+)?(?:please\s+)?(?:(?:speak|talk|reply|answer|write|chat|continue|switch)(?:\s+to)?\s+)?(?:in\s+)?`;

/**
 * The whole message is a request to be answered in English: "ภาษาอังกฤษ", "ขอเป็นภาษาอังกฤษครับ",
 * "English please", "Can you speak English?". Only a request — the owner chose ก (2026-11-03):
 * a question written in English is still a question, and a Thai customer's "OPD กี่บาท" is
 * Thai. "มีเอกสารภาษาอังกฤษไหม" asks for a document, not a language, and is not this.
 */
const ASKS_ENGLISH = [
  new RegExp(`${IN_THAI_WORDS}อังกฤษ${POLITE}`),
  new RegExp(`${IN_ENGLISH_WORDS}english${POLITE}`, "i"),
  /^\s*(?:do|can) you (?:speak|write|reply in) english\b[^฀-๿]*$/i,
  /^\s*(?:sorry,?\s*)?i\s*(?:don'?t|do not|can'?t|cannot) (?:speak|read|understand) thai\b[^฀-๿]*$/i,
];
const ASKS_THAI = [
  new RegExp(`${IN_THAI_WORDS}ไทย${POLITE}`),
  new RegExp(`${IN_ENGLISH_WORDS}thai${POLITE}`, "i"),
];

export function asksForEnglish(text: string): boolean {
  return ASKS_ENGLISH.some((re) => re.test(text));
}

export function asksForThai(text: string): boolean {
  return ASKS_THAI.some((re) => re.test(text));
}

export function languageOf(text: string, previous?: ChatLang): ChatLang {
  if (THAI.test(text)) return "th";
  // a tapped plan button, or an "ok", says nothing about language: the Thai menu's buttons are
  // the plans' English names, and a Thai customer tapping Gold is still writing Thai
  if (NEUTRAL.test(text)) return previous ?? "en";
  if (LATIN_WORD.test(text)) return "en";
  return previous ?? "en";
}
