// An outside member's Studio credit (owner, 2026-10-17; mockup 3NoZWL3bJ4VH2Msw7vDgQc): ฿15 with
// the trial, ฿50 with every paid 30 days, spent before the member's own money and gone when its
// period ends. Server only. The lots live in ins_member_credits; spending them is the wallet's
// hold, settle and release (supabase/migrations/20261120_member_credit.sql), so every Studio tool
// that pays from the wallet pays from the credit first without knowing it. A UnitClub agent has
// one lot of the same kind, the starter credit (owner, 2026-10-18: ฿15 once, never ending), in
// place of the ten free rounds and two free clips (20261121_agent_starter_credit.sql).
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
        member_id: memberId, pass_id: l.passId, kind: l.kind, amount_satang: l.satang, left_satang: l.satang,
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
  id: number;
  /** the pass row that earned it; null for a UnitClub agent's starter lot */
  passId: number | null;
  /**
   * what earned it: a member's trial (฿15) or payment (฿50), a UnitClub agent's one starter credit
   * (฿15, owner 2026-10-18), or a month of the owner's สิทธิ์เข้าพิเศษ budget (2026-10-20)
   */
  kind: "trial" | "paid" | "starter" | "special";
  amountSatang: number;
  leftSatang: number;
  startsAt: string;
  expiresAt: string;
  voided: boolean;
  voidedAt: string | null;
}

/** Someone's lots, newest first: a member's pass lots, or a UnitClub agent's starter lot. */
export async function creditLotsOf(memberId: string, limit = 20): Promise<CreditLotView[]> {
  const { data, error } = await supabaseAdmin().from(TABLE)
    .select("id, pass_id, kind, amount_satang, left_satang, starts_at, expires_at, voided_at")
    .eq("member_id", memberId).order("starts_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านเครดิตสมาชิกไม่ได้: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const kind: CreditLotView["kind"] = r.kind === "trial" || r.kind === "starter" || r.kind === "special" ? r.kind : "paid";
    return {
      id: Number(r.id), passId: r.pass_id == null ? null : Number(r.pass_id), kind,
      amountSatang: Number(r.amount_satang), leftSatang: Number(r.left_satang),
      startsAt: String(r.starts_at), expiresAt: String(r.expires_at),
      voided: r.voided_at != null, voidedAt: r.voided_at == null ? null : String(r.voided_at),
    };
  });
}

/** a lot in its time: not voided, started and not yet ended — empty or not */
export const currentLot = (l: CreditLotView, now: Date): boolean =>
  !l.voided && new Date(l.startsAt).getTime() <= now.getTime() && new Date(l.expiresAt).getTime() > now.getTime();

/** a starter lot never ends: it is written to end in the year 9999 (20261121_agent_starter_credit.sql) */
export const neverEnds = (expiresAt: string | null): boolean => expiresAt != null && new Date(expiresAt).getUTCFullYear() >= 9999;

/**
 * A UnitClub agent's one starter credit, written the first time it is asked for (owner,
 * 2026-10-18): the database gives it only to a UnitOS agent who is not the owner, once, while
 * the owner's amount is above ฿0, and does nothing for anyone else.
 */
export async function ensureStarterCredit(agentId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_agent_starter_credit", { p_agent: agentId });
  if (error) throw new Error(`ให้เครดิตเริ่มต้นไม่ได้: ${error.message}`);
}

/**
 * What can be spent from credit now (as ins_wallet_hold counts it), of how much the lots in
 * their time carried, and when the soonest of them ends; nothing for someone with no lots.
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
