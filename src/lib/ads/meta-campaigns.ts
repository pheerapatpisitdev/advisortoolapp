import { type AdResult } from "./results";

/**
 * The campaigns built in Meta Ads Manager by hand, as Ads Studio lists them beside its own
 * (owner, 2026-10-06): read-only, their figures summed from the nightly ins_ad_daily rows of the
 * Page's ads. Pure — the server door is metaCampaigns in app/studio/ads/actions.ts.
 */

export interface MetaRow {
  ad_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  account_id: string | null;
  /** numeric comes back from Postgres as a string at times */
  spend: number | string;
  impressions: number;
  link_clicks: number;
  messaging_started: number;
  fetched_at: string | null;
}

export interface MetaCampaign {
  /** Meta's campaign id, or the name when Meta gave none */
  key: string;
  name: string;
  accountId: string | null;
  accountName: string | null;
  /** how many ads ran in the range */
  ads: number;
  result: AdResult;
}

/**
 * The rows grouped by campaign, Ads Studio's own ads left out (they are its campaigns' rows
 * already), the biggest spender first.
 */
export function groupMetaCampaigns(rows: MetaRow[], studioAdIds: Set<string>, accountNames: Map<string, string>): MetaCampaign[] {
  const out = new Map<string, MetaCampaign & { adSet: Set<string> }>();
  for (const r of rows) {
    if (studioAdIds.has(r.ad_id)) continue;
    const key = r.campaign_id ?? r.campaign_name ?? r.ad_id;
    const c = out.get(key) ?? {
      key, name: r.campaign_name ?? "(ไม่มีชื่อ)", accountId: r.account_id,
      accountName: r.account_id ? accountNames.get(r.account_id) ?? r.account_id : null,
      ads: 0, adSet: new Set<string>(), result: { spend: 0, impressions: 0, clicks: 0, messaging: 0 },
    };
    c.adSet.add(r.ad_id);
    c.result.spend += Number(r.spend) || 0;
    c.result.impressions += r.impressions || 0;
    c.result.clicks += r.link_clicks || 0;
    c.result.messaging += r.messaging_started || 0;
    out.set(key, c);
  }
  return [...out.values()]
    .map(({ adSet, ...c }) => ({ ...c, ads: adSet.size }))
    .sort((a, b) => b.result.spend - a.result.spend);
}
