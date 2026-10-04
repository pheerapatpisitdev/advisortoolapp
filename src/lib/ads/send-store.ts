import { CLAIM_STALE_MS } from "@/lib/ads/launch-store";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where one batch send to Facebook is kept: ins_ad_send and ins_ad_send_item, service_role only.
 *
 * A send is one Meta campaign and one ad set with an ad per piece. The rows are what the send
 * resumes from: each Meta id is saved the moment it exists, with the last step that finished,
 * so a retry carries on where it broke instead of making a second campaign — the same idea as
 * launch-store.ts, for a batch. Column names are snake_case in the tables and camelCase here;
 * the conversion happens in this file and nowhere else.
 */

/** The last step that finished; 'none' before anything has been made on Meta. */
export type SendStep = "none" | "campaign" | "adset" | "ads";

export interface AdSend {
  id: string;
  createdAt: string;
  /** null once the Studio campaign was deleted; the send record stays for its ad ids */
  campaignId: string | null;
  /** Meta's ad account id, with its `act_` prefix */
  actId: string;
  pageId: string;
  link: string;
  currency: string;
  /** minor units of the currency (satang for THB), as Meta takes them */
  dailyBudgetMinor: number;
  metaCampaignId: string | null;
  adsetId: string | null;
  step: SendStep;
  /** why the last attempt stopped; null when it did not */
  error: string | null;
  /** when a request took the send to run it; null when nobody holds it */
  claimedAt: string | null;
  /** when the owner switched the whole send on; null while it is still paused */
  activatedAt: string | null;
  /** when the owner paused it again after switching on */
  pausedAt: string | null;
  superseded: boolean;
  createdBy: string | null;
}

export interface AdSendItem {
  id: string;
  sendId: string;
  /** null once the piece was deleted */
  pieceId: string | null;
  imageHash: string | null;
  creativeId: string | null;
  adId: string | null;
  /** why this piece's ad could not be made; null when it could */
  error: string | null;
}

/** What a send starts from: the form's values, before anything is made on Meta. */
export interface NewSend {
  campaignId: string;
  actId: string;
  pageId: string;
  link: string;
  currency: string;
  dailyBudgetMinor: number;
  createdBy?: string | null;
}

/** What saveSendStep may change: the ids Meta hands back, and the step they complete. */
export type SendStepPatch = Partial<Pick<AdSend, "metaCampaignId" | "adsetId" | "step">>;

/** What saveItem may change: the ids Meta hands back for one piece. */
export type ItemPatch = Partial<Pick<AdSendItem, "imageHash" | "creativeId" | "adId">>;

interface SendDb {
  id: string;
  created_at: string;
  campaign_id: string | null;
  act_id: string;
  page_id: string;
  link: string;
  currency: string;
  daily_budget_minor: number;
  meta_campaign_id: string | null;
  adset_id: string | null;
  step: SendStep;
  error: string | null;
  claimed_at: string | null;
  activated_at: string | null;
  paused_at: string | null;
  superseded: boolean;
  created_by: string | null;
}

interface ItemDb {
  id: string;
  send_id: string;
  piece_id: string | null;
  image_hash: string | null;
  creative_id: string | null;
  ad_id: string | null;
  error: string | null;
}

function sendFromDb(r: SendDb): AdSend {
  return {
    id: r.id,
    createdAt: r.created_at,
    campaignId: r.campaign_id,
    actId: r.act_id,
    pageId: r.page_id,
    link: r.link,
    currency: r.currency,
    dailyBudgetMinor: r.daily_budget_minor,
    metaCampaignId: r.meta_campaign_id,
    adsetId: r.adset_id,
    step: r.step,
    error: r.error,
    claimedAt: r.claimed_at,
    activatedAt: r.activated_at,
    pausedAt: r.paused_at,
    superseded: r.superseded,
    createdBy: r.created_by,
  };
}

function itemFromDb(r: ItemDb): AdSendItem {
  return {
    id: r.id,
    sendId: r.send_id,
    pieceId: r.piece_id,
    imageHash: r.image_hash,
    creativeId: r.creative_id,
    adId: r.ad_id,
    error: r.error,
  };
}

