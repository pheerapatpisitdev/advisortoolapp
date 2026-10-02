import { PLAN_PAGES, type PdfPage } from "@/lib/quote-pdf/pages";
import type { Channel } from "./channel";
import { affirms, one, type Reply, type Said } from "./common";
import type { AnyAnswer } from "./dispatch";
import type { AnySlots, PdfMemory, WithPdf } from "./slots";

/**
 * The sales page's PDF, in the chat: offered once per plan after a quote, sent when asked for.
 *
 * The file is the one the page's own "บันทึกเป็น PDF" button makes, printed by /api/quote-pdf.
 * Everything here is about the conversation around it — which quote is the latest, whether
 * the customer has been asked, whether they said no — and none of it needs a model: the
 * request is a handful of words and the answer is fixed copy and a path.
 *
 * The delivery is the channel's job. This decides which message carries the file (`file`)
 * and the channel decides whether that becomes an attachment, a link or a button.
 */

/** The words that ask for the file. "ขอตาราง" is not among them: it is the value table. */
export const PDF_ASKED = /pdf|ไฟล์|ใบเสนอ/i;

export const PDF_OFFER = "อยากได้เป็นไฟล์ PDF ไว้เก็บหรือส่งต่อให้ครอบครัวไหมครับ?";
export const PDF_YES = "ขอไฟล์ PDF";
export const PDF_NO = "ไม่เป็นไร";

const DECLINED = "ได้เลยครับ มีอะไรอยากถามต่อ พิมพ์มาได้เลย";
const NO_QUOTE = "ทำไฟล์ PDF ให้ได้ครับ ขอแบบประกัน อายุ และเพศก่อน เดี๋ยวคิดเบี้ยให้แล้วส่งไฟล์ให้เลย";
const NO_PDF = "เบี้ยนี้ยังทำเป็นไฟล์ PDF ไม่ได้ครับ ส่งรูปใบเสนอให้แทนนะครับ";

/**
 * The line that goes with the file.
 *
 * Messenger attaches the file after it, and the file takes a few seconds to print, so the
 * line says it is on its way. LINE and the website get a link or a button instead, so their
 * line names what it leads to rather than promising something is being made.
 */
const SENDING: Record<Channel, string> = {
  facebook: "กำลังทำไฟล์ให้ครับ",
  line: "ไฟล์ PDF ของเบี้ยล่าสุดครับ",
  web: "ไฟล์ PDF ของเบี้ยล่าสุดครับ",
};

/** Polite endings a short answer may carry without changing what it says. */
const TAIL = String.raw`(?:\s*(?:ครับ|ค่ะ|คะ|คับ|นะ|จ้า|จ้ะ|เลย|ก่อน|ขอบคุณ(?:ครับ|ค่ะ|คะ)?))*\s*$`;
/**
 * A bare no — the button's "ไม่เป็นไร" among them — which only means "no file" straight after
 * the bot offered one. Anywhere else "ไม่เป็นไรครับ" is ordinary politeness, and reading it as a
 * refusal would stop the offer for the rest of the conversation.
 */
const SAYS_NO = new RegExp(String.raw`^\s*(?:ยัง)?ไม่(?:เอา|ต้อง|ดีกว่า|เป็นไร)?${TAIL}|^\s*no(?:pe)?${TAIL}`, "i");
/**
 * Ways of saying yes to the offer that `affirms` does not cover — "ขอด้วย", "ส่งมาเลย". Only
 * read straight after the offer, where there is nothing else they could be saying yes to.
 */
const SAYS_SEND = new RegExp(String.raw`^\s*(?:ขอ(?:ด้วย|หน่อย)?|ส่ง(?:มา|ให้)?(?:หน่อย|ด้วย)?|อยากได้|ต้องการ|yes)${TAIL}`, "i");
/**
 * Words that can only mean applying, which outrank the offer. Narrower than `BUYS` on purpose:
 * "เอาเลย", "เอาแบบนี้", "เอาอันนี้" are buying words after a quote, but straight after "want the
 * PDF?" they are a yes to the file — the question the customer was just asked.
 */
const APPLIES = /สมัคร|ซื้อ|ทำประกัน|ขั้นตอน|เอกสาร|ทำ(?:ยังไง|อย่างไร|ไง)|ต้องทำอะไร|ดำเนินการ/;

/**
 * The turn that answers a request for the file, or a no to the offer — undefined for any
 * other message, which then goes where it always went.
 *
 * Read before the form, on purpose. The quote that offered the file also invited the
 * customer to apply, and the "เอาครับ" that comes back after the offer is about the file —
 * the last thing asked — even "เอาเลย". A word that can only mean applying ("สมัคร") still
 * gets the form.
 *
 * A request with figures in it ("ขอใบเสนอราคา ชาย 35 ทุน 1 ล้าน") is asking for a quote, not
 * for the last one's file, so it is left to be priced — and the quote then offers the file.
 */
