import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where the ads launched one by one are kept: ins_ad_launch, service_role only. Nothing writes
 * to it any more (batch sends replaced it); rows made earlier are only read, to tell a piece
 * already on Facebook. Column names are snake_case in the table and camelCase here.
 */

/** The last step that finished; 'none' before anything has been made on Meta. */
export type LaunchStep = "none" | "campaign" | "adset" | "creative" | "ad";

export interface LaunchRow {
  id: string;
  createdAt: string;
  /** null once the piece was deleted; the launch record stays for its ad ids */
  pieceId: string | null;
  /** Meta's ad account id, with its `act_` prefix */
  actId: string;
  pageId: string;
  link: string;
  currency: string;
  /** minor units of the currency (satang for THB), as Meta takes them */
  dailyBudgetMinor: number;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  campaignId: string | null;
  adsetId: string | null;
  imageHash: string | null;
  creativeId: string | null;
  adId: string | null;
  step: LaunchStep;
  /** why the last attempt stopped; null when it did not */
  error: string | null;
  /** when the owner switched it on; null while it is still paused */
  activatedAt: string | null;
  /** when a request took the launch to run it; null when nobody holds it */
  claimedAt: string | null;
  superseded: boolean;
  createdBy: string | null;
}

interface DbRow {
  id: string;
  created_at: string;
  piece_id: string | null;
  act_id: string;
  page_id: string;
  link: string;
  currency: string;
  daily_budget_minor: number;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  image_hash: string | null;
  creative_id: string | null;
  ad_id: string | null;
  step: LaunchStep;
  error: string | null;
  activated_at: string | null;
  claimed_at: string | null;
  superseded: boolean;
  created_by: string | null;
}

function fromDb(r: DbRow): LaunchRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    pieceId: r.piece_id,
    actId: r.act_id,
    pageId: r.page_id,
    link: r.link,
    currency: r.currency,
    dailyBudgetMinor: r.daily_budget_minor,
    headline: r.headline,
    primaryText: r.primary_text,
    description: r.description,
    campaignId: r.campaign_id,
    adsetId: r.adset_id,
    imageHash: r.image_hash,
    creativeId: r.creative_id,
    adId: r.ad_id,
    step: r.step,
    error: r.error,
    activatedAt: r.activated_at,
    claimedAt: r.claimed_at,
    superseded: r.superseded,
    createdBy: r.created_by,
  };
}

/** The live attempt for a piece in an ad account — a retired (superseded) one does not count. */
export async function findLaunch(pieceId: string, actId: string): Promise<LaunchRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_launch")
    .select("*")
    .eq("piece_id", pieceId)
    .eq("act_id", actId)
    .eq("superseded", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromDb(data as DbRow) : null;
}

/**
 * A claim older than this is a request that died: its row may be claimed again. Kept here for
 * send-store.ts, which holds a send for the same span.
 */
export const CLAIM_STALE_MS = 180_000;
