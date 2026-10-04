import { supabaseAdmin } from "@/lib/supabase/admin";
import { channelPassphrase, readChannelAuth, type AdAccount, type Row } from "./ads-connection";
import { ADS_MANAGE_PENDING_KEY, adsManageAccountIdInKey, adsManageKeyFor } from "./keys";

/**
 * The ad accounts the back office may create ads in, and the token it does that with.
 *
 * The same shape as ads-connection.ts, kept under keys of its own: this grant is
 * `ads_management`, which can spend money, and the `ads_read` token next to it can only look.
 * Encrypting and decrypting is not repeated here — the table's RPCs and the shared reader do
 * it — so the only thing this file decides is which key a row goes under.
 */

/** Every account connected for creating ads, newest first. No token travels with the list. */
export async function adManageAccounts(): Promise<AdAccount[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_channel_auth")
    .select("key, page_id, page_name, fields, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<Row, "token" | "scopes">[];
  return rows.flatMap((r) => {
    const id = adsManageAccountIdInKey(r.key);
    if (!id) return [];
    // the currency rides in `fields`, as it does for the ads_read rows
    return [{ id, name: r.page_name ?? id, currency: r.fields?.[0] ?? null, connectedAt: r.updated_at }];
  });
}

export async function adManageToken(actId: string): Promise<string | null> {
  return (await readChannelAuth(adsManageKeyFor(actId)))?.token ?? null;
}

export async function saveAdManageAccount(a: { id: string; name: string; currency: string | null; token: string; scopes: string[] }): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: adsManageKeyFor(a.id),
    p_page_id: a.id,
    p_page_name: a.name,
    p_token: a.token,
    p_scopes: a.scopes,
    p_fields: a.currency ? [a.currency] : [],
    p_passphrase: channelPassphrase(),
  });
  if (error) throw new Error(error.message);
}

/** Holds the user token between the Meta redirect and the moment an account is picked. */
export async function savePendingAdsManage(token: string, scopes: string[]): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: ADS_MANAGE_PENDING_KEY,
    p_page_id: null,
    p_page_name: null,
    p_token: token,
    p_scopes: scopes,
    p_fields: [],
    p_passphrase: channelPassphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function readPendingAdsManage(): Promise<{ token: string; scopes: string[] } | null> {
  const row = await readChannelAuth(ADS_MANAGE_PENDING_KEY);
  return row ? { token: row.token, scopes: row.scopes ?? [] } : null;
}

export async function clearPendingAdsManage(): Promise<void> {
  await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: ADS_MANAGE_PENDING_KEY });
}
