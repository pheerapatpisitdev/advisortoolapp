import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";

/** Which messaging service a person wrote from: the Facebook Page's inbox, or the LINE account. */
export type Channel = "facebook" | "line";

/** A conversation older than this has almost certainly moved on to a new customer. */
const MAX_AGE_HOURS = 24;
/** Enough turns for follow-up questions, few enough to keep every prompt cheap. */
const MAX_TURNS = 6;
/**
 * How long the agent's mark on a thread stands.
 *
 * It is not a day of silence: the customer writing again hands the thread back to the bot.
 * What the mark is for is the seconds the model takes — an answer already being composed
 * when the agent types is dropped rather than sent on top of them.
 */
const MUTE_HOURS = 24;

export interface Session {
  messages: ChatMessage[];
  slots: AnySlots | null;
  /** ISO time the bot may speak again, or null when it was never asked to stop */
  mutedUntil: string | null;
  /**
   * ISO time the application form went to this customer, or null.
   *
   * The bot says nothing in a thread that has one. It is read whatever the age of the row —
   * the session goes stale in a day and an application does not — so the only thing that
   * gives the thread back to the bot is somebody clearing the column.
   */
  handedOverAt: string | null;
  /** the conversation row this live session is part of, or null when none has been opened */
  conversationId: string | null;
  /**
   * The row's updated_at exactly as it was read, or null when there was no row: what saveTurn
   * compares against, so a turn can tell that another one saved in the meantime.
   */
  version?: string | null;
}

/** When the bot may speak in this thread again, counted from the agent's message. */
export function muteFor(now: Date = new Date()): Date {
  return new Date(now.getTime() + MUTE_HOURS * 3600_000);
}

export function isMuted(mutedUntil: string | null, now: Date = new Date()): boolean {
  return mutedUntil !== null && new Date(mutedUntil) > now;
}

/**
 * The row is read whatever its age, and the cutoff is applied to the conversation alone: a
 * mute has its own clock. A thread the agent answered in and then left alone for a day would
 * otherwise come back with the mute unread, and the bot would speak over them.
 */
export async function loadSession(channel: Channel, userHash: string): Promise<Session> {
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("messages, slots, muted_until, handed_over_at, updated_at, conversation_id")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .maybeSingle();
  if (!data) {
    return { messages: [], slots: null, mutedUntil: null, handedOverAt: null, conversationId: null, version: null };
  }

  const fresh = new Date(data.updated_at).getTime() > Date.now() - MAX_AGE_HOURS * 3600_000;
  const stored = fresh && Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as AnySlots) : null;
  // a stale row is a different visit as far as the report is concerned, and a conversation
  // carried on into it would show one arrival where there were two
  const conversationId = fresh ? ((data.conversation_id as string | null) ?? null) : null;
  return {
    messages: stored.slice(-MAX_TURNS),
    slots,
    mutedUntil: data.muted_until ?? null,
    // read past the staleness check on purpose: an application outlives a conversation
    handedOverAt: data.handed_over_at ?? null,
    conversationId,
    version: (data.updated_at as string | null) ?? null,
  };
}

/**
 * `mutedUntil` left out means the mute is none of this save's business, and the column is
 * left exactly as it is.
 *
 * It used to be a required argument, and the bot passed null after every answer — so a mute
 * the agent had written while the model was still thinking was wiped by the bot's own save,
 * seconds later. The thread then took the next customer message as if nobody had answered.
 */
export async function saveSession(
  channel: Channel,
  userHash: string,
  messages: ChatMessage[],
  slots: AnySlots | null,
  mutedUntil?: Date | null,
  conversationId?: string | null,
  /** the moment the form went out; left out, the column is none of this save's business */
  handedOverAt?: Date | null,
): Promise<void> {
  await supabaseAdmin()
    .from("ins_chat_sessions")
    .upsert({
      channel,
      user_hash: userHash,
      messages: messages.slice(-MAX_TURNS),
      slots: slots ?? {},
      // only the columns named here are written on conflict, so omitting this one keeps it
      ...(mutedUntil === undefined ? {} : { muted_until: mutedUntil?.toISOString() ?? null }),
      // and the same for the conversation: a save that is not about which one this is leaves it
      ...(conversationId === undefined ? {} : { conversation_id: conversationId }),
      ...(handedOverAt === undefined ? {} : { handed_over_at: handedOverAt?.toISOString() ?? null }),
      updated_at: new Date().toISOString(),
    });
}

/* ------------------------------ one bot turn ------------------------------ */

