"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rangeStart } from "@/lib/crm/summary";
import { summariseAds } from "@/lib/ads/summary";
import { syncAds, type SyncResult } from "@/lib/ads/sync";
import type { AdConversation, AdLead, AdsRange, AdsSummary, DailyRow } from "@/lib/ads/types";
import {
  adAccountToken, adAccounts, adSyncStatuses, clearAdAccount, clearPendingAds, readPendingAds, saveAdAccount,
  type AdAccount, type AdSyncStatus,
} from "@/lib/facebook/ads-connection";
import { listAdAccounts, tokenExpiry, type TokenExpiry } from "@/lib/facebook/oauth";
import { audit, requireStaff } from "@/lib/auth/viewer";

/** Everything the page draws. No token in it. */
export interface AdsPage {
  range: AdsRange;
  accounts: AdAccount[];
  /** the ad accounts a half-finished login is waiting to choose between */
  choices: { id: string; name: string }[];
  summary: AdsSummary;
  /** when the newest row was fetched; nothing before the first sync */
  lastFetchedAt: string | null;
  /**
   * Each account's own last fetch, by account id. Null while the columns that hold it are not
   * in the database yet — the page then falls back to `lastFetchedAt`.
   */
  syncStatus: Record<string, AdSyncStatus> | null;
  /** when each account's login stops working, by account id; missing where Meta would not say */
  expiry: Record<string, TokenExpiry>;
}

/** A local calendar day as `YYYY-MM-DD`, for a `date` column. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * When each account's login runs out, asked of Meta's token inspector.
 *
 * Every account connected in one login carries the same token, so each distinct token is
 * asked once. Anything that fails is simply left out: the date is a courtesy, and a page that
 * could not draw because Meta was slow to answer about a date would be a worse page.
 */
async function expiries(accounts: AdAccount[]): Promise<Record<string, TokenExpiry>> {
  const out: Record<string, TokenExpiry> = {};
  const byToken = new Map<string, Promise<TokenExpiry | null>>();
  await Promise.all(accounts.map(async (a) => {
    const token = await adAccountToken(a.id).catch(() => null);
    if (!token) return;
    if (!byToken.has(token)) byToken.set(token, tokenExpiry(token).catch(() => null));
    const e = await byToken.get(token)!;
    if (e) out[a.id] = e;
  }));
  return out;
}

async function pendingChoices(): Promise<{ id: string; name: string }[]> {
  const pending = await readPendingAds();
  if (!pending) return [];
  try {
    return (await listAdAccounts(pending.token)).map((a) => ({ id: a.id, name: a.name }));
  } catch {
    return [];
  }
}

export async function loadAds(range: AdsRange = "7d"): Promise<AdsPage> {
  await requireStaff("admin");
  const supabase = supabaseAdmin();
  const start = rangeStart(range);
  const since = start.toISOString();

  const [accounts, choices, rows, leads, conversations, newest, statuses] = await Promise.all([
    adAccounts().catch(() => [] as AdAccount[]),
    pendingChoices(),
    supabase.from("ins_ad_daily").select("*").gte("date", dayKey(start)),
    supabase.from("ins_leads").select("ad_id").gte("created_at", since),
    supabase.from("ins_conversations").select("ad_id, priced_at, form_sent_at").gte("started_at", since),
    supabase.from("ins_ad_daily").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
    adSyncStatuses().catch(() => null),
  ]);
  const expiry = await expiries(accounts);

  /**
   * A conversation that did not come from an advertisement has no ad_id, and keying the
   * tally by it would file every organic customer under one imaginary advertisement called
   * "null" — a campaign that never ran, credited with most of the week.
   */
  const fromAds = <T extends { ad_id: string | null }>(v: unknown): T[] =>
    ((v ?? []) as T[]).filter((r) => Boolean(r.ad_id));

  const summary = summariseAds(
    (rows.data ?? []) as DailyRow[],
    fromAds<AdLead & { ad_id: string | null }>(leads.data) as AdLead[],
    fromAds<AdConversation & { ad_id: string | null }>(conversations.data) as AdConversation[],
  );
  return {
    range,
    accounts,
    choices,
    summary,
    lastFetchedAt: (newest.data as { fetched_at: string } | null)?.fetched_at ?? null,
    syncStatus: statuses ? Object.fromEntries(statuses) : null,
    expiry,
  };
}

/** The button. Same code the cron runs, called directly rather than through its own route. */
export async function syncNow(): Promise<SyncResult> {
  await requireStaff("admin");
  const result = await syncAds();
  revalidatePath("/admin/ads");
  return result;
}

/** Finishes a login where the person may read more than one ad account — all the chosen ones. */
export async function connectAdAccounts(ids: string[]): Promise<string[]> {
  await requireStaff("admin");
  if (ids.length === 0) throw new Error("ยังไม่ได้เลือกบัญชีโฆษณา");
  const pending = await readPendingAds();
  if (!pending) throw new Error("การเชื่อมต่อหมดอายุแล้ว กดเชื่อมบัญชีโฆษณาใหม่อีกครั้ง");

  const available = await listAdAccounts(pending.token);
  const failures: string[] = [];
  for (const id of ids) {
    const a = available.find((x) => x.id === id);
    if (!a) { failures.push(`${id} — ไม่พบในบัญชีที่เพิ่งเข้าสู่ระบบ`); continue; }
    try {
      await saveAdAccount({ id: a.id, name: a.name, currency: a.currency, token: pending.token, scopes: pending.scopes });
    } catch (e) {
      failures.push(`${a.name} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failures.length === 0) await clearPendingAds();
  revalidatePath("/admin/ads");
  return failures;
}

export async function cancelPendingAds(): Promise<void> {
  await requireStaff("admin");
  await clearPendingAds();
  revalidatePath("/admin/ads");
}

export async function disconnectAdAccount(actId: string): Promise<void> {
  await requireStaff("admin");
  await clearAdAccount(actId);
  await audit("disconnect-ads", actId);
  revalidatePath("/admin/ads");
}
