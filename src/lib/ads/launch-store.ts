import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where one attempt to launch an ad on Facebook is kept: ins_ad_launch, service_role only.
 *
 * The row is the record the launch resumes from. Each Meta id is saved the moment it exists,
 * with the last step that finished, so a retry carries on at the step that broke instead of
 * making a second campaign. Column names are snake_case in the table and camelCase here; the
 * conversion happens in this file and nowhere else.
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

/** What a launch starts from: the form's values, before anything is made on Meta. */
export interface NewLaunch {
  pieceId: string;
  actId: string;
  pageId: string;
  link: string;
  currency: string;
  dailyBudgetMinor: number;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  createdBy?: string | null;
}

/** What saveStep may change: the ids Meta hands back, and the step they complete. */
export type StepPatch = Partial<Pick<LaunchRow, "campaignId" | "adsetId" | "imageHash" | "creativeId" | "adId" | "step">>;

/** Postgres's code for a unique-index violation. */
const UNIQUE_VIOLATION = "23505";

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

export async function getLaunch(id: string): Promise<LaunchRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_ad_launch").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromDb(data as DbRow) : null;
}

/**
 * Starts an attempt, or hands back the one already running.
 *
 * Two clicks, or two tabs, can both get here for the same piece and account; the table's
 * unique index lets only one insert through. The loser is not an error — it is given the
 * winner's row with created:false, so both go on to resume the same launch.
 */
export async function createLaunch(input: NewLaunch): Promise<{ row: LaunchRow; created: boolean }> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_launch")
    .insert({
      piece_id: input.pieceId,
      act_id: input.actId,
      page_id: input.pageId,
      link: input.link,
      currency: input.currency,
      daily_budget_minor: input.dailyBudgetMinor,
      headline: input.headline ?? null,
      primary_text: input.primaryText ?? null,
      description: input.description ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (!error) return { row: fromDb(data as DbRow), created: true };
  if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
  const row = await findLaunch(input.pieceId, input.actId);
  // the winner was retired between the clash and this read — nothing to hand back
  if (!row) throw new Error(error.message);
  return { row, created: false };
}

/** Saves what a finished step produced, and clears the error left by an earlier try. */
export async function saveStep(id: string, patch: StepPatch): Promise<void> {
  const columns: Record<string, unknown> = { error: null };
  if (patch.campaignId !== undefined) columns.campaign_id = patch.campaignId;
  if (patch.adsetId !== undefined) columns.adset_id = patch.adsetId;
  if (patch.imageHash !== undefined) columns.image_hash = patch.imageHash;
  if (patch.creativeId !== undefined) columns.creative_id = patch.creativeId;
  if (patch.adId !== undefined) columns.ad_id = patch.adId;
  if (patch.step !== undefined) columns.step = patch.step;
  const { error } = await supabaseAdmin().from("ins_ad_launch").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Records why the launch stopped; the step stays where it was, so a retry resumes there. */
export async function saveError(id: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_launch").update({ error: message }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markActivated(id: string, at: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_launch").update({ activated_at: at }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Retires an attempt so the piece and account can be launched afresh. */
export async function supersede(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_launch").update({ superseded: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * A claim older than this is a request that died: the launch may be claimed again.
 *
 * Longer than a whole run can take while holding it — five requests to Meta, each allowed
 * REQUEST_TIMEOUT_MS in launch.ts — so a run that is merely slow is never taken over. At two
 * minutes a run stuck on slow answers could still be going when a second press claimed it,
 * and both would make the next object.
 */
export const CLAIM_STALE_MS = 180_000;

/**
 * Takes the launch to run it: true if this request now holds it, false if another does.
 *
 * createLaunch hands the same row to two concurrent requests; without this both would resume
 * at the same step and both create a campaign on Meta. One conditional update decides who
 * goes on. The timestamp is quoted for PostgREST, since it holds its reserved "." and ":".
 */
export async function claimLaunch(id: string, staleMs = CLAIM_STALE_MS, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - staleMs).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_launch")
    .update({ claimed_at: now.toISOString() })
    .eq("id", id)
    .or(`claimed_at.is.null,claimed_at.lt."${staleBefore}"`)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

/** Gives the launch back once the request is done with it, whether the steps worked or not. */
export async function releaseLaunch(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_launch").update({ claimed_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}
