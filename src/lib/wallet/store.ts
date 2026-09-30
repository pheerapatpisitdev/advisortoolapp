import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_MULTIPLIER } from "./money";

/**
 * The wallet's reads and writes. Every change of a balance is one of the database functions
 * in supabase/migrations/20260930_wallet.sql, which lock the agent's row; nothing here adds or
 * takes money with a read and a write of its own.
 */

export interface WalletSettings { enabled: boolean; multiplier: number }
export type TopUpStatus = "open" | "paid" | "failed" | "expired";
export interface WalletEntry {
  id: string;
  kind: "topup" | "charge" | "adjust";
  amountSatang: number;
  round: string | null;
  note: string | null;
  createdAt: string;
}
export interface WalletRow {
  agentId: string;
  name: string;
  code: string;
  balanceSatang: number;
  toppedUpSatang: number;
  chargedSatang: number;
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = args === undefined ? await supabaseAdmin().rpc(fn) : await supabaseAdmin().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function walletSettings(): Promise<WalletSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings").select("wallet_enabled, wallet_multiplier").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่ากระเป๋าเงินไม่ได้: ${error.message}`);
  const m = Number(data?.wallet_multiplier);
  return { enabled: data?.wallet_enabled === true, multiplier: Number.isFinite(m) && m >= 1 ? m : DEFAULT_MULTIPLIER };
}

export async function saveWalletSettings(s: WalletSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, wallet_enabled: s.enabled, wallet_multiplier: s.multiplier, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่ากระเป๋าเงินไม่ได้: ${error.message}`);
}

/** the balance to spend, after holds of requests that died are given back */
export async function balanceSatang(agentId: string): Promise<number> {
  await call("ins_wallet_sweep_holds");
  const { data, error } = await supabaseAdmin().from("ins_wallets").select("balance_satang").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านยอดกระเป๋าไม่ได้: ${error.message}`);
  return Number(data?.balance_satang ?? 0);
}

/** what the round's note shows: null while the owner has the wallet off, or when it cannot be read */
export async function walletView(agentId: string): Promise<{ satang: number; multiplier: number } | null> {
  try {
    const settings = await walletSettings();
    if (!settings.enabled) return null;
    return { satang: await balanceSatang(agentId), multiplier: settings.multiplier };
  } catch (e) {
    console.error("wallet view unreadable:", e);
    return null;
  }
}

export const holdWallet = (agentId: string, satang: number, round: string) =>
  call<string | null>("ins_wallet_hold", { p_agent: agentId, p_amount: satang, p_round: round });

export async function settleWallet(holdId: string, charge: number, costThb: number): Promise<number | null> {
  const charged = await call<number | string | null>("ins_wallet_settle", { p_hold: holdId, p_charge: charge, p_cost_thb: costThb });
  return charged === null ? null : Number(charged);
}

export async function releaseWallet(holdId: string): Promise<void> {
  await call("ins_wallet_release", { p_hold: holdId });
}

export const creditTopUp = (sessionId: string, agentId: string, satang: number) =>
  call<"credited" | "duplicate" | "unknown">("ins_wallet_credit_topup", { p_session: sessionId, p_agent: agentId, p_amount: satang });

export async function adjustWallet(agentId: string, satang: number, note: string, by: string): Promise<number | null> {
  const balance = await call<number | string | null>("ins_wallet_adjust", { p_agent: agentId, p_amount: satang, p_note: note, p_by: by });
  return balance === null ? null : Number(balance);
}

/**
 * What agents' wallet rounds cost the providers since a moment. 0 when it cannot be read: the
 * content ceiling then counts those rounds as the owner's, and so stops sooner — never later.
 */
export async function walletChargedThb(since: Date): Promise<number> {
  try {
    return Number(await call<number | string>("ins_wallet_charged_thb", { p_since: since.toISOString() })) || 0;
  } catch (e) {
    console.error("wallet charges unreadable:", e);
    return 0;
  }
}

export async function walletEntries(agentId: string, limit = 30): Promise<WalletEntry[]> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_entries")
    .select("id, kind, amount_satang, round, note, created_at")
    .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านประวัติกระเป๋าไม่ได้: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id), kind: r.kind as WalletEntry["kind"], amountSatang: Number(r.amount_satang),
    round: (r.round as string | null) ?? null, note: (r.note as string | null) ?? null, createdAt: String(r.created_at),
  }));
}

export async function openTopUp(sessionId: string, agentId: string, satang: number): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_wallet_topups").insert({ stripe_session_id: sessionId, agent_id: agentId, amount_satang: satang });
  if (error) throw new Error(`บันทึกรายการเติมเงินไม่ได้: ${error.message}`);
}

/** the asker's own top-up only: another agent's session id reads as not found */
export async function topUpState(sessionId: string, agentId: string): Promise<TopUpStatus | null> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_topups").select("status")
    .eq("stripe_session_id", sessionId).eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านสถานะการเติมเงินไม่ได้: ${error.message}`);
  return (data?.status as TopUpStatus | undefined) ?? null;
}

/** failed or expired, but never over a top-up already paid */
export async function markTopUp(sessionId: string, status: "failed" | "expired"): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_wallet_topups").update({ status })
    .eq("stripe_session_id", sessionId).eq("status", "open");
  if (error) throw new Error(`บันทึกสถานะการเติมเงินไม่ได้: ${error.message}`);
}

export async function walletSummary(since: Date): Promise<WalletRow[]> {
  const rows = await call<Record<string, unknown>[] | null>("ins_wallet_summary", { p_since: since.toISOString() });
  return (rows ?? []).map((r) => ({
    agentId: String(r.agent_id), name: String(r.name ?? ""), code: String(r.code ?? ""),
    balanceSatang: Number(r.balance_satang), toppedUpSatang: Number(r.topped_up_satang), chargedSatang: Number(r.charged_satang),
  }));
}
