import { supabaseAdmin } from "@/lib/supabase/admin";
import { adAccountToken } from "@/lib/facebook/ads-connection";

/**
 * Which Page each synced advertisement promotes, so Ads Studio can show the campaigns built in
 * Meta Ads Manager under the Page they are for (owner, 2026-10-06).
 *
 * Meta's insights name an ad's campaign and account, never its Page. The creative does: its
 * story spec names the Page, its published post's id starts with the Page's id, and its actor is
 * the Page. Asked once per ad — rows already answered lend their answer to the ad's new days, and
 * an ad Meta cannot describe is written '' so it is not asked about again.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
/**
 * One request per ad: Meta's ?ids= batch read is refused from v26 ("The ids query parameter is
 * deprecated"), whatever version the URL names. A few at a time, as only new ads are asked.
 */
const AT_ONCE = 5;
const FIELDS = "creative{actor_id,effective_object_story_id,object_story_spec{page_id}}";
/** rows looked at in one night; the rest wait for the next */
const MAX_ROWS = 5000;

export interface Creative {
  actor_id?: string;
  effective_object_story_id?: string;
  object_story_spec?: { page_id?: string };
}

/** The Page a creative speaks for, or "" when it names none. */
export function pageOfCreative(c: Creative | undefined): string {
  if (!c) return "";
  const spec = c.object_story_spec?.page_id;
  if (spec) return spec;
  const story = c.effective_object_story_id?.split("_")[0];
  if (story && /^\d+$/.test(story)) return story;
  return c.actor_id && /^\d+$/.test(c.actor_id) ? c.actor_id : "";
}

/** Each ad's Page, asked of Meta; an ad Meta will not describe is "", one whose request failed is absent. */
export async function lookUpPages(adIds: string[], token: string, fetchFn: typeof fetch = fetch): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const one = async (id: string) => {
    try {
      const res = await fetchFn(`${GRAPH}/${encodeURIComponent(id)}?fields=${encodeURIComponent(FIELDS)}`, {
        headers: { authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const body = (await res.json()) as { creative?: Creative; error?: { code?: number } };
      // gone or not ours (Meta's 100): nothing to ask again; anything else is tried again tomorrow
      if (!res.ok || body.error) {
        if (body.error?.code === 100) out.set(id, "");
        return;
      }
      out.set(id, pageOfCreative(body.creative));
    } catch {
      // a dropped connection leaves the ad to the next night
    }
  };
  for (let i = 0; i < adIds.length; i += AT_ONCE) await Promise.all(adIds.slice(i, i + AT_ONCE).map(one));
  return out;
}

/**
 * Fills page_id on the rows that have none. Best effort: whatever fails is left null and tried
 * again on the next sync, so the figures themselves never wait on it.
 */
export async function fillAdPages(fetchFn: typeof fetch = fetch): Promise<{ looked: number; filled: number }> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("ins_ad_daily").select("ad_id, account_id").is("page_id", null).limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  const accountOf = new Map<string, string | null>();
  for (const r of (data ?? []) as { ad_id: string; account_id: string | null }[]) accountOf.set(r.ad_id, r.account_id);
  if (accountOf.size === 0) return { looked: 0, filled: 0 };

  // an ad whose other days are already answered needs no question
  const pageOf = new Map<string, string>();
  const ids = [...accountOf.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const { data: known, error: e } = await db.from("ins_ad_daily").select("ad_id, page_id").in("ad_id", ids.slice(i, i + 100)).not("page_id", "is", null);
    if (e) throw new Error(e.message);
    for (const r of (known ?? []) as { ad_id: string; page_id: string }[]) pageOf.set(r.ad_id, r.page_id);
  }

  const byAccount = new Map<string, string[]>();
  for (const [ad, acct] of accountOf) {
    if (pageOf.has(ad) || !acct) continue;
    byAccount.set(acct, [...(byAccount.get(acct) ?? []), ad]);
  }
  let looked = 0;
  for (const [acct, ads] of byAccount) {
    const token = await adAccountToken(acct).catch(() => null);
    if (!token) continue;
    const found = await lookUpPages(ads, token, fetchFn).catch(() => new Map<string, string>());
    looked += ads.length;
    for (const [ad, page] of found) pageOf.set(ad, page);
  }

  let filled = 0;
  for (const [ad, page] of pageOf) {
    if (!accountOf.has(ad)) continue;
    const { error: e } = await db.from("ins_ad_daily").update({ page_id: page }).eq("ad_id", ad).is("page_id", null);
    if (!e) filled += 1;
  }
  return { looked, filled };
}
