/**
 * The customer's name an agent may type in the send panel, to stand on the card, the table and
 * the copied text (owner, 2026-10-19, option ก on mockup
 * https://claude.ai/artifact/6YVfNExyeQRWa6ZimznNiz). Never required: without it every picture
 * is the one it always was.
 *
 * The name rides in the picture's address as `name`, is drawn and forgotten — nothing keeps it —
 * and a picture carrying one is never left in the CDN (see NAMED_CACHE).
 */

/** the address key the picture routes read */
export const NAME_KEY = "name";
/** characters, counted as the reader sees them */
export const NAME_MAX = 30;

/** a picture with a customer's name on it is that customer's: not kept where anyone could ask for it */
export const NAMED_CACHE = "private, no-store";

/**
 * The name as it is drawn, without its honorific, or undefined for none.
 *
 * Invisible and control characters go (a phone's keyboard leaves zero-width spaces behind),
 * runs of space close up, and a leading "คุณ" the agent typed is dropped so the card does not
 * say it twice.
 */
export function cleanCustomerName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const plain = raw.normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^คุณ\s*/, "");
  const cut = letters(plain).slice(0, NAME_MAX).join("").trim();
  return cut || undefined;
}

/** a Thai letter with its vowel and tone marks is one: a cut never leaves a mark behind on its own */
function letters(text: string): string[] {
  if (typeof Intl.Segmenter !== "function") return Array.from(text);
  return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), (s) => s.segment);
}

/** How the name is written for the reader: "คุณสมชาย" in Thai, the name alone in any other language. */
export const addressedAs = (name: string, thai = true) => (thai ? `คุณ${name}` : name);

/** `path` with the name added to its address, or `path` itself when there is none. */
export function withCustomerName(path: string, name: string | undefined): string {
  if (!name) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${NAME_KEY}=${encodeURIComponent(name)}`;
}
