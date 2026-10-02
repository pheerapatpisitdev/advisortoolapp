import { PLAN_PAGES, type PdfPage } from "@/lib/quote-pdf/pages";
import type { Channel } from "./channel";
import { aboutAGroup } from "./choose";
import { affirms, one, saysFormDone, WANTS_IN, type Reply, type Said } from "./common";
import type { AnyAnswer } from "./dispatch";
import { recruitReply } from "./recruit";
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
const NO_PDF = "เบี้ยนี้ยังทำเป็นไฟล์ PDF ไม่ได้ครับ ส่งรูปใบเสนอให้แทนนะครับ";

/**
 * The most files one answer remembers and sends: a family priced together, and no more than
 * LINE can carry in one reply beside the line that introduces them (five messages).
 */
const MAX_FILES = 4;

/**
 * The line that goes with the files, said once, before the first.
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
 * A message the PDF's words turn up in that was always another path's to answer: a company
 * asking about its staff ("ขอใบเสนอราคาประกันกลุ่ม"), someone who wants to join the team
 * ("ขอไฟล์รายละเอียด"), someone asking what applying takes ("สมัครต้องส่งไฟล์อะไรบ้าง") or
 * saying the form is done ("ส่งไฟล์ให้แล้ว"). Each had its answer before the file existed, and
 * the file is not that answer — the last one cost the form's thank-you and its count.
 */
function belongsElsewhere(asked: string, lastSaid: string | undefined): boolean {
  return aboutAGroup(asked) || recruitReply(asked, lastSaid) !== null || APPLIES.test(asked) || saysFormDone(asked);
}

/** There is a latest quote to answer for: its files, its picture, or the word that it has none. */
function holdsAQuote(memory: PdfMemory): boolean {
  return Boolean(memory.paths?.length || memory.card || memory.latestHasNoPdf);
}

/** The memory carried into the next turn, where the offer is no longer the last thing said. */
function onward(memory: PdfMemory): PdfMemory {
  const rest = { ...memory };
  delete rest.offered;
  return rest;
}

/**
 * The turn that answers a request for the file, or a no to the offer — undefined for any
 * other message, which then goes where it always went.
 *
 * Only once there is a quote to answer for. Before that, "ขอใบเสนอราคาครับ" is how a customer
 * opens, and the usual way — which plan, an age, a sex — is the way to the file anyway: the
 * quote it ends in offers it. Answering it here instead lost the advertisement the customer
 * came through, and the plan with it.
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
  if (!memory || !holdsAQuote(memory)) return undefined;
  const kept = onward(memory);
  // the mark first: the words may have come back cut short
  const offered = memory.offered === true || Boolean(lastSaid?.trimEnd().endsWith(PDF_OFFER));

  // the apply button stays under every answer here: the file is a step towards it, not instead
  if (offered && SAYS_NO.test(asked)) {
    return { reply: { ...one(DECLINED), replies: [WANTS_IN] }, memory: { ...kept, declined: true } };
  }

  const requested = (PDF_ASKED.test(asked) && !/\d/.test(asked))
    || (offered && (affirms(asked) || SAYS_SEND.test(asked)));
  if (!requested || belongsElsewhere(asked, lastSaid)) return undefined;

  if (kept.paths?.length) {
    return {
      reply: {
        // a couple gets both files; the line that says they are coming is said once
        messages: kept.paths.map((file, i) => ({ text: i === 0 ? SENDING[channel] : "", file })),
        replies: [WANTS_IN],
      },
      memory: kept,
    };
  }
  // the latest quote is one no sales page prints (CI 123, cancer, legacy): its picture instead,
  // where it has one — the pension plan has none, and gets the apology alone
  return { reply: { ...one(NO_PDF, kept.card), replies: [WANTS_IN] }, memory: kept };
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
 * written by anyone: a path handed back as the file would be a link of their choosing, a
 * `card` an image of their choosing, and an `asked` that is not a list throws on the next quote.
 * So every field is checked against what `withPdfOffer` writes, and a field that fails is
 * dropped — the rest of the conversation is still good. Read for every channel, not only the
 * website: one check in one place, whoever stored the row.
 */
