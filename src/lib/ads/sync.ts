import { supabaseAdmin } from "@/lib/supabase/admin";
import { adAccountToken, adAccounts, recordAdSync } from "@/lib/facebook/ads-connection";
import { INSIGHT_FIELDS, dailyRowFromInsight, isExpiredToken, type Insight } from "./insights";
import { fillAdPages } from "./ad-pages";
import type { DailyRow } from "./types";

/**
 * Pulls the last few days of every connected ad account into `ins_ad_daily`.
 *
 * Three days rather than one, every time: Meta keeps revising a day's figures for a while
 * after it ends (late conversions, removed clicks), so yesterday fetched once is yesterday
 * slightly wrong. Fetching a short window and writing over the same rows is what keeps the
 * table honest, and the window is short enough that the daily run costs a handful of calls.
 *
 * One account's failure is reported and the next account is still fetched. The likeliest
 * failure is the token expiring — Meta's error 190 — and the message for it says what to do.
 *
 * Every attempt is also written onto the account's own row (recordAdSync), success or not,
 * rows or none. The page used to infer "last fetched" from the newest figure in the table,
 * which let one account's success hide another's nightly failure, and made an account that
 * simply spent nothing look as if it had never been fetched.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
export const EXPIRED = "สิทธิ์เชื่อมต่อหมดอายุ กดเชื่อมบัญชีโฆษณาใหม่";

export interface SyncResult {
  accounts: number;
  rows: number;
  errors: { actId: string; name: string; message: string }[];
}

/** A calendar day as `YYYY-MM-DD` in UTC — Meta reads `time_range` as dates, not instants. */
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function* insights(actId: string, token: string, since: string, until: string, fetchFn: typeof fetch): AsyncGenerator<Insight> {
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: INSIGHT_FIELDS.join(","),
    limit: "500",
  });
  let url: string | undefined = `${GRAPH}/${actId}/insights?${params}`;
  while (url) {
    // a page of insights that hangs fails the account, not the whole nightly run
    const res = await fetchFn(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const body = (await res.json()) as { data?: Insight[]; paging?: { next?: string }; error?: { code?: number; message?: string } };
    if (!res.ok || body.error) {
      if (isExpiredToken(body.error)) throw new Error(EXPIRED);
      // Meta's words are kept — they are the diagnosis — under a Thai line saying whose they are
      throw new Error(`Facebook ไม่ยอมส่งตัวเลขให้ — ${body.error?.message ?? `insights ${res.status}`}`);
    }
    for (const i of body.data ?? []) yield i;
    url = body.paging?.next;
  }
}

export async function syncAds(opts: { days?: number; now?: Date; fetchFn?: typeof fetch } = {}): Promise<SyncResult> {
  const days = opts.days ?? 3;
  const now = opts.now ?? new Date();
  const fetchFn = opts.fetchFn ?? fetch;
  const fetchedAt = now.toISOString();
  const until = day(now);
  const since = day(new Date(now.getTime() - (days - 1) * 86_400_000));

  const accounts = await adAccounts();
  const result: SyncResult = { accounts: accounts.length, rows: 0, errors: [] };

  for (const account of accounts) {
    try {
      const token = await adAccountToken(account.id);
      if (!token) throw new Error(EXPIRED);
      const rows: DailyRow[] = [];
      for await (const i of insights(account.id, token, since, until, fetchFn)) {
        rows.push(dailyRowFromInsight(i, fetchedAt, account.id));
      }
      if (rows.length > 0) {
        const { error } = await supabaseAdmin().from("ins_ad_daily").upsert(rows, { onConflict: "date,ad_id" });
        if (error) throw new Error(error.message);
      }
      result.rows += rows.length;
      await recordAdSync(account.id, fetchedAt, null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push({ actId: account.id, name: account.name, message });
      await recordAdSync(account.id, fetchedAt, message);
    }
  }
  // which Page each new ad promotes, for the campaigns built in Meta itself; never fails the sync
  if (accounts.length > 0) {
    await fillAdPages(fetchFn).catch((e) => console.error("syncAds: ad pages not filled:", e));
  }
  return result;
}
