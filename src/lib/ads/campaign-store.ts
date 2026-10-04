import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { COLUMNS, toItem, type ContentItem } from "@/lib/content/store";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where Ads Studio campaigns are kept: ins_ad_campaign, service_role only.
 *
 * A campaign is one insurance product on one Facebook Page, with how many angles and tones the
 * owner wants written for it. It is Studio's own grouping: the Meta campaign is made per launch.
 * Column names are snake_case in the table and camelCase here; the conversion happens in this
 * file and nowhere else.
 */

export interface AdCampaign {
  id: string;
  createdAt: string;
  /** the Page whose project it is; a campaign never moves to another */
  pageId: string;
  /** the plan it advertises */
  planHref: string;
  name: string | null;
  angles: number;
  tones: number;
  theme: string | null;
  hint: string | null;
  /** the agent who made it; null when the owner did */
  agentId: string | null;
}

interface DbRow {
  id: string;
  created_at: string;
  page_id: string;
  plan_href: string;
  name: string | null;
  angles: number;
  tones: number;
  theme: string | null;
  hint: string | null;
  agent_id: string | null;
}

function fromDb(r: DbRow): AdCampaign {
  return {
    id: r.id,
    createdAt: r.created_at,
    pageId: r.page_id,
    planHref: r.plan_href,
    name: r.name,
    angles: r.angles,
    tones: r.tones,
    theme: r.theme,
    hint: r.hint,
    agentId: r.agent_id,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Held to 1..max: the writer cannot honour more than it has angles and tones for. */
function clamp(n: number, max: number): number {
  return Math.min(max, Math.max(1, Number.isFinite(n) ? Math.round(n) : 1));
}

/** A Page's campaigns, newest first. */
export async function listCampaigns(pageId: string): Promise<AdCampaign[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_campaign")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map(fromDb);
}

/**
 * One campaign, or null when there is none. An id from the address bar may be anything, and
 * Postgres throws on a uuid column given a non-uuid, so that is answered here without asking.
 */
export async function getCampaign(id: string): Promise<AdCampaign | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabaseAdmin().from("ins_ad_campaign").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromDb(data as DbRow) : null;
}

export async function createCampaign(c: {
  pageId: string;
  planHref: string;
  name?: string | null;
  angles: number;
  tones: number;
  theme?: string | null;
  hint?: string | null;
  agentId: string | null;
}): Promise<AdCampaign> {
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_campaign")
    .insert({
      page_id: c.pageId,
      plan_href: c.planHref,
      name: c.name ?? null,
      angles: clamp(c.angles, MAX_ANGLES),
      tones: clamp(c.tones, MAX_TONES),
      theme: c.theme ?? null,
      hint: c.hint ?? null,
      agent_id: c.agentId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromDb(data as DbRow);
}

/** Changes only what is given; the Page and plan are not editable. */
export async function updateCampaign(
  id: string,
  patch: Partial<Pick<AdCampaign, "name" | "angles" | "tones" | "theme" | "hint">>,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.angles !== undefined) columns.angles = clamp(patch.angles, MAX_ANGLES);
  if (patch.tones !== undefined) columns.tones = clamp(patch.tones, MAX_TONES);
  if (patch.theme !== undefined) columns.theme = patch.theme;
  if (patch.hint !== undefined) columns.hint = patch.hint;
  if (Object.keys(columns).length === 0) return;
  const { error } = await supabaseAdmin().from("ins_ad_campaign").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Every piece filed in a campaign, whatever its state, newest first. */
export async function listCampaignPieces(campaignId: string): Promise<ContentItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_content")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toItem);
}
