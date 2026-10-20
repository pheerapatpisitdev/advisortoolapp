// สิทธิ์เข้าพิเศษ (owner, 2026-10-20; mockup KRqC5VJgr4vHirF6t12Ayx, ก): agents the owner lets in
// although UnitClub's tier would keep them out, each with a monthly AI budget that the wallet
// spends first (credit lot kind 'special', supabase/migrations/20261128_special_access.sql).
// Server only.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { admit, refusal, studioLocked, type AgentRow, type StaffRow, type Viewer } from "./access";

const TABLE = "ins_special_access";

/** On the list: admit() lets them past the Premium lock. Read only for an agent the lock keeps out. */
export async function hasSpecialAccess(agentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("agent_id").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านสิทธิ์เข้าพิเศษไม่ได้: ${error.message}`);
  return data != null;
}

/**
 * admit() with the owner's สิทธิ์เข้าพิเศษ list (owner, 2026-10-20): the list is read only for an
 * agent UnitClub's tier keeps out, so everybody else pays no extra read.
 */
export async function admitAgent(agent: AgentRow | null, staff: StaffRow | null, issuedAt: number, now: number = Date.now()): Promise<Viewer | null> {
  const viewer = admit(agent, staff, issuedAt, now);
  if (viewer || !agent || !studioLocked(agent, now)) return viewer;
  return (await hasSpecialAccess(agent.id)) ? admit(agent, staff, issuedAt, now, true) : null;
}

/** refusal() with the same list: an agent on it is never told their tier keeps them out. */
export async function refusalOf(agent: AgentRow | null, staff: StaffRow | null, issuedAt: number, now: number = Date.now()): Promise<"premium" | null> {
  const why = refusal(agent, staff, issuedAt, now);
  if (!why || !agent) return why;
  return (await hasSpecialAccess(agent.id)) ? null : why;
}

export interface SpecialAccessRow {
  agentId: string;
  monthlySatang: number;
  createdAt: string;
  /** this month's budget as it stands; null before the agent's first use of the month writes it */
  month: { amountSatang: number; leftSatang: number } | null;
}

/** The first of this month in Bangkok, as the database starts a special lot. */
export function monthStart(now: Date = new Date()): Date {
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - 7 * 3600_000);
}

/** Everybody on the list, oldest first, with this month's budget. */
export async function listSpecialAccess(now: Date = new Date()): Promise<SpecialAccessRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from(TABLE).select("agent_id, monthly_satang, created_at").order("created_at");
  if (error) throw new Error(`อ่านรายชื่อสิทธิ์เข้าพิเศษไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { agent_id: string; monthly_satang: number; created_at: string }[];
  if (rows.length === 0) return [];
  const { data: lots, error: lotError } = await db.from("ins_member_credits")
    .select("member_id, amount_satang, left_satang")
    .eq("kind", "special").is("voided_at", null).eq("starts_at", monthStart(now).toISOString())
    .in("member_id", rows.map((r) => r.agent_id));
  if (lotError) throw new Error(`อ่านงบพิเศษเดือนนี้ไม่ได้: ${lotError.message}`);
  const byAgent = new Map(((lots ?? []) as { member_id: string; amount_satang: number; left_satang: number }[])
    .map((l) => [l.member_id, { amountSatang: Number(l.amount_satang), leftSatang: Number(l.left_satang) }]));
  return rows.map((r) => ({
    agentId: r.agent_id, monthlySatang: Number(r.monthly_satang), createdAt: r.created_at, month: byAgent.get(r.agent_id) ?? null,
  }));
}

/** Puts an agent on the list or changes their monthly amount; this month's budget moves by the difference. */
export async function setSpecialAccess(agentId: string, satang: number, by: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_special_access_set", { p_agent: agentId, p_satang: satang, p_by: by });
  if (error) throw new Error(`บันทึกสิทธิ์เข้าพิเศษไม่ได้: ${error.message}`);
}

/** Takes an agent off the list: out at the next click if the lock applies, this month's budget void. */
export async function removeSpecialAccess(agentId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_special_access_remove", { p_agent: agentId });
  if (error) throw new Error(`เอาสิทธิ์เข้าพิเศษออกไม่ได้: ${error.message}`);
}
