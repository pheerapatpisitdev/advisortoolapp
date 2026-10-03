import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADS_PENDING_KEY, adAccountIdInKey, adsKeyFor } from "./keys";

/**
 * The ad accounts the back office may read figures from, and the token it reads with.
 *
 * One user token, kept once per account it was granted for. It is the person's own token
 * rather than a Page's, because ad accounts belong to people and businesses, not to Pages —
 * and it lasts about sixty days, after which Meta answers with error 190 and the ADS page
 * asks for the login again. The Page tokens next to it in the table never expire; this one
 * does, and that difference is the whole reason the page has a "reconnect" state.
 */

export interface AdAccount {
  /** Meta's id, with its `act_` prefix */
  id: string;
  name: string;
  currency: string | null;
  connectedAt: string;
}

export interface Row {
  key: string;
  page_id: string | null;
  page_name: string | null;
  token: string;
  scopes: string[] | null;
  fields: string[] | null;
  updated_at: string;
}

/** The secret the table's RPCs encrypt with; shared with the ads_management store. */
export function channelPassphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/** One decrypted row of the channel table, by key; shared with the ads_management store. */
export async function readChannelAuth(key: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin()
    .rpc("ins_get_channel_auth", { p_key: key, p_passphrase: channelPassphrase() });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])[0] ?? null;
}

/** Every connected ad account, newest first. No token travels with the list. */
export async function adAccounts(): Promise<AdAccount[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_channel_auth")
    .select("key, page_id, page_name, fields, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<Row, "token" | "scopes">[];
  return rows.flatMap((r) => {
    const id = adAccountIdInKey(r.key);
    if (!id) return [];
    // the currency rides in `fields` — a column meant for webhook fields, but it is a text
    // array and the account has exactly one word to keep there
    return [{ id, name: r.page_name ?? id, currency: r.fields?.[0] ?? null, connectedAt: r.updated_at }];
  });
}

/** How the last fetch of one ad account went. */
export interface AdSyncStatus {
  /** the last attempt, whether it worked or not */
  lastSyncAt: string | null;
  /** the last attempt that worked — what "is this stale" is judged on */
  lastOkAt: string | null;
  /** why the last attempt failed; null when it worked */
  lastError: string | null;
}

/**
 * Every ad account's last fetch, by account id — or null when the columns are not there yet.
 *
 * Asked separately from adAccounts() rather than added to its select, because the columns
 * come from 20260925_ad_sync_status.sql and a deploy can land before that file is applied.
 * Folded into the listing, a missing column would have emptied the whole ADS page; asked on
 * its own, it costs only these lines, and the page falls back to what it showed before.
 */
export async function adSyncStatuses(): Promise<Map<string, AdSyncStatus> | null> {
  const { data, error } = await supabaseAdmin()
    .from("ins_channel_auth")
    .select("key, last_sync_at, last_sync_ok_at, last_sync_error");
  if (error) return null;
  const out = new Map<string, AdSyncStatus>();
  for (const r of (data ?? []) as { key: string; last_sync_at: string | null; last_sync_ok_at: string | null; last_sync_error: string | null }[]) {
    const id = adAccountIdInKey(r.key);
    if (id) out.set(id, { lastSyncAt: r.last_sync_at, lastOkAt: r.last_sync_ok_at, lastError: r.last_sync_error });
  }
  return out;
}

/**
 * Writes down how one account's fetch went, straight onto its row.
 *
 * A plain update, not the RPC: nothing secret is touched, and the RPC would re-encrypt the
 * token and move `updated_at`, which is the "เชื่อมเมื่อ" date on screen. Best-effort — a
 * failure to record a fetch must not turn a fetch that worked into one that failed.
 */
export async function recordAdSync(actId: string, at: string, error: string | null): Promise<void> {
  const patch: Record<string, string | null> = { last_sync_at: at, last_sync_error: error };
  if (!error) patch.last_sync_ok_at = at;
  try {
    await supabaseAdmin().from("ins_channel_auth").update(patch).eq("key", adsKeyFor(actId));
  } catch {
    // the columns may not exist yet on this database; the sync's own result still says it
  }
}

export async function adAccountToken(actId: string): Promise<string | null> {
  return (await readChannelAuth(adsKeyFor(actId)))?.token ?? null;
}

export async function saveAdAccount(a: { id: string; name: string; currency: string | null; token: string; scopes: string[] }): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: adsKeyFor(a.id),
    p_page_id: a.id,
    p_page_name: a.name,
    p_token: a.token,
    p_scopes: a.scopes,
    p_fields: a.currency ? [a.currency] : [],
    p_passphrase: channelPassphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function clearAdAccount(actId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: adsKeyFor(actId) });
  if (error) throw new Error(error.message);
}

/** Holds the user token between the Meta redirect and the moment an account is picked. */
export async function savePendingAds(userToken: string, scopes: string[]): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: ADS_PENDING_KEY,
    p_page_id: null,
    p_page_name: null,
    p_token: userToken,
    p_scopes: scopes,
    p_fields: [],
    p_passphrase: channelPassphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function readPendingAds(): Promise<{ token: string; scopes: string[] } | null> {
  const row = await readChannelAuth(ADS_PENDING_KEY);
  return row ? { token: row.token, scopes: row.scopes ?? [] } : null;
}

export async function clearPendingAds(): Promise<void> {
  await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: ADS_PENDING_KEY });
}
