import { pageToken } from "./connection";
import { spokenBy, voiceOf } from "@/lib/assistant/voice";

const GRAPH = "https://graph.facebook.com/v23.0/me";

/** Messenger refuses a message longer than this, so a long answer is split across messages. */
const MAX_TEXT = 1900;
const MAX_PARTS = 5;
/** Messenger shows at most this many buttons, and cuts a title longer than this. */
const MAX_REPLIES = 13;
const MAX_REPLY_TITLE = 20;

/**
 * The token to answer with, for the Page the message arrived on.
 *
 * `pageId` travels down from the webhook rather than being looked up here, because the Page a
 * reply belongs to is a fact about the event and not about the process. With two Pages
 * connected, a send that guessed would answer one customer out of the other Page's inbox.
 */
async function token(pageId?: string): Promise<string> {
  const t = await pageToken(pageId);
  if (!t) throw new Error("ยังไม่ได้เชื่อมต่อเพจ Facebook");
  return t;
}

/** Splits on blank lines first, then hard-wraps whatever is still too long. */
export function toParts(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    if (current && current.length + para.length + 2 > MAX_TEXT) {
      parts.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) parts.push(current);

  const chunks = parts.flatMap((p) => {
    const out: string[] = [];
    for (let i = 0; i < p.length; i += MAX_TEXT) out.push(p.slice(i, i + MAX_TEXT));
    return out;
  });
  return chunks.slice(0, MAX_PARTS);
}

/**
 * Buttons under a message.
 *
 * A tap arrives back as an ordinary message whose text is the title, so every title has to
 * be something the bot already understands — "ขอตารางมูลค่า", "จ่าย 9 ปี". There is nothing
 * to route on a payload that the words do not already say.
 */
function quickReplies(titles: string[]) {
  return titles.slice(0, MAX_REPLIES).map((t) => {
    const title = t.slice(0, MAX_REPLY_TITLE);
    return { content_type: "text", title, payload: title };
  });
}

const SEND_TIMEOUT_MS = 20_000;

async function post(path: string, body: unknown, pageId?: string): Promise<void> {
  // the token goes in the header, not the query string: a URL is written to access logs and
  // proxy caches, and this one can send messages as the page
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token(pageId)}` },
    body: JSON.stringify(body),
    // a send that hangs would eat the time the webhook keeps back for the apology
    // (src/lib/chat/batch.ts SEND_MARGIN_MS); twenty seconds is far past a normal send,
    // a card Meta fetches from us included
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Messenger ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** An answer takes several seconds; the typing bubble says the page is working on it. */
export async function showTyping(psid: string, pageId?: string): Promise<void> {
  await post("messages", { recipient: { id: psid }, sender_action: "typing_on" }, pageId);
}

/**
 * The quote as a picture. Messenger fetches the URL itself, so it has to be one the public
 * internet can reach — which the card route is, and which is why the card carries no more
 * than the arrangement it draws.
 */
export async function sendImage(
  psid: string, url: string, replies?: string[], pageId?: string,
): Promise<void> {
  await post("messages", {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      attachment: { type: "image", payload: { url, is_reusable: true } },
      ...(replies?.length ? { quick_replies: quickReplies(replies) } : {}),
    },
  }, pageId);
}

/**
 * Why the page is writing. An answer to something the customer sent is a RESPONSE; a message
 * the bot decided to send on its own is an UPDATE. Both are allowed inside Meta's day-long
 * window, and saying which is which leaves nothing to interpret.
 */
export interface SendOptions {
  proactive?: boolean;
  /** the Page this reply belongs to; without it the only connected Page is used */
  pageId?: string;
}

export async function sendMessage(
  psid: string, text: string, replies?: string[], options?: SendOptions,
): Promise<void> {
  /**
   * Every word this system says to a customer leaves through here, which is the one place
   * that knows both the sentence and the Page it is going out of — so it is where the Page's
   * voice is applied. Doing it in the writing instead would mean a second copy of every
   * sentence, and a follow-up sent days later from another file would still be in the first
   * voice. The buttons are deliberately left alone: see `spokenBy`.
   */
  const said = spokenBy(voiceOf(options?.pageId), text);

  // parts go one after another, because Messenger shows them in the order they arrive
  const parts = toParts(said);
  for (const [i, part] of parts.entries()) {
    // the buttons belong to the last thing on the screen: a message sent after them takes
    // them away again
    const last = i === parts.length - 1;
    await post("messages", {
      recipient: { id: psid },
      messaging_type: options?.proactive ? "UPDATE" : "RESPONSE",
      message: { text: part, ...(last && replies?.length ? { quick_replies: quickReplies(replies) } : {}) },
    }, options?.pageId);
  }
}
