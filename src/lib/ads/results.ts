/**
 * What sent ads have done, summed from ins_ad_daily rows (Ads Studio desktop, 2026-10-05).
 * Pure: the server door that reads the rows is campaignResults in app/studio/ads/actions.ts.
 */

export interface AdResult {
  spend: number;
  impressions: number;
  /** link clicks, the ones that went somewhere */
  clicks: number;
  /** conversations started in Messenger */
  messaging: number;
}

export interface DailyRow {
  ad_id: string;
  /** numeric comes back from Postgres as a string at times */
  spend: number | string;
  impressions: number;
  link_clicks: number;
  clicks: number;
  messaging_started: number;
}

/**
 * Each key's total over the rows of its ads (a key is a campaign id or a piece id; its ads may
 * sit on several sends and ad accounts). A key none of whose ads has a row is absent, so the
 * page can show "—" where it has no data, not 0.
 */
export function sumResults(rows: DailyRow[], adIdsByKey: Map<string, string[]>): Map<string, AdResult> {
  const byAd = new Map<string, AdResult>();
  for (const r of rows) {
    const t = byAd.get(r.ad_id) ?? { spend: 0, impressions: 0, clicks: 0, messaging: 0 };
    t.spend += Number(r.spend) || 0;
    t.impressions += r.impressions || 0;
    t.clicks += r.link_clicks || 0;
    t.messaging += r.messaging_started || 0;
    byAd.set(r.ad_id, t);
  }
  const out = new Map<string, AdResult>();
  for (const [key, ids] of adIdsByKey) {
    let sum: AdResult | null = null;
    for (const id of new Set(ids)) {
      const t = byAd.get(id);
      if (!t) continue;
      sum ??= { spend: 0, impressions: 0, clicks: 0, messaging: 0 };
      sum.spend += t.spend;
      sum.impressions += t.impressions;
      sum.clicks += t.clicks;
      sum.messaging += t.messaging;
    }
    if (sum) out.set(key, sum);
  }
  return out;
}

/** Spend per result; null when there were none, so the page shows "—" and not a division by zero. */
export function costPer(spend: number, n: number): number | null {
  return n > 0 ? spend / n : null;
}