/**
 * The slots after two turns that ran at once: whatever this turn changed from where it began,
 * laid over what the other turn saved. Keys this turn did not touch keep the other's values;
 * a key this turn dropped is dropped. Slots are plain JSON, so they are compared as JSON.
 *
 * Exported for its test.
 */
export function mergeSlots(base: AnySlots | null, mine: AnySlots | null, theirs: AnySlots | null): AnySlots | null {
  const b = (base ?? {}) as Record<string, unknown>;
  const m = (mine ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...((theirs ?? {}) as Record<string, unknown>) };
  for (const key of new Set([...Object.keys(b), ...Object.keys(m)])) {
    if (JSON.stringify(b[key]) === JSON.stringify(m[key])) continue;
    if (key in m) out[key] = m[key];
    else delete out[key];
  }
  return Object.keys(out).length ? (out as unknown as AnySlots) : null;
}

export interface Turn {
  /** the session as it was loaded when this turn began, version included */
  base: Session;
  /** what this turn adds to the conversation: the customer's words and the bot's reply */
  added: ChatMessage[];
  /** the slots this turn's answer came back with */
  slots: AnySlots | null;
  conversationId: string | null;
}

/** how many times a turn re-reads and merges before it writes regardless */
const SAVE_ATTEMPTS = 3;

/**
 * Writes the row only if it is still the one `version` names (or, with null, only if there is
 * no row yet). False when another save got there first.
 */
async function writeIf(
  channel: Channel, userHash: string, version: string | null,
  values: { messages: ChatMessage[]; slots: AnySlots | null; conversationId: string | null },
): Promise<boolean> {
  const row = {
    messages: values.messages.slice(-MAX_TURNS),
    slots: values.slots ?? {},
    conversation_id: values.conversationId,
    updated_at: new Date().toISOString(),
  };
  const table = supabaseAdmin().from("ins_chat_sessions");
  if (version === null) {
    const { error } = await table.insert({ channel, user_hash: userHash, ...row });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  const { data, error } = await table.update(row)
    .eq("channel", channel).eq("user_hash", userHash).eq("updated_at", version)
    .select("user_hash");
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/**
 * Saves what one bot turn said, without losing a turn that ran beside it.
 *
 * Two quick messages from one customer arrive as two webhook calls, often on two instances:
 * both loaded the same session, both answered, and the later save wrote its own picture of
 * the conversation over the earlier one's — the age the customer gave in the first message,
 * remembered in its slots, was gone by the second (review, 2026-10-01). saveSession's upsert
 * cannot see that happen.
 *
 * So this writes only over the row it read (its updated_at is the version). If another turn
 * saved first, the row is read again and this turn's part is laid over it: its two messages
 * after the other's, and only the slots it changed (mergeSlots). The answer has already been
 * sent by then, so re-asking the model is not an option; merging is. After SAVE_ATTEMPTS
 * collisions it writes the last merge regardless, as saveSession always did.
 *
 * The mute and the hand-over stamp are not written here at all, so an agent's mark that
 * landed while the model was thinking stays exactly as the agent left it.
 *
 * Never throws: the customer has been answered, and a session that failed to save is a
 * shorter memory, not an apology.
 */
export async function saveTurn(channel: Channel, userHash: string, turn: Turn): Promise<void> {
  try {
    let version = turn.base.version ?? null;
    let messages = [...turn.base.messages, ...turn.added];
    let slots = turn.slots;
    let conversationId = turn.conversationId;
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
      if (await writeIf(channel, userHash, version, { messages, slots, conversationId })) return;
      const fresh = await loadSession(channel, userHash);
      version = fresh.version ?? null;
      messages = [...fresh.messages, ...turn.added];
      slots = mergeSlots(turn.base.slots, turn.slots, fresh.slots);
      // the conversation the other turn is already filed under stays the one
      conversationId = fresh.conversationId ?? turn.conversationId;
    }
    console.error(`chat session ${channel}:${userHash.slice(0, 8)} kept colliding; writing the last merge`);
    await saveSession(channel, userHash, messages, slots, undefined, conversationId);
  } catch (e) {
    console.error("chat session not saved:", e);
  }
}

/**
 * Meta retries a webhook it believes failed, so the same event can arrive more than once.
 * Inserting the id first means the second arrival collides and is dropped, and the customer
 * is never answered twice.
 */
export async function claimEvent(channel: Channel, eventId: string): Promise<boolean> {
  const { error } = await supabaseAdmin().from("ins_chat_events").insert({ channel, event_id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`บันทึกเหตุการณ์ไม่สำเร็จ: ${error.message}`);
}
