// An outside member's Studio credit (owner, 2026-10-17; mockup 3NoZWL3bJ4VH2Msw7vDgQc): ฿15 with
// the trial, ฿50 with every paid 30 days, spent before the member's own money and gone when its
// period ends. Server only. The lots live in ins_member_credits; spending them is the wallet's
// hold, settle and release (supabase/migrations/20261120_member_credit.sql), so every Studio tool
// that pays from the wallet pays from the credit first without knowing it.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { creditLots, type PassRow, type PassSettings } from "./pass";

const TABLE = "ins_member_credits";

/**
 * Writes the lots the ledger earns that are not there yet, and voids the lots of passes a
 * refund or dispute cancelled. A lot already written is never changed: what is left of it is
 * the wallet's to move. The unique pass_id makes two first visits write one lot.
 */
export async function syncCredits(memberId: string, rows: PassRow[], settings: PassSettings, now: Date = new Date()): Promise<void> {
  const { lots, voids } = creditLots(rows, settings, now);
  if (lots.length > 0) {
    const { error } = await supabaseAdmin().from(TABLE).upsert(
      lots.map((l) => ({
        member_id: memberId, pass_id: l.passId, amount_satang: l.satang, left_satang: l.satang,
        starts_at: l.startsAt.toISOString(), expires_at: l.expiresAt.toISOString(),
      })),
      { onConflict: "pass_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`เพิ่มเครดิตสมาชิกไม่ได้: ${error.message}`);
  }
  if (voids.length > 0) {
    const { error } = await supabaseAdmin().from(TABLE).update({ voided_at: now.toISOString() })
      .eq("member_id", memberId).in("pass_id", voids).is("voided_at", null);
    if (error) throw new Error(`ยกเลิกเครดิตสมาชิกไม่ได้: ${error.message}`);
  }
}

export interface CreditLotView {
  passId: number;
  /** the pass row that earned it: the trial's ฿15 or a payment's ฿50 */
  kind: "trial" | "paid";
  amountSatang: number;
  leftSatang: number;
  startsAt: string;
  expiresAt: string;
  voided: boolean;
  voidedAt: string | null;
}

/** A member's lots, newest first. An agent has none. */
export async function creditLotsOf(memberId: string, limit = 20): Promise<CreditLotView[]> {
  const { data, error } = await supabaseAdmin().from(TABLE)
    .select("pass_id, amount_satang, left_satang, starts_at, expires_at, voided_at, pass:ins_member_passes(kind)")
    .eq("member_id", memberId).order("starts_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านเครดิตสมาชิกไม่ได้: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const pass = (Array.isArray(r.pass) ? r.pass[0] : r.pass) as { kind?: string } | null;
    return {
      passId: Number(r.pass_id), kind: pass?.kind === "trial" ? "trial" : "paid",
      amountSatang: Number(r.amount_satang), leftSatang: Number(r.left_satang),
      startsAt: String(r.starts_at), expiresAt: String(r.expires_at),
      voided: r.voided_at != null, voidedAt: r.voided_at == null ? null : String(r.voided_at),
    };
  });
}

/** a lot in its time: not voided, started and not yet ended — empty or not */
export const currentLot = (l: CreditLotView, now: Date): boolean =>
  !l.voided && new Date(l.startsAt).getTime() <= now.getTime() && new Date(l.expiresAt).getTime() > now.getTime();

/**
 * What the member can spend from credit now (as ins_wallet_hold counts it), of how much the
 * lots in their time carried, and when the soonest of them ends; nothing for an agent.
 */
export function creditOf(lots: CreditLotView[], now: Date): { satang: number; of: number; expiresAt: string | null } {
  const current = lots.filter((l) => currentLot(l, now));
  return {
    satang: current.reduce((s, l) => s + l.leftSatang, 0),
    of: current.reduce((s, l) => s + l.amountSatang, 0),
    expiresAt: current.map((l) => l.expiresAt).sort()[0] ?? null,
  };
}

export async function creditLeft(memberId: string, now: Date = new Date()): Promise<{ satang: number; of: number; expiresAt: string | null }> {
  return creditOf(await creditLotsOf(memberId), now);
}
