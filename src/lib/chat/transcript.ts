import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Said } from "@/lib/assistant/common";
import { scrubContact } from "@/lib/assistant/unanswered";
import type { Channel } from "./session";

/**
 * What was said in a chat, kept ninety days so the daily review can learn from it.
 *
 * The owner asked for this on 2026-09-26: the bot could not get better from a record that held
 * only counts. Three voices are kept — the customer, the bot, and the agent typing by hand in
 * the Page inbox, whose answers are the ones most worth teaching back. Contact details are taken
 * out before anything is written, with the same patterns the unanswered questions use, and the
 * person stays a one-way hash as everywhere else. advisortool.app/privacy says all of this.
 *
 * Nothing here may cost the customer an answer: a write that fails is logged and dropped.
 */

export type Speaker = "customer" | "bot" | "agent";

export interface Turn {
  role: Speaker;
  text: string;
}

/** the column's own limit; a pasted document is not a chat turn worth keeping whole */
const MAX_CHARS = 2000;

/**
 * The bot's turn as the review should read it: the words, then a marker for each quote card
 * and the buttons it offered, since "the customer went quiet after the card" is a finding.
 */
export function botTurn(messages: Said[], replies?: string[]): Turn | undefined {
  // the intro picture is not a quotation, and the log is how a quotation's card is told from the rest
  const parts = messages.map((m) => (m.card ? `${m.text}\n${m.card.startsWith("/intro/") ? "[รูปประกอบ]" : "[การ์ดใบเสนอ]"}`.trim() : m.text)).filter(Boolean);
  if (replies?.length) parts.push(`[ปุ่ม: ${replies.join(" | ")}]`);
  const text = parts.join("\n\n").trim();
  return text ? { role: "bot", text } : undefined;
}

export interface Thread {
  channel: Channel;
  pageId?: string;
  userHash: string;
  conversationId: string | null;
  product?: string | null;
}

/** A turn's words as the log keeps them: contact details out, trimmed, cut to the column. */
function kept(text: string): string {
  return scrubContact(text).trim().slice(0, MAX_CHARS);
}

export async function keepTranscript(thread: Thread, turns: (Turn | undefined)[]): Promise<void> {
  const rows = turns
    .filter((t): t is Turn => Boolean(t && t.text.trim()))
    .map((t) => ({
      channel: thread.channel,
      page_id: thread.pageId || null,
      user_hash: thread.userHash,
      conversation_id: thread.conversationId,
      role: t.role,
      text: kept(t.text),
      product: thread.product ?? null,
    }));
  if (!rows.length) return;
  try {
    const { error } = await supabaseAdmin().from("ins_transcripts").insert(rows);
    if (error) console.error("transcript not kept:", error.message);
  } catch (e) {
    console.error("transcript not kept:", e);
  }
}

/** Two messages this close together are one burst: the customer typed the second before the first was answered. */
const BURST_SECONDS = 60;

/**
 * Whether the customer wrote something else just before this message, whose turn is still
 * being answered beside this one.
 *
 * The greeting needs it. Two quick messages ("Life Protect มรดกทุน 1,000,000", then "สนใจ")
 * are two webhook calls that both read an empty session, since neither has saved yet, so the
 * second took itself for the customer's first word and sent the Page's welcome pictures and
 * greeting on top of the first one's answer (2026-10-09). The session cannot tell them apart;
 * the log can, because each turn writes the customer's words before it starts to think.
 *
 * "Before" is by the log's own order, and only as far as this message's words are found in it:
 * the first row that says them is taken as this turn's, so two identical messages are both
 * counted as first and a failed write counts as none. Each errs toward greeting, which is what
 * the bot did before; it never errs toward two turns that both stay silent.
 */
export async function wroteJustBefore(channel: Channel, userHash: string, text: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - BURST_SECONDS * 1000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("ins_transcripts")
      .select("text")
      .eq("channel", channel).eq("user_hash", userHash).eq("role", "customer")
      .gte("at", since)
      .order("at", { ascending: true })
      .limit(5);
    if (error || !data) return false;
    const mine = data.findIndex((r: { text: string }) => r.text === kept(text));
    return mine > 0;
  } catch {
    return false;
  }
}