export function cleanPdfMemory(raw: unknown): PdfMemory | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { paths, card, asked, declined, offered, latestHasNoPdf } = raw as Record<string, unknown>;
  const ok = (v: unknown, pattern: RegExp) => typeof v === "string" && pattern.test(v) && !/\s/.test(v);
  const goodPaths = (Array.isArray(paths) ? paths : [])
    .filter((p): p is string => ok(p, /^\/api\/quote-pdf\?page=/) && pageOf(p as string) !== undefined)
    .slice(0, MAX_FILES);
  return {
    asked: Array.isArray(asked) ? [...new Set(asked.filter(isPdfPage))] : [],
    ...(goodPaths.length ? { paths: goodPaths } : {}),
    ...(ok(card, QUOTE_CARD) ? { card: card as string } : {}),
    ...(latestHasNoPdf === true ? { latestHasNoPdf: true as const } : {}),
    ...(declined === true ? { declined: true as const } : {}),
    ...(offered === true ? { offered: true as const } : {}),
  };
}

/**
 * An answer, with what it quoted remembered and the file offered under it.
 *
 * The quotes remembered are every one on the answer with a PDF — both of a couple, in the
 * order they were named — or, where nothing on the answer has a PDF, the last quote card, so
 * the customer who asks for a file of a plan no page prints is sent the picture instead. A
 * priced answer with neither (the pension plan) is remembered as having none, so the file
 * asked for next is not the quote before it. A value table or a list of illnesses is not a
 * quote and leaves the memory alone.
 *
 * The question is asked once per plan and never after a no; the button is offered under
 * every quote that has a file, first, because it is the one thing the other buttons are not.
 */
export function withPdfOffer(answer: AnyAnswer, memory: PdfMemory | undefined): AnyAnswer {
  const paths = [...new Set(answer.messages.map((m) => m.pdfPath).filter((p): p is string => Boolean(p)))]
    .slice(0, MAX_FILES);
  const card = paths.length
    ? undefined
    : answer.messages.map((m: Said) => (m.card && QUOTE_CARD.test(m.card) ? m.card : undefined)).filter(Boolean).at(-1);

  const base: PdfMemory = { asked: memory?.asked ?? [], ...(memory?.declined ? { declined: true as const } : {}) };
  if (!paths.length && !card) {
    if (answer.priced && !answer.messages.some((m) => m.card)) return remember(answer, { ...base, latestHasNoPdf: true });
    return memory ? remember(answer, onward(memory)) : answer;
  }
  if (!paths.length) return remember(answer, { ...base, card });

  // the buttons sit under the last quote, so the question is about that one's plan
  const page = pageOf(paths.at(-1)!);
  const ask = Boolean(page && !base.asked.includes(page) && !base.declined);
  const buttons = ask ? [PDF_YES, PDF_NO] : [PDF_YES];
  const others = (answer.replies ?? []).filter((r) => !buttons.includes(r));
  const kept: PdfMemory = { ...base, paths };
  return remember({
    ...answer,
    messages: ask ? [...answer.messages, { text: PDF_OFFER }] : answer.messages,
    replies: [...buttons, ...others],
    // the website draws `guide` in place of the replies, so the buttons go there too
    ...(answer.guide?.length
      ? { guide: [...buttons.map((label) => ({ label, ask: label })), ...answer.guide.filter((g) => !buttons.includes(g.label))] }
      : {}),
  }, ask && page ? { ...kept, asked: [...kept.asked, page], offered: true } : kept);
}

/** The answer with the memory written into its slots, which is how it reaches the next turn. */
function remember(answer: AnyAnswer, memory: PdfMemory): AnyAnswer {
  return { ...answer, slots: { ...answer.slots, pdf: memory } as WithPdf<AnySlots> };
}
