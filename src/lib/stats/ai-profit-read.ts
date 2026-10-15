import { supabaseAdmin } from "@/lib/supabase/admin";
import { providerMap } from "@/lib/ai/provider-of";
import { buildProfit, type Profit } from "./ai-profit";
import { all } from "./usage-read";

/**
 * Reads what กำไรค่า AI counts for one period [from, to): the ledger's lines, the wallets'
 * charges and the members' passes. A table that cannot be read throws, so the page says so
 * rather than showing a profit that is quietly wrong.
 */
export async function readProfit(from: Date, to: Date): Promise<Profit> {
  const db = supabaseAdmin();
  const lo = from.toISOString();
  const hi = to.toISOString();
  const [models, ledger, charges, passes] = await Promise.all([
    db.from("model_configs").select("provider, model_name"),
    all("ledger", (a, b) => db.from("ins_usage_ledger").select("model, agent_id, cost_thb")
      .gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    all("wallet", (a, b) => db.from("ins_wallet_entries").select("round, amount_satang")
      .eq("kind", "charge").gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    all("passes", (a, b) => db.from("ins_member_passes").select("kind, amount_satang, revokes")
      .in("kind", ["paid", "revoked"]).gte("created_at", lo).lt("created_at", hi).order("id").range(a, b)),
  ]);
  if (models.error) throw new Error(`models: ${models.error.message}`);

  // a refund's row names the pass it cancels; what it takes back is what that pass was sold for
  const revokes = passes.filter((p) => p.kind === "revoked" && p.revokes != null).map((p) => Number(p.revokes));
  const sold = new Map<number, number>();
  if (revokes.length) {
    const { data, error } = await db.from("ins_member_passes").select("id, amount_satang").in("id", revokes);
    if (error) throw new Error(`passes refunded: ${error.message}`);
    for (const r of data ?? []) sold.set(Number(r.id), Number(r.amount_satang ?? 0));
  }

  return buildProfit({
    providerOf: providerMap((models.data ?? []) as { provider: string; model_name: string }[]),
    ledger: ledger.map((r) => ({ model: typeof r.model === "string" ? r.model : null, agentId: typeof r.agent_id === "string" ? r.agent_id : null, thb: Number(r.cost_thb ?? 0) })),
    charges: charges.map((r) => ({ round: typeof r.round === "string" ? r.round : null, satang: Number(r.amount_satang ?? 0) })),
    passes: passes.map((p) => ({
      satang: p.kind === "paid" ? Number(p.amount_satang ?? 0) : -(sold.get(Number(p.revokes)) ?? 0),
    })).filter((p) => p.satang !== 0),
  });
}
