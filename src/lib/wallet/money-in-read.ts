import { supabaseAdmin } from "@/lib/supabase/admin";
import { all } from "@/lib/stats/usage-read";
import { balancesAfter, firstPaid, type MoneyKind, type MoneyRow, type Person } from "./money-in";

/**
 * Reads ประวัติเติมเงิน for [from, to): the wallets' top-ups, the owner's adjustments and the
 * clawbacks, and the members' passes paid and refunded; who each person is; the wallet's money
 * after each line; and which line was each person's first money in. A table that cannot be read
 * throws, so the page says so rather than showing a list with lines missing.
 */
export interface MoneyIn {
  rows: MoneyRow[];
  people: Map<string, Person>;
  /** the ids of the rows that were someone's first top-up or pass ever */
  first: Set<string>;
}

const WALLET_KINDS: Record<string, MoneyKind> = { topup: "topup", adjust: "adjust", clawback: "refund" };

export async function readMoneyIn(from: Date, to: Date): Promise<MoneyIn> {
  const db = supabaseAdmin();
  const lo = from.toISOString();
  const hi = to.toISOString();
  const [wallet, passes] = await Promise.all([
    all("wallet", (a, b) => db.from("ins_wallet_entries").select("id, agent_id, kind, amount_satang, created_at")
      .in("kind", Object.keys(WALLET_KINDS)).gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    all("passes", (a, b) => db.from("ins_member_passes").select("id, member_id, kind, amount_satang, revokes, created_at")
      .in("kind", ["paid", "revoked"]).gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
  ]);

  const agents = [...new Set(wallet.map((r) => String(r.agent_id)))];
  const members = [...new Set(passes.map((r) => String(r.member_id)))];

  // what a refunded pass was sold for; the refund's row names it
  const revokes = passes.filter((p) => p.kind === "revoked" && p.revokes != null).map((p) => Number(p.revokes));
  const [history, paidPasses, sold, agentRows, memberRows] = await Promise.all([
    // every line of these wallets up to the range's end: the money after each line, and their first top-up
    agents.length
      ? all("wallet history", (a, b) => db.from("ins_wallet_entries").select("id, agent_id, kind, amount_satang, created_at")
        .in("agent_id", agents).lt("created_at", hi).order("created_at").order("id").range(a, b))
      : Promise.resolve([]),
    // these members' passes ever paid: their first money in
    members.length
      ? all("passes history", (a, b) => db.from("ins_member_passes").select("id, member_id, created_at")
        .eq("kind", "paid").in("member_id", members).order("created_at").order("id").range(a, b))
      : Promise.resolve([]),
    revokes.length
      ? db.from("ins_member_passes").select("id, amount_satang").in("id", revokes)
      : Promise.resolve({ data: [], error: null }),
    agents.length || members.length
      ? db.from("agents").select("id, name, agent_code, unit, tenant:tenants(name)").in("id", [...agents, ...members])
      : Promise.resolve({ data: [], error: null }),
    agents.length || members.length
      ? db.from("ins_members").select("id, name, email").in("id", [...agents, ...members])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sold.error) throw new Error(`passes refunded: ${sold.error.message}`);
  if (agentRows.error) throw new Error(`agents: ${agentRows.error.message}`);
  if (memberRows.error) throw new Error(`members: ${memberRows.error.message}`);

  const soldFor = new Map((sold.data ?? []).map((r) => [Number(r.id), Number(r.amount_satang ?? 0)]));
  const after = balancesAfter(history.map((r) => ({ id: String(r.id), who: String(r.agent_id), at: String(r.created_at), satang: Number(r.amount_satang ?? 0) })));

  const rows: MoneyRow[] = [
    ...wallet.map((r) => ({
      id: `w:${r.id}`, at: String(r.created_at), who: String(r.agent_id), kind: WALLET_KINDS[String(r.kind)],
      satang: Number(r.amount_satang ?? 0), afterSatang: after.get(String(r.id)) ?? null,
    })),
    ...passes.map((r) => ({
      id: `p:${r.id}`, at: String(r.created_at), who: String(r.member_id), kind: (r.kind === "paid" ? "pass" : "refund") as MoneyKind,
      satang: r.kind === "paid" ? Number(r.amount_satang ?? 0) : -(soldFor.get(Number(r.revokes)) ?? 0),
      afterSatang: null,
    })),
  ].filter((r) => r.satang !== 0);

  const first = firstPaid([
    ...history.filter((r) => r.kind === "topup").map((r) => ({ id: `w:${r.id}`, who: String(r.agent_id), at: String(r.created_at), kind: "topup" as const })),
    ...paidPasses.map((r) => ({ id: `p:${r.id}`, who: String(r.member_id), at: String(r.created_at), kind: "pass" as const })),
  ]);

  const people = new Map<string, Person>();
  for (const m of memberRows.data ?? []) {
    people.set(String(m.id), { name: String(m.name ?? ""), code: String(m.email ?? ""), tenant: null, unit: null, isMember: true });
  }
  for (const a of agentRows.data ?? []) {
    const t = (a as { tenant?: { name?: string } | { name?: string }[] | null }).tenant;
    const tenant = Array.isArray(t) ? t[0]?.name : t?.name;
    people.set(String(a.id), {
      name: String(a.name ?? ""), code: String(a.agent_code ?? ""),
      tenant: tenant ? String(tenant).replace(/^Krungthai-AXA Life\s+/i, "") : null,
      unit: typeof a.unit === "string" && a.unit.trim() ? a.unit.trim() : null,
      isMember: false,
    });
  }
  return { rows, people, first };
}
