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
/** The said, in bubbles: an over-long text cut to what LINE allows, an empty one dropped. */
function partsOf(said: Said[]): Said[] {
  const parts: Said[] = [];
  for (const s of said) {
    if ("text" in s) {
      if (!s.text.trim()) continue;
      // a text longer than LINE allows is cut into more than one, which the merge below may join
      for (let i = 0; i < s.text.length; i += MAX_TEXT) parts.push({ text: s.text.slice(i, i + MAX_TEXT) });
    } else parts.push(s);
  }
  return parts;
}

/** Neighbouring words joined into one bubble while there are more than `limit` of them. */
function mergeTexts(parts: Said[], limit: number): void {
  while (parts.length > limit) {
    const i = parts.findIndex((p, k) => "text" in p && "text" in (parts[k + 1] ?? {})
      && p.text.length + (parts[k + 1] as { text: string }).text.length + 2 <= MAX_TEXT);
    if (i < 0) break;
    parts.splice(i, 2, { text: `${(parts[i] as { text: string }).text}\n\n${(parts[i + 1] as { text: string }).text}` });
  }
}

function render(parts: Said[]): LineMessage[] {
  return parts.map((p) => ("text" in p
    ? { type: "text", text: withoutParticles(p.text) }
    : { type: "image", originalContentUrl: p.image, previewImageUrl: p.image }));
}

export function toMessages(said: Said[], replies?: string[]): LineMessage[] {
  const parts = partsOf(said);
  mergeTexts(parts, MAX_MESSAGES);
  const messages = render(parts.slice(0, MAX_MESSAGES));
  if (replies?.length && messages.length) messages[messages.length - 1].quickReply = quickReply(replies);
  return messages;
}

/**
 * Everything the bot said, in replies of five: the first goes out as the reply, which is free,
 * and only what does not fit goes as a push. Nothing is dropped — a couple's two value tables
 * used to be cut off the end of the reply, which is what the customer came for as much as the
 * cards. The buttons ride on the last message of the last batch.
 */
export function toBatches(said: Said[], replies?: string[]): LineMessage[][] {
  const parts = partsOf(said);
  mergeTexts(parts, MAX_MESSAGES);
  const messages = render(parts);
  if (replies?.length && messages.length) messages[messages.length - 1].quickReply = quickReply(replies);
  const batches: LineMessage[][] = [];
  for (let i = 0; i < messages.length; i += MAX_MESSAGES) batches.push(messages.slice(i, i + MAX_MESSAGES));
  return batches;
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

/* ── the rich menu ───────────────────────────────────────────────────────────────────────
 * Nothing here is a message, so nothing here is counted against the month's pushes. */

const DATA_API = "https://api-data.line.me/v2/bot";

/** One call to LINE that is not a message; a body is JSON unless it is the menu's picture. */
async function menuCall(
  method: "GET" | "POST" | "DELETE", url: string, body?: unknown, type = "application/json",
): Promise<Response> {
  return fetch(url, {
    method,
    headers: { authorization: `Bearer ${token()}`, ...(body === undefined ? {} : { "content-type": type }) },
    ...(body === undefined ? {} : { body: type === "application/json" ? JSON.stringify(body) : (body as BodyInit) }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}

async function menuOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`LINE ${what} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

/** A new menu, not yet drawn on: the picture goes up next. Returns LINE's id for it. */
export async function createRichMenu(body: unknown): Promise<string> {
  const res = await menuOk(await menuCall("POST", `${API}/richmenu`, body), "create menu");
  return ((await res.json()) as { richMenuId: string }).richMenuId;
}

export async function uploadRichMenuImage(richMenuId: string, png: ArrayBuffer): Promise<void> {
  await menuOk(await menuCall("POST", `${DATA_API}/richmenu/${richMenuId}/content`, png, "image/png"), "upload menu picture");
}

/** The menu every customer sees until they are given another. */
export async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  await menuOk(await menuCall("POST", `${API}/user/all/richmenu/${richMenuId}`, {}), "set default menu");
}

/**
 * Points an alias at a menu, making the alias if there is none yet. The bot finds the menu by
 * its alias, so a rebuilt menu is picked up without anything being copied into the settings.
 */
export async function pointAliasAt(alias: string, richMenuId: string): Promise<void> {
  const made = await menuCall("POST", `${API}/richmenu/alias`, { richMenuAliasId: alias, richMenuId });
  if (made.ok) return;
  // already taken, which on a rebuild is the usual case: move it instead
  await menuOk(await menuCall("POST", `${API}/richmenu/alias/${alias}`, { richMenuId }), "move menu alias");
}

/** The menu an alias points at, or null when there is no such alias. */
export async function richMenuIdOfAlias(alias: string): Promise<string | null> {
  const res = await menuCall("GET", `${API}/richmenu/alias/${alias}`);
  if (res.status === 404) return null;
  await menuOk(res, "read menu alias");
  return ((await res.json()) as { richMenuId: string }).richMenuId;
}

/** Shows this customer, and only this customer, that menu in place of the default. */
export async function linkRichMenu(userId: string, richMenuId: string): Promise<void> {
  await menuOk(await menuCall("POST", `${API}/user/${userId}/richmenu/${richMenuId}`, {}), "link menu");
}

/** Every menu the account holds, with the names this app gave them. */
export async function listRichMenus(): Promise<{ richMenuId: string; name: string }[]> {
  const res = await menuOk(await menuCall("GET", `${API}/richmenu/list`), "list menus");
  return ((await res.json()) as { richmenus: { richMenuId: string; name: string }[] }).richmenus;
}

export async function deleteRichMenu(richMenuId: string): Promise<void> {
  await menuOk(await menuCall("DELETE", `${API}/richmenu/${richMenuId}`), "delete menu");
}
