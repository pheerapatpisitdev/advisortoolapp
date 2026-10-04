import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Referral } from "@/lib/facebook/events";
import type { Channel } from "./session";
import { sendConversion } from "@/lib/meta/capi";

/**
 * What the bot keeps about a conversation, and the only place that writes it.
 *
 * Nothing here throws. Every one of these is called after the customer already has their
 * answer, so a database that is down costs a row in a report — not a person left waiting in
 * an inbox that was paid for. The caller is never handed a failure it could act on anyway.
 */

/**
 * The kinds `ins_record` knows.
 *
 * They are not ours to choose. The function matches these exact strings to decide which
 * milestone to stamp and which counter to raise, so a kind spelled any other way is stored as
 * a row and moves nothing — the quietest bug this table can have. `failed` is the deliberate
 * exception: it is worth a row and there is no milestone it should move.
 */
export type EventKind =
  | "message"
  | "routed" | "plan_info" | "small_talk"
  | "quoted"
  | "form_sent" | "form_done"
  | "agent_replied" | "stalled" | "handover"
  /** a would-be agent handed to the owner (src/lib/assistant/recruit.ts) */
  | "recruit_interest"
  | "failed";

/** One thing that happened, and the figures describing it — never the customer's words. */
export interface RecordedEvent {
  kind: EventKind;
  data?: Record<string, unknown>;
}

/** The stages a lead climbs through. `ins_open_lead` only ever lets it climb. */
export type LeadStage = "interested" | "form_sent" | "form_done";

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/** Open a row for a conversation starting now, and return its id. */
export async function openConversation(
  channel: Channel,
  pageId: string,
  userHash: string,
  referral: Referral | undefined,
  entryPayload: string | undefined,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_open_conversation", {
      p_channel: channel,
      p_page_id: pageId,
      p_user_hash: userHash,
      p_source: referral?.source ?? "organic",
      p_ad_id: referral?.ad_id ?? null,
      p_ref: referral?.ref ?? null,
      p_referral: referral ?? null,
      p_entry_payload: entryPayload ?? null,
    });
    if (error) throw new Error(error.message);
    const id = (data as string | null) ?? null;
    // Messenger ads never load the pixel. Tell Meta this conversation came from one.
    if (id && channel === "facebook" && referral?.ad_id) {
      void sendConversion({
        eventName: "Lead",
        eventId: `${id}:open`,
        actionSource: "business_messaging",
        externalId: id,
        customData: { ad_id: referral.ad_id },
      });
    }
    return id;
  } catch (e) {
    console.error("เปิดบทสนทนาไม่สำเร็จ:", e);
    return null;
  }
}

/**
 * Name the advertisement on a conversation already open.
 *
 * `ins_attribute` coalesces, so the first advert to claim a conversation keeps it: someone who
 * comes back through a second one is still counted for the advert that found them.
 */
export async function attribute(
  conversationId: string | null, referral: Referral | undefined,
): Promise<void> {
  if (!conversationId || !referral) return;
  try {
    const { error } = await supabaseAdmin().rpc("ins_attribute", {
      p_conversation: conversationId,
      p_source: referral.source ?? null,
      p_ad_id: referral.ad_id ?? null,
      p_ref: referral.ref ?? null,
      p_referral: referral,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("บันทึกที่มาของลูกค้าไม่สำเร็จ:", e);
  }
}

/**
 * Everything one turn did, in one statement.
 *
 * One call rather than one per event because the same statement raises the counters and
 * stamps the milestones: split in two, a retry of the second half would count the turn twice.
 */
export async function record(
  conversationId: string | null,
  events: RecordedEvent[],
  product: string | null,
  unanswered: { intent?: string; route?: string; question: string }[] = [],
): Promise<void> {
  if (!conversationId || (events.length === 0 && unanswered.length === 0)) return;
  try {
    const { error } = await supabaseAdmin().rpc("ins_record", {
      p_conversation: conversationId,
      p_events: events.map((e) => ({ kind: e.kind, data: e.data ?? {} })),
      p_product: product,
      p_unanswered: unanswered,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("บันทึกเหตุการณ์ไม่สำเร็จ:", e);
  }
}

/**
 * The customer asked to go further, so their id is kept — encrypted — against this conversation.
 *
 * `ins_open_lead` is an upsert of one lead per conversation whose stage only climbs: calling
 * it again with `interested` after `form_done` leaves `form_done` where it is.
 */
export async function openLead(
  conversationId: string | null,
  psid: string,
  stage: LeadStage,
  product: string | null,
  formRef?: string,
): Promise<string | null> {
  if (!conversationId) return null;
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_open_lead", {
      p_conversation: conversationId,
      p_psid: psid,
      p_passphrase: passphrase(),
      p_stage: stage,
      p_product: product,
      p_form_ref: formRef ?? null,
    });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("เปิดรายชื่อผู้สนใจไม่สำเร็จ:", e);
    return null;
  }
}

/**
 * Mark the conversation this person was last having as one that went quiet.
 *
 * The follow-up queue carries no conversation id, and a thread silent long enough to reach the
 * second follow-up may have a session too stale to hold one — so the conversation is found by
 * the hash it was opened under, newest first.
 *
 * `channel` is taken and not filtered on: `ins_conversations` is Facebook-only today, and a
 * second channel should make this a one-line change rather than a puzzle.
 */
export async function markStalled(channel: Channel, userHash: string): Promise<void> {
  void channel;
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_conversations")
      .select("id")
      .eq("user_hash", userHash)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const id = (data as { id?: string } | null)?.id;
    if (!id) return;
    await record(id, [{ kind: "stalled" }], null);
  } catch (e) {
    console.error("บันทึกบทสนทนาที่เงียบหายไม่สำเร็จ:", e);
  }
}
