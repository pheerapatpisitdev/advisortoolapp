import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculatorName } from "./calculators";
import { buildStats, ROUND_TOOL, WHO_FROM, type Stats } from "./usage";

/**
 * Reads every row usage.ts counts, for one period, and counts them. Paged: the AI ledger alone
 * holds thousands of lines a month (the customer bots write most), past PostgREST's 1,000.
 * A table that cannot be read throws, so the page says the figures are unreadable rather than
 * showing a total that is quietly short.
 */

type Row = Record<string, unknown>;
const PAGE = 1000;
/** a bound on a runaway read: far above any month so far (Oct 2026: ~4,000 ledger lines) */
const MAX_ROWS = 50_000;

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function all(what: string, page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let at = 0; at < MAX_ROWS; at += PAGE) {
    const { data, error } = await page(at, at + PAGE - 1);
    if (error) throw new Error(`${what}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function readStats(from: Date, to: Date, now = new Date()): Promise<Stats> {
  const db = supabaseAdmin();
  const lo = from.toISOString();
  const hi = to.toISOString();
  const roundsTo = new Date(Math.min(to.getTime(), WHO_FROM.getTime())).toISOString();

  const [ledger, rounds, posts, videos, customers, sends, opens, wallet] = await Promise.all([
    all("ledger", (a, b) => db.from("ins_usage_ledger").select("task, agent_id, ask_id, cost_thb, created_at")
      .gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    lo < roundsTo
      ? all("rounds", (a, b) => db.from("ins_audit").select("action, agent_id, at")
        .in("action", Object.keys(ROUND_TOOL)).not("agent_id", "is", null).gte("at", lo).lt("at", roundsTo).order("id").range(a, b))
      : Promise.resolve([]),
    all("posts", (a, b) => db.from("ins_audit").select("agent_id, at")
      .in("action", ["post", "schedule"]).not("agent_id", "is", null).gte("at", lo).lt("at", hi).order("id").range(a, b)),
    all("clips", (a, b) => db.from("ins_quote_videos").select("agent_id, created_at, product:input->>product, fhc:input->fhc")
      .gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    all("fhc", (a, b) => db.from("ins_fhc_customers").select("agent_id, created_at")
      .gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    all("ad sends", (a, b) => db.from("ins_ad_send").select("created_by, created_at")
      .not("created_by", "is", null).eq("superseded", false).gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
    // before 20261102_tool_opens is applied the table is not there: no opens yet, not an error
    all("opens", (a, b) => db.from("ins_tool_opens").select("agent_id, tool, at")
      .gte("at", lo).lt("at", hi).order("id").range(a, b)).catch((e) => {
      console.error("stats: calculator opens not read:", e);
      return [] as Row[];
    }),
    all("wallet", (a, b) => db.from("ins_wallet_entries").select("agent_id, kind, amount_satang, created_at")
      .gte("created_at", lo).lt("created_at", hi).order("created_at").order("id").range(a, b)),
  ]);

  return buildStats({
    from, to, now,
    ledger: ledger.map((r) => ({ task: str(r.task), agentId: str(r.agent_id) || null, askId: str(r.ask_id) || null, thb: Number(r.cost_thb ?? 0), at: str(r.created_at) })),
    rounds: rounds.map((r) => ({ action: str(r.action), agentId: str(r.agent_id), at: str(r.at) })),
    posts: posts.map((r) => ({ agentId: str(r.agent_id), at: str(r.at) })),
    videos: videos.map((r) => ({ agentId: str(r.agent_id), at: str(r.created_at), product: str(r.product) || null, fhc: Boolean(r.fhc) })),
    customers: customers.map((r) => ({ agentId: str(r.agent_id), at: str(r.created_at) })),
    sends: sends.map((r) => ({ agentId: str(r.created_by), at: str(r.created_at) })),
    opens: opens.map((r) => ({ agentId: str(r.agent_id), name: calculatorName(str(r.tool)) ?? str(r.tool), at: str(r.at) })),
    wallet: wallet.map((r) => ({ agentId: str(r.agent_id), kind: str(r.kind), satang: Number(r.amount_satang ?? 0), at: str(r.created_at) })),
  });
}

export interface Who { name: string; room: string | null; unit: string | null; member: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** each person's name, สังกัด and หน่วย, the way the wallet table shows them; a member has none */
export async function whoAre(ids: string[]): Promise<Map<string, Who>> {
  const uniq = [...new Set(ids)].filter((i) => UUID.test(i));
  const out = new Map<string, Who>();
  if (!uniq.length) return out;
  const db = supabaseAdmin();
  const [agents, members] = await Promise.all([
    db.from("agents").select("id, name, agent_code, unit, tenant_id").in("id", uniq),
    db.from("ins_members").select("id, name, email").in("id", uniq),
  ]);
  const tenantIds = [...new Set(((agents.data ?? []) as Row[]).map((a) => str(a.tenant_id)).filter(Boolean))];
  const tenants = tenantIds.length ? await db.from("tenants").select("id, name").in("id", tenantIds) : { data: [] };
  const room = new Map(((tenants.data ?? []) as Row[]).map((t) => [str(t.id), str(t.name).replace(/^Krungthai-AXA Life\s+/i, "")]));
  for (const a of (agents.data ?? []) as Row[]) {
    out.set(str(a.id), { name: str(a.name).trim() || str(a.agent_code), room: room.get(str(a.tenant_id)) || null, unit: str(a.unit).trim() || null, member: false });
  }
  for (const m of (members.data ?? []) as Row[]) {
    out.set(str(m.id), { name: str(m.name).trim() || str(m.email), room: null, unit: null, member: true });
  }
  return out;
}
