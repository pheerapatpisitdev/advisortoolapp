import { supabaseAdmin } from "@/lib/supabase/admin";
import { displayNames } from "@/lib/auth/viewer";

/**
 * Who used AI this month and how much (owner, 2026-10-10).
 *
 * Asking AI is still free. The owner wants to see the numbers before setting a price, so each
 * person's chat questions and Studio work are shown side by side. The ledger has said whose call
 * each was only since 2026-10-15 (src/lib/ai/who.ts). Older calls, and the customer bots' calls,
 * have no person and are shown on one line of their own.
 */
export interface PersonUse {
  /** null: the line for calls with no person (customer bots, and calls from before the names) */
  agentId: string | null;
  name: string;
  /** chat questions asked, each counted once however many calls it made */
  asks: number;
  chatBaht: number;
  studioBaht: number;
  baht: number;
}

export interface SpendByAgentRow {
  agent_id: string | null; studio: boolean; asks: number | string; calls: number | string; cost_thb: number | string | null;
}

export const NO_ONE = "ลูกค้า/บอท (ไม่ระบุคน)";

/** one line per person, highest spend first; the line with no person always goes last */
export function byPerson(rows: SpendByAgentRow[], names: Record<string, string>): PersonUse[] {
  const acc = new Map<string | null, PersonUse>();
  for (const r of rows) {
    const id = r.agent_id ?? null;
    const p = acc.get(id) ?? {
      agentId: id, name: id === null ? NO_ONE : names[id] ?? id, asks: 0, chatBaht: 0, studioBaht: 0, baht: 0,
    };
    const baht = Number(r.cost_thb ?? 0);
    if (r.studio) p.studioBaht += baht;
    else {
      p.chatBaht += baht;
      p.asks += Number(r.asks);
    }
    p.baht += baht;
    acc.set(id, p);
  }
  const people = [...acc.values()].filter((p) => p.agentId !== null).sort((a, b) => b.baht - a.baht);
  const noOne = acc.get(null);
  return noOne ? [...people, noOne] : people;
}

/** null when the figures cannot be read (the migration not in yet, say): the page still opens */
export async function usageByPerson(since: Date): Promise<PersonUse[] | null> {
  const { data, error } = await supabaseAdmin().rpc("ins_spend_by_agent", { p_since: since.toISOString() });
  if (error) {
    console.error("อ่านยอดใช้ AI รายคนไม่สำเร็จ:", error.message);
    return null;
  }
  const rows = (data ?? []) as SpendByAgentRow[];
  const ids = rows.map((r) => r.agent_id).filter((id): id is string => Boolean(id));
  return byPerson(rows, await displayNames(ids));
}
