import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Channel } from "./session";

/**
 * The one message the bot sends into a silence.
 *
 * A quotation used to end the conversation rather than open it: of thirteen customers quoted
 * in a day, not one wrote again — not to accept, not to object, not even to say the price was
 * too high. The agent picked up eleven of those threads by hand.
 *
 * So the bot asks once, five minutes later, and only if nobody has spoken since. Everything
 * about it is deliberately narrow: one message per quotation, never a second; nothing at all
 * once the agent has typed; and nothing outside the day Meta allows a page to write in.
 */

/**
 * What it asks.
 *
 * The first version opened with "ดูตัวเลขแล้วเป็นยังไงบ้างครับ" and got no answers, so the
 * second asked "อยากดูแบบไหนต่อครับ กดปุ่มได้เลย ไม่ต้องพิมพ์" — a closed question whose answers
 * were the buttons. That one read wrong wherever the buttons were not drawn: the Page's own
 * inbox shows the words alone, and the buttons go once anything else is said, leaving a line
 * that points at nothing (owner, 2026-10-06).
 *
 * So the words now stand on their own: an invitation to ask about the figures just sent, which
 * reads the same with the buttons or without them. The buttons stay underneath for whoever
 * would rather tap than type.
 */
export const FOLLOWUP_TEXT = "ดูตัวเลขแล้วสงสัยตรงไหน ถามได้เลยครับ";

/**
 * The buttons under it, which also puts them back on the screen: a message sent after quick
 * replies clears them, so the quotation's own buttons are gone by now.
 *
 * Every title is a phrase the bot already routes, because a tap arrives as nothing but its own
 * words. Two things were learned about the wording:
 *
 * "ขอแบบถูกลง" was the first title and it asked the customer to admit, in writing and to a
 * stranger, that the price was beyond them. "ดูแบบเบี้ยถูกลง" asks for nothing and admits
 * nothing — it only looks — and lands on the same route.
 *
 * "ขอเวลาคิดก่อน" is the one that was missing. Everything on offer before assumed the reader
 * had already decided to go on; the reader who had not was left with no button at all, and the
 * only thing left to do with a message you cannot answer is ignore it. It is deliberately the
 * easiest tap here, because a tap is a reply: it opens Meta's window for another day, and it
 * tells the agent the difference between a lead who said no and a lead who has not read yet —
 * which silence never says. `stalls()` already answers it.
 */
export const FOLLOWUP_REPLIES = ["ดูแบบเบี้ยถูกลง", "ขอตารางมูลค่า", "สนใจสมัคร", "ขอเวลาคิดก่อน"];

/**
 * The second and last, sent as late in the day as the window allows.
 *
 * Its reader has now ignored the bot twice, so it does not ask again what the first one
 * asked. What it does is take the pressure off and say so truthfully — two is the cap, there
 * is no third — because the customer who is still deciding is often the one avoiding being
 * chased. It also leaves the quotation where they can find it, and says out loud that showing
 * it to someone at home is a normal thing to do, which for an inheritance policy it is.
 *
 * And a tap on any button is a reply, which opens Meta's window for another day.
 */
export const FOLLOWUP_LAST_TEXT = [
  "ผมไม่รบกวนต่อแล้วนะครับ 🙏",
  "ใบเสนอยังอยู่ในแชทนี้ เปิดดูหรือส่งให้ที่บ้านดูได้ตลอด ถ้ามีคำถามเมื่อไหร่ ทักมาได้เลยครับ",
].join("\n");

export const FOLLOWUP_LAST_REPLIES = ["ขอตารางมูลค่า", "ขอแบบถูกลง", "สนใจสมัคร"];

/**
 * Whether the second one goes out at all.
 *
 * Off since 2026-09-22, by the owner's decision: one message into a silence is enough, and a
 * customer who has already let the first one pass is not waiting to be told once more that
 * nobody will bother them. The text above is kept, not deleted, because this is a switch and
 * not a removal — flip it back and the message returns exactly as it was written.
 *
 * Only the sending stops. The queue still comes due at its hour and the thread is still
 * written down as stalled, so the agent still learns which quotations went cold.
 */
