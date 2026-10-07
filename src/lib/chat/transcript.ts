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

export async function keepTranscript(thread: Thread, turns: (Turn | undefined)[]): Promise<void> {
  const rows = turns
    .filter((t): t is Turn => Boolean(t && t.text.trim()))
    .map((t) => ({
      channel: thread.channel,
      page_id: thread.pageId || null,
      user_hash: thread.userHash,
      conversation_id: thread.conversationId,
      role: t.role,
      text: scrubContact(t.text).trim().slice(0, MAX_CHARS),
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