/** Starts a send with an item for each piece, once each; nothing is on Meta yet. */
export async function createSend(s: NewSend, pieceIds: string[]): Promise<{ send: AdSend; items: AdSendItem[] }> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ins_ad_send")
    .insert({
      campaign_id: s.campaignId,
      act_id: s.actId,
      page_id: s.pageId,
      link: s.link,
      currency: s.currency,
      daily_budget_minor: s.dailyBudgetMinor,
      created_by: s.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const send = sendFromDb(data as SendDb);

  const unique = [...new Set(pieceIds)];
  if (unique.length === 0) return { send, items: [] };
  const { data: itemRows, error: itemErr } = await db
    .from("ins_ad_send_item")
    .insert(unique.map((pieceId) => ({ send_id: send.id, piece_id: pieceId })))
    .select("*");
  if (itemErr) {
    // a send with no items would hold the campaign's pieces as "sent" for nothing: take it back
    await db.from("ins_ad_send").delete().eq("id", send.id);
    throw new Error(itemErr.message);
  }
  return { send, items: ((itemRows ?? []) as ItemDb[]).map(itemFromDb) };
}

export async function getSend(id: string): Promise<AdSend | null> {
  const { data, error } = await supabaseAdmin().from("ins_ad_send").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sendFromDb(data as SendDb) : null;
}

/** A send's items, in no particular order. */
export async function listItems(sendId: string): Promise<AdSendItem[]> {
  const { data, error } = await supabaseAdmin().from("ins_ad_send_item").select("*").eq("send_id", sendId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ItemDb[]).map(itemFromDb);
}

/** A campaign's live sends, newest first, each with its items. A retired (superseded) send is left out. */
export async function listSends(campaignId: string): Promise<(AdSend & { items: AdSendItem[] })[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ins_ad_send")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("superseded", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const sends = ((data ?? []) as SendDb[]).map(sendFromDb);
  if (sends.length === 0) return [];

  const { data: itemRows, error: itemErr } = await db
    .from("ins_ad_send_item")
    .select("*")
    .in("send_id", sends.map((s) => s.id));
  if (itemErr) throw new Error(itemErr.message);
  const bySend = new Map<string, AdSendItem[]>();
  for (const r of (itemRows ?? []) as ItemDb[]) {
    const item = itemFromDb(r);
    bySend.set(item.sendId, [...(bySend.get(item.sendId) ?? []), item]);
  }
  return sends.map((s) => ({ ...s, items: bySend.get(s.id) ?? [] }));
}

/** Saves what a finished step produced, and clears the error left by an earlier try. */
export async function saveSendStep(id: string, patch: SendStepPatch): Promise<void> {
  const columns: Record<string, unknown> = { error: null };
  if (patch.metaCampaignId !== undefined) columns.meta_campaign_id = patch.metaCampaignId;
  if (patch.adsetId !== undefined) columns.adset_id = patch.adsetId;
  if (patch.step !== undefined) columns.step = patch.step;
  const { error } = await supabaseAdmin().from("ins_ad_send").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Records why the send stopped; the step stays where it was, so a retry resumes there. */
export async function saveSendError(id: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_send").update({ error: message }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Saves the ids Meta handed back for one piece, and clears the error left by an earlier try. */
export async function saveItem(id: string, patch: ItemPatch): Promise<void> {
  const columns: Record<string, unknown> = { error: null };
  if (patch.imageHash !== undefined) columns.image_hash = patch.imageHash;
  if (patch.creativeId !== undefined) columns.creative_id = patch.creativeId;
  if (patch.adId !== undefined) columns.ad_id = patch.adId;
  const { error } = await supabaseAdmin().from("ins_ad_send_item").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Records why one piece's ad could not be made; the rest of the send goes on. */
export async function saveItemError(id: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_send_item").update({ error: message }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Removes a send that made nothing on Meta, with its items (they go with it, by the foreign key):
 * true if it was removed. Used by a send that stood down because an earlier send holds its
 * pieces, so it neither keeps those pieces locked nor can be resumed later. The delete is
 * conditional — step 'none' and no Meta campaign — so a send that has anything on Meta is never
 * removed, whatever the caller thought.
 */
export async function dropSend(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_send")
    .delete()
    .eq("id", id)
    .eq("step", "none")
    .is("meta_campaign_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/**
 * Takes the send to run it: true if this request now holds it, false if another does.
 *
 * One conditional update decides who goes on, so two presses or two tabs do not both make the
 * next object on Meta. The timestamp is quoted for PostgREST, since it holds its reserved "."
 * and ":". A claim older than staleMs is a request that died and may be taken over.
 */
export async function claimSend(id: string, staleMs = CLAIM_STALE_MS, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - staleMs).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_send")
    .update({ claimed_at: now.toISOString() })
    .eq("id", id)
    .or(`claimed_at.is.null,claimed_at.lt."${staleBefore}"`)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/** Gives the send back once the request is done with it, whether the steps worked or not. */
export async function releaseSend(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_send").update({ claimed_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markSendActivated(id: string, at: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_send").update({ activated_at: at }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markSendPaused(id: string, at: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_send").update({ paused_at: at }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Every piece of the campaign that is in a live send. A retired (superseded) send frees its
 * pieces to be sent again, so they are not here.
 */
export async function sentPieceIds(campaignId: string): Promise<Set<string>> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ins_ad_send")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("superseded", false);
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return new Set();

  const { data: items, error: itemErr } = await db.from("ins_ad_send_item").select("piece_id").in("send_id", ids);
  if (itemErr) throw new Error(itemErr.message);
  return new Set(((items ?? []) as { piece_id: string | null }[]).flatMap((r) => (r.piece_id ? [r.piece_id] : [])));
}