export function pdfTurn(
  asked: string, lastSaid: string | undefined, memory: PdfMemory | undefined, channel: Channel,
): { reply: Reply; memory: PdfMemory } | undefined {
  const kept: PdfMemory = memory ?? { asked: [] };
  const offered = Boolean(lastSaid?.trimEnd().endsWith(PDF_OFFER));

  if (offered && SAYS_NO.test(asked)) {
    return { reply: one(DECLINED), memory: { ...kept, declined: true } };
  }

  const requested = (PDF_ASKED.test(asked) && !/\d/.test(asked))
    || (offered && (affirms(asked) || SAYS_SEND.test(asked)) && !APPLIES.test(asked));
  if (!requested) return undefined;

  if (kept.path) return { reply: { messages: [{ text: SENDING[channel], file: kept.path }] }, memory: kept };
  // the latest quote is one no sales page prints (CI 123, cancer, legacy): its picture instead
  if (kept.card) return { reply: one(NO_PDF, kept.card), memory: kept };
  return { reply: one(NO_QUOTE), memory: kept };
}

/** A quote's picture, as against a value table's or a list of illnesses'. */
const QUOTE_CARD = /^\/api\/(?:card|ihealthy-card)\?/;

const PDF_PAGES: readonly string[] = [...Object.keys(PLAN_PAGES), "ihealthy-ultra"];
const isPdfPage = (v: unknown): v is PdfPage => typeof v === "string" && PDF_PAGES.includes(v);

/** The page a PDF path prints. */
function pageOf(path: string): PdfPage | undefined {
  const page = new URLSearchParams(path.split("?")[1] ?? "").get("page");
  return isPdfPage(page) ? page : undefined;
}

/**
 * The PDF memory as this code could have written it, or undefined.
 *
 * On the website the slots go to the browser and come back, so whatever arrives may have been
 * written by anyone: a `path` handed back as the file would be a link of their choosing, a
 * `card` an image of their choosing, and an `asked` that is not a list throws on the next quote.
 * So every field is checked against what `withPdfOffer` writes, and a field that fails is
 * dropped — the rest of the conversation is still good. Read for every channel, not only the
 * website: one check in one place, whoever stored the row.
 */
export function cleanPdfMemory(raw: unknown): PdfMemory | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { path, card, asked, declined } = raw as Record<string, unknown>;
  const ok = (v: unknown, pattern: RegExp) => typeof v === "string" && pattern.test(v) && !/\s/.test(v);
  const goodPath = ok(path, /^\/api\/quote-pdf\?page=/) && pageOf(path as string) !== undefined;
  return {
    asked: Array.isArray(asked) ? [...new Set(asked.filter(isPdfPage))] : [],
    ...(goodPath ? { path: path as string } : {}),
    ...(ok(card, QUOTE_CARD) ? { card: card as string } : {}),
    ...(declined === true ? { declined: true as const } : {}),
  };
}

/**
 * An answer, with what it quoted remembered and the file offered under it.
 *
 * The quote remembered is the last one with a PDF — the second of a couple, the one the
 * buttons sit under — or, where nothing on the answer has a PDF, the last quote card, so the
 * customer who asks for a file of a plan no page prints is sent the picture instead. A value
 * table or a list of illnesses is not a quote and leaves the memory alone.
 *
 * The question is asked once per plan and never after a no; the button is offered under
 * every quote that has a file, first, because it is the one thing the other buttons are not.
 */
export function withPdfOffer(answer: AnyAnswer, memory: PdfMemory | undefined): AnyAnswer {
  const latest = <T>(pick: (m: Said) => T | undefined) => answer.messages.map(pick).filter(Boolean).at(-1);
  const path = latest((m) => m.pdfPath);
  const card = path
    ? answer.messages.findLast((m) => m.pdfPath === path)?.card
    : latest((m) => (m.card && QUOTE_CARD.test(m.card) ? m.card : undefined));

  if (!path && !card) return memory ? remember(answer, memory) : answer;

  const kept: PdfMemory = {
    asked: memory?.asked ?? [],
    ...(memory?.declined ? { declined: true as const } : {}),
    ...(path ? { path } : {}),
    ...(card ? { card } : {}),
  };
  if (!path) return remember(answer, kept);

  const page = pageOf(path);
  const ask = Boolean(page && !kept.asked.includes(page) && !kept.declined);
  const buttons = ask ? [PDF_YES, PDF_NO] : [PDF_YES];
  const others = (answer.replies ?? []).filter((r) => !buttons.includes(r));
  return remember({
    ...answer,
    messages: ask ? [...answer.messages, { text: PDF_OFFER }] : answer.messages,
    replies: [...buttons, ...others],
    // the website draws `guide` in place of the replies, so the buttons go there too
    ...(answer.guide?.length
      ? { guide: [...buttons.map((label) => ({ label, ask: label })), ...answer.guide.filter((g) => !buttons.includes(g.label))] }
      : {}),
  }, ask && page ? { ...kept, asked: [...kept.asked, page] } : kept);
}

/** The answer with the memory written into its slots, which is how it reaches the next turn. */
function remember(answer: AnyAnswer, memory: PdfMemory): AnyAnswer {
  return { ...answer, slots: { ...answer.slots, pdf: memory } as WithPdf<AnySlots> };
}
