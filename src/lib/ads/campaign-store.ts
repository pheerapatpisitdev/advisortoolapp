import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import type { PiecePerson } from "@/lib/content/people";
import { COLUMNS, toItem, type ContentItem } from "@/lib/content/store";
import { personPick } from "@/lib/ads/picture-picks";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Where Ads Studio campaigns are kept: ins_ad_campaign, service_role only.
 *
 * A campaign is one insurance product on one Facebook Page, with how many angles and tones the
 * owner wants written for it (the dimensions and queue_pos columns stay in the table, unused). It is Studio's own grouping: the Meta campaign is made per launch.
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
  /** the agent who made it: the viewer's agent id (the owner's own, when the owner made it) */
  agentId: string | null;
  /** the voice of the brand in the owner's words; null when none was given */
  brandVoice: string | null;
  /** ภาพและโมเดล (picture-picks.ts): the writer and painter ids, null for อัตโนมัติ */
  writer: string | null;
  painter: string | null;
  /** who from the people library is in its pictures; null for nobody */
  person: PiecePerson | null;
  /** บรีฟภาพเพิ่มเติม, drawn to after each picture's style; null for none */
  pictureBrief: string | null;
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
  brand_voice?: string | null;
  writer?: string | null;
  painter?: string | null;
  person?: unknown;
  picture_brief?: string | null;
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
    brandVoice: r.brand_voice ?? null,
    writer: r.writer ?? null,
    painter: r.painter ?? null,
    person: personPick(r.person),
    pictureBrief: r.picture_brief ?? null,
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
  brandVoice?: string | null;
  writer?: string | null;
  painter?: string | null;
  person?: PiecePerson | null;
  pictureBrief?: string | null;
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
      brand_voice: c.brandVoice ?? null,
      writer: c.writer ?? null,
      painter: c.painter ?? null,
      person: c.person ?? null,
      picture_brief: c.pictureBrief ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return fromDb(data as DbRow);
}

/** Changes only what is given; the Page and plan are not editable. */
export async function updateCampaign(
  id: string,
  patch: Partial<Pick<AdCampaign, "name" | "angles" | "tones" | "theme" | "hint" | "brandVoice" | "writer" | "painter" | "person" | "pictureBrief">>,
): Promise<void> {
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.angles !== undefined) columns.angles = clamp(patch.angles, MAX_ANGLES);
  if (patch.tones !== undefined) columns.tones = clamp(patch.tones, MAX_TONES);
  if (patch.theme !== undefined) columns.theme = patch.theme;
  if (patch.hint !== undefined) columns.hint = patch.hint;
  if (patch.brandVoice !== undefined) columns.brand_voice = patch.brandVoice;
  if (patch.writer !== undefined) columns.writer = patch.writer;
  if (patch.painter !== undefined) columns.painter = patch.painter;
  if (patch.person !== undefined) columns.person = patch.person;
  if (patch.pictureBrief !== undefined) columns.picture_brief = patch.pictureBrief;
  if (Object.keys(columns).length === 0) return;
  const { error } = await supabaseAdmin().from("ins_ad_campaign").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Removes a campaign row. Its pieces and sends stay: their campaign_id is set null by the
 * foreign keys, so a sent ad's ids and spending history outlive the campaign. Whether it may go
 * (nothing switched on) is the caller's to decide.
 */
export async function deleteCampaign(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const { error } = await supabaseAdmin().from("ins_ad_campaign").delete().eq("id", id);
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

/** Ids per read, so a long `in (...)` stays within the address length a request allows. */
const CHUNK = 100;

/**
 * For Studio's front page: each Page's campaigns, and how many of their pieces have a live
 * (not superseded) launch. A Page with no campaign is not in the map. Three reads however many
 * campaigns there are: the campaigns, the live launches, then the pieces those launches are for
 * (to say which campaign each belongs to). A piece launched on two ad accounts counts once.
 */
export async function campaignCountsByPage(): Promise<Map<string, { campaigns: number; launched: number }>> {
  const db = supabaseAdmin();
  const out = new Map<string, { campaigns: number; launched: number }>();

  const { data: camps, error: campErr } = await db.from("ins_ad_campaign").select("id, page_id");
  if (campErr) throw new Error(campErr.message);
  const pageOf = new Map<string, string>();
  for (const c of (camps ?? []) as { id: string; page_id: string }[]) {
    pageOf.set(c.id, c.page_id);
    const n = out.get(c.page_id) ?? { campaigns: 0, launched: 0 };
    n.campaigns += 1;
    out.set(c.page_id, n);
  }
  if (pageOf.size === 0) return out;

  const { data: launches, error: launchErr } = await db.from("ins_ad_launch").select("piece_id").eq("superseded", false);
  if (launchErr) throw new Error(launchErr.message);
  const launched = [...new Set(((launches ?? []) as { piece_id: string | null }[]).flatMap((l) => (l.piece_id ? [l.piece_id] : [])))];

  for (let i = 0; i < launched.length; i += CHUNK) {
    const { data: pieces, error: pieceErr } = await db.from("ins_content").select("id, campaign_id").in("id", launched.slice(i, i + CHUNK));
    if (pieceErr) throw new Error(pieceErr.message);
    for (const p of (pieces ?? []) as { id: string; campaign_id: string | null }[]) {
      const page = p.campaign_id ? pageOf.get(p.campaign_id) : undefined;
      if (page) out.get(page)!.launched += 1;
    }
  }
  return out;
}