export const SECOND_FOLLOWUP = false;

/** How long a quotation is left to speak for itself. */
export const SILENCE_MS = 5 * 60_000;

/**
 * How long a page may write to someone who wrote to it. Meta's rule, not ours — outside it
 * the send is refused, so the follow-up is simply dropped.
 */
const WINDOW_HOURS = 24;

/**
 * The customer's page-scoped id, kept only while a follow-up is owed.
 *
 * It is the one thing about a conversation this project stores in a form it can read back,
 * and it exists for exactly one purpose: a message cannot be addressed without it. The column
 * is encrypted with the same passphrase the page token uses, emptied when the last of the two
 * messages is claimed, and deleted outright the moment either party speaks — and within the
 * day regardless.
 */
function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/**
 * Arm the follow-up for a thread that has just been quoted.
 *
 * The Page goes into the queue beside the id, because a page-scoped id is only an id to the
 * Page that issued it. With two Pages connected and no Page recorded, the send an hour later
 * took whichever token came to hand and Meta refused it: "ไม่พบผู้ใช้ที่แมตช์", three
 * customers quoted and then left in silence on the morning this was found.
 */
export async function armFollowup(
  channel: Channel, userHash: string, psid: string, pageId?: string, now: Date = new Date(),
): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_arm_followup", {
    p_channel: channel,
    p_user_hash: userHash,
    p_psid: psid,
    p_page_id: pageId ?? null,
    p_due_at: new Date(now.getTime() + SILENCE_MS).toISOString(),
    p_expires_at: new Date(now.getTime() + WINDOW_HOURS * 3600_000).toISOString(),
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(`ตั้งเวลาติดตามไม่สำเร็จ: ${error.message}`);
}

/** The customer wrote back, or the agent did: the id goes now rather than at expiry. */
export async function dropFollowup(channel: Channel, userHash: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_drop_followup", {
    p_channel: channel,
    p_user_hash: userHash,
  });
  if (error) console.error("ยกเลิกการติดตามไม่สำเร็จ:", error.message);
}

export interface Due {
  userHash: string;
  psid: string;
  /** the Page this thread belongs to; null on a row armed before the queue recorded one */
  pageId: string | null;
  /** 1 is the five-minute question, 2 the last one before the window shuts */
  stage: number;
}

/** What to send at each stage, and the buttons under it — or nothing, when the stage is off. */
export function followupMessage(stage: number): { text: string; replies: string[] } | null {
  if (stage >= 2) {
    return SECOND_FOLLOWUP ? { text: FOLLOWUP_LAST_TEXT, replies: FOLLOWUP_LAST_REPLIES } : null;
  }
  return { text: FOLLOWUP_TEXT, replies: FOLLOWUP_REPLIES };
}

/**
 * Every follow-up that has come due and is still wanted, claimed in the same statement that
 * reads it. A send that fails afterwards loses the message rather than repeating it, which is
 * the right way round: a customer who hears nothing is where they already were, and a
 * customer who hears the same question twice is being pestered.
 */
export async function claimDueFollowups(channel: Channel): Promise<Due[]> {
  const { data, error } = await supabaseAdmin().rpc("ins_claim_followups", {
    p_channel: channel,
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(`อ่านคิวติดตามไม่สำเร็จ: ${error.message}`);
  return ((data ?? []) as { user_hash: string; psid: string; page_id: string | null; stage: number }[])
    .filter((r) => r.psid)
    .map((r) => ({ userHash: r.user_hash, psid: r.psid, pageId: r.page_id ?? null, stage: r.stage ?? 1 }));
}

/** Rows past their day, sent or not. */
export async function sweepFollowups(): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_sweep_followups", {});
  if (error) console.error("เก็บกวาดคิวติดตามไม่สำเร็จ:", error.message);
}
