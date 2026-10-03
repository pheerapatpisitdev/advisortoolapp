/**
 * Talking back to a LINE official account's chat.
 *
 * A reply is free and a push is not: the account's plan allows 300 pushed messages a month,
 * and a reply spends none of them. So every answer goes out as one reply, all of its bubbles
 * together, and a push is only the fallback for a reply token that lapsed while a model was
 * thinking — rare, and better than silence.
 */

import { withoutParticles } from "@/lib/assistant/voice";

const API = "https://api.line.me/v2/bot";

/** LINE takes at most five messages in one reply, and at most this many characters in each. */
export const MAX_MESSAGES = 5;
const MAX_TEXT = 5000;
/** a quick-reply button's label is cut at twenty characters; the text it sends is not */
const MAX_LABEL = 20;
const MAX_QUICK_REPLIES = 13;

export type LineMessage = (
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string }
) & { quickReply?: { items: QuickReplyItem[] } };

interface QuickReplyItem {
  type: "action";
  action: { type: "message"; label: string; text: string };
}

/** One of the words the bot says, or the picture of a quotation, in the order it says them. */
export type Said = { text: string } | { image: string };

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return t;
}

/** Counted in characters a person sees, so a Thai vowel mark is not cut from its letter. */
function label(text: string): string {
  const chars = Array.from(text);
  return chars.length <= MAX_LABEL ? text : `${chars.slice(0, MAX_LABEL - 1).join("")}…`;
}

function quickReply(replies: string[]): { items: QuickReplyItem[] } {
  return {
    items: replies.slice(0, MAX_QUICK_REPLIES).map((r) => ({
      type: "action", action: { type: "message", label: label(r), text: r },
    })),
  };
}

/**
 * What the bot said, as the messages of one reply.
 *
 * Five is LINE's ceiling. A couple priced together is two quotations and two cards, which
 * fits; anything longer gives up bubbles before pictures — neighbouring words are joined into
 * one bubble — because the card is the thing the customer keeps. The buttons ride on the last
 * message, which is where LINE draws them.
 */
export function toMessages(said: Said[], replies?: string[]): LineMessage[] {
  const parts: Said[] = [];
  for (const s of said) {
    if ("text" in s) {
      if (!s.text.trim()) continue;
      // a text longer than LINE allows is cut into more than one, which the merge below may join
      for (let i = 0; i < s.text.length; i += MAX_TEXT) parts.push({ text: s.text.slice(i, i + MAX_TEXT) });
    } else parts.push(s);
  }

  while (parts.length > MAX_MESSAGES) {
    const i = parts.findIndex((p, k) => "text" in p && "text" in (parts[k + 1] ?? {})
      && p.text.length + (parts[k + 1] as { text: string }).text.length + 2 <= MAX_TEXT);
    if (i < 0) break;
    parts.splice(i, 2, { text: `${(parts[i] as { text: string }).text}\n\n${(parts[i + 1] as { text: string }).text}` });
  }

  const messages: LineMessage[] = parts.slice(0, MAX_MESSAGES).map((p) => ("text" in p
    ? { type: "text", text: withoutParticles(p.text) }
    : { type: "image", originalContentUrl: p.image, previewImageUrl: p.image }));
  if (replies?.length && messages.length) messages[messages.length - 1].quickReply = quickReply(replies);
  return messages;
}

const SEND_TIMEOUT_MS = 20_000;

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
    // a send that hangs would eat the time the webhook keeps back for the apology
    // (src/lib/chat/batch.ts SEND_MARGIN_MS); twenty seconds is far past a normal send
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LINE ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function reply(replyToken: string, messages: LineMessage[]): Promise<void> {
  await post("/message/reply", { replyToken, messages });
}

/** Only when the reply token has lapsed: every push is one of the month's 300. */
export async function push(to: string, messages: LineMessage[]): Promise<void> {
  await post("/message/push", { to, messages });
}

/**
 * The dots, while a model is thinking. LINE clears them the moment the answer arrives, and
 * they cost nothing against the month's messages.
 */
export async function showLoading(userId: string): Promise<void> {
  await post("/chat/loading/start", { chatId: userId, loadingSeconds: 20 });
}
