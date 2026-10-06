import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The rows behind Ads Studio's runs (spec 2026-10-07): one Organic post put on Facebook as one
 * ad set and one ad, under the Page's standing campaign (ins_ad_standing). Every Meta id is saved
 * the moment Meta returns it, so run.ts resumes a run from where it stopped instead of making a
 * second ad set or ad. Service role only, as every ins_* table.
 */

/** boosted as it stands, a new ad from a draft, or a new ad from the post after the boost was refused */
export type RunPath = "boost" | "new" | "fallback";
/** the last thing made on Meta */
export type RunStep = "none" | "adset" | "creative" | "ad";

export interface AdRun {
  id: string;
  createdAt: string;
  pageId: string;
  actId: string;
  /** the Organic post; null once it is deleted */
  contentId: string | null;
  path: RunPath;
  /** "<page>_<post>" the boost uses, once known */
  storyId: string | null;
  dailyBudgetMinor: number;
  endAt: string;
  metaCampaignId: string;
  adsetId: string | null;
  imageHash: string | null;
  creativeId: string | null;
  adId: string | null;
  step: RunStep;
  error: string | null;
  pausedAt: string | null;
  createdBy: string | null;
}

export interface NewRun {
  pageId: string;
  actId: string;
  contentId: string;
  path: "boost" | "new";
  storyId: string | null;
  dailyBudgetMinor: number;
  endAt: string;
  metaCampaignId: string;
  createdBy: string;
}

export type RunPatch = Partial<Pick<AdRun, "path" | "storyId" | "adsetId" | "imageHash" | "creativeId" | "adId" | "step" | "error" | "pausedAt" | "dailyBudgetMinor" | "endAt">>;

const COLUMNS: Record<keyof RunPatch, string> = {
  path: "path",
  storyId: "story_id",
  adsetId: "adset_id",
  imageHash: "image_hash",
  creativeId: "creative_id",
  adId: "ad_id",
  step: "step",
  error: "error",
  pausedAt: "paused_at",
  dailyBudgetMinor: "daily_budget_minor",
  endAt: "end_at",
};

function fromRow(r: Record<string, unknown>): AdRun {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    pageId: r.page_id as string,
    actId: r.act_id as string,
    contentId: (r.content_id as string | null) ?? null,
    path: r.path as RunPath,
    storyId: (r.story_id as string | null) ?? null,
    dailyBudgetMinor: r.daily_budget_minor as number,
    endAt: r.end_at as string,
    metaCampaignId: r.meta_campaign_id as string,
    adsetId: (r.adset_id as string | null) ?? null,
    imageHash: (r.image_hash as string | null) ?? null,
    creativeId: (r.creative_id as string | null) ?? null,
    adId: (r.ad_id as string | null) ?? null,
    step: r.step as RunStep,
    error: (r.error as string | null) ?? null,
    pausedAt: (r.paused_at as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
  };
}

/**
 * A new run, or null when the post already has an open one (no ad yet, not dropped): the
 * database allows one (ins_ad_run_one_open), so two presses cannot both make an ad set for it.
 */
export async function createRun(r: NewRun): Promise<AdRun | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_run")
    .insert({
      page_id: r.pageId,
      act_id: r.actId,
      content_id: r.contentId,
      path: r.path,
      story_id: r.storyId,
      daily_budget_minor: r.dailyBudgetMinor,
      end_at: r.endAt,
      meta_campaign_id: r.metaCampaignId,
      created_by: r.createdBy,
    })
    .select("*")
    .single();
  if (error && (error as { code?: string }).code === "23505") return null;
  if (error) throw new Error(error.message);
  return fromRow(data as Record<string, unknown>);
}

export async function getRun(id: string): Promise<AdRun | null> {
  const { data, error } = await supabaseAdmin().from("ins_ad_run").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data as Record<string, unknown>) : null;
}

/** A Page's runs, newest first. */
export async function listRuns(pageId: string): Promise<AdRun[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_run")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow);
}

/** Writes only the fields given. */
export async function saveRun(id: string, patch: RunPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) row[COLUMNS[key as keyof RunPatch]] = value;
  }
  const { error } = await supabaseAdmin().from("ins_ad_run").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Takes the run to work on it: true if this request now holds it. One conditional update decides,
 * as claimSend does; the timestamp is quoted for PostgREST. A claim older than staleMs is a request
 * that died and may be taken over.
 */
export async function claimRun(id: string, staleMs: number, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - staleMs).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_run")
    .update({ claimed_at: now.toISOString() })
    .eq("id", id)
    .or(`claimed_at.is.null,claimed_at.lt."${staleBefore}"`)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

export async function releaseRun(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ad_run").update({ claimed_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** The Page's standing campaign in this ad account, or null when none was made yet. */
export async function getStanding(pageId: string, actId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_standing")
    .select("meta_campaign_id")
    .eq("page_id", pageId)
    .eq("act_id", actId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { meta_campaign_id: string } | null)?.meta_campaign_id ?? null;
}

export async function saveStanding(pageId: string, actId: string, metaCampaignId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ins_ad_standing")
    .upsert(
      { page_id: pageId, act_id: actId, meta_campaign_id: metaCampaignId, updated_at: new Date().toISOString() },
      { onConflict: "page_id,act_id" },
    );
  if (error) throw new Error(error.message);
}
