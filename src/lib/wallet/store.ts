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
  /** clawback: taken back after Stripe refunded or a bank disputed a top-up (owner, 2026-10-01) */
  kind: "topup" | "charge" | "adjust" | "clawback";
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

/**
 * The balance to spend, after holds of requests that died are given back, and whether a refund
 * or a dispute froze the wallet (owner, 2026-10-01): a frozen wallet pays for no round.
 */
export async function walletStatus(agentId: string): Promise<{ satang: number; frozen: boolean }> {
  await call("ins_wallet_sweep_holds");
  const { data, error } = await supabaseAdmin().from("ins_wallets").select("balance_satang, frozen_at").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านยอดกระเป๋าไม่ได้: ${error.message}`);
  return { satang: Number(data?.balance_satang ?? 0), frozen: Boolean(data?.frozen_at) };
}

export async function balanceSatang(agentId: string): Promise<number> {
  return (await walletStatus(agentId)).satang;
}

/** whether the wallet is frozen; false when it cannot be read — only the words of a refusal hang on it */
export async function walletFrozen(agentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_wallets").select("frozen_at").eq("agent_id", agentId).maybeSingle();
  if (error) {
    console.error("wallet freeze unreadable:", error.message);
    return false;
  }
  return Boolean(data?.frozen_at);
}

/**
 * What the round's note shows: null while the owner has the wallet off, while it is frozen —
 * it pays for nothing then, so the page must not reckon with it — or when it cannot be read.
 */
export async function walletView(agentId: string): Promise<{ satang: number; multiplier: number } | null> {
  try {
    const settings = await walletSettings();
    if (!settings.enabled) return null;
    const status = await walletStatus(agentId);
    if (status.frozen) return null;
    return { satang: status.satang, multiplier: settings.multiplier };
  } catch (e) {
    console.error("wallet view unreadable:", e);
    return null;
  }
}

/** a free round that gave nothing, handed back to the count (ins_return_free_round); false when its line was not found */
export const returnFreeRound = (auditId: number) => call<boolean>("ins_return_free_round", { p_id: auditId });

export const holdWallet = (agentId: string, satang: number, round: string) =>
  call<string | null>("ins_wallet_hold", { p_agent: agentId, p_amount: satang, p_round: round });

export async function settleWallet(holdId: string, charge: number, costThb: number): Promise<number | null> {
  const charged = await call<number | string | null>("ins_wallet_settle", { p_hold: holdId, p_charge: charge, p_cost_thb: costThb });
  return charged === null ? null : Number(charged);
}

export async function releaseWallet(holdId: string): Promise<void> {
  await call("ins_wallet_release", { p_hold: holdId });
}

/** `paymentIntent`: kept on the top-up, so a refund or a dispute of it — which names only that — finds it */
export const creditTopUp = (sessionId: string, agentId: string, satang: number, paymentIntent: string | null = null) =>
  call<"credited" | "duplicate" | "unknown">("ins_wallet_credit_topup", {
    p_session: sessionId, p_agent: agentId, p_amount: satang, p_payment_intent: paymentIntent,
  });

export type ClawbackKind = "refund" | "dispute";
export interface Clawback {
  result: "clawed" | "duplicate" | "unknown";
  agentId?: string;
  /** what this event claimed back, what the balance gave of it, and what it could not */
  claimedSatang?: number;
  debitedSatang?: number;
  shortfallSatang?: number;
}

/**
 * Takes back a refunded or disputed top-up, as far as the balance goes, and freezes the wallet
 * (ins_wallet_clawback). For a refund `satang` is the charge's refunded total so far — the
 * function takes only what is new of it — and `ref` the charge's id; for a dispute, the
 * disputed amount and the dispute's id.
 */
export async function clawBack(a: { paymentIntent: string; kind: ClawbackKind; ref: string; satang: number; note: string }): Promise<Clawback> {
  const r = await call<Record<string, unknown> | null>("ins_wallet_clawback", {
    p_payment_intent: a.paymentIntent, p_kind: a.kind, p_ref: a.ref, p_amount: a.satang, p_note: a.note,
  });
  const result = r?.result === "clawed" || r?.result === "duplicate" ? r.result : "unknown";
  const n = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
  return {
    result,
    agentId: typeof r?.agent === "string" ? r.agent : undefined,
    claimedSatang: n(r?.claimed), debitedSatang: n(r?.debited), shortfallSatang: n(r?.shortfall),
  };
}

/**
 * A top-up paid before its PaymentIntent was kept, told it now (looked up in Stripe by the
 * webhook). Only a paid top-up without one: a PaymentIntent already written is never moved.
 * Whether a row took it.
 */
export async function linkPaymentIntent(sessionId: string, paymentIntent: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_topups").update({ stripe_payment_intent: paymentIntent })
    .eq("stripe_session_id", sessionId).eq("status", "paid").is("stripe_payment_intent", null).select("stripe_session_id");
  if (error) throw new Error(`บันทึก payment intent ไม่ได้: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

/** A top-up's status ('open' until Stripe's credit lands), or null when it was not opened here. */
export async function topUpStatus(sessionId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().from("ins_wallet_topups").select("status").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw new Error(`อ่านการเติมเงินไม่ได้: ${error.message}`);
  return (data as { status: string } | null)?.status ?? null;
}

/** the owner lifting a freeze; the shortfall let go with it, or null when the wallet was not frozen */
export async function unfreezeWallet(agentId: string, note: string): Promise<number | null> {
  const r = await call<number | string | null>("ins_wallet_unfreeze", { p_agent: agentId, p_note: note });
  return r === null ? null : Number(r);
}

export interface FrozenWallet { agentId: string; frozenAt: string; reason: string | null; shortfallSatang: number }

/** the frozen wallets, for the owner's page */
export async function frozenWallets(): Promise<FrozenWallet[]> {
  const { data, error } = await supabaseAdmin().from("ins_wallets")
    .select("agent_id, frozen_at, frozen_reason, shortfall_satang").not("frozen_at", "is", null).order("frozen_at", { ascending: false });
  if (error) throw new Error(`อ่านกระเป๋าที่ถูกพักไม่ได้: ${error.message}`);
  return (data ?? []).map((r) => ({
    agentId: String(r.agent_id), frozenAt: String(r.frozen_at), reason: (r.frozen_reason as string | null) ?? null,
    shortfallSatang: Number(r.shortfall_satang ?? 0),
  }));
}

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
