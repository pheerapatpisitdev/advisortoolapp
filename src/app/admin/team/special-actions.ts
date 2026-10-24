"use server";
import { revalidatePath } from "next/cache";
import { admit, studioLocked, type AgentRow } from "@/lib/auth/access";
import { bluewealthNames, rememberBluewealthAgent } from "@/lib/auth/bluewealth";
import { listSpecialAccess, removeSpecialAccess, setSpecialAccess } from "@/lib/auth/special";
import { agentsByCode, audit, requireStaff } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * สิทธิ์เข้าพิเศษ (owner, 2026-10-20; mockup KRqC5VJgr4vHirF6t12Ayx, ก): UnitOS agents the owner
 * lets in past UnitClub's Premium lock, each with a monthly AI budget spent before their own
 * money. Their room must still be open: the list does not open a closed or demo room.
 */

/** the most a month may carry, in baht */
const MAX_SPECIAL_BAHT = 10000;

export interface SpecialMember {
  agentId: string;
  code: string;
  name: string;
  room: string;
  /** UnitClub's tier would keep them out without the list */
  locked: boolean;
  monthlySatang: number;
  since: string;
  /** this month's budget; null until their first use of the month */
  month: { amountSatang: number; leftSatang: number } | null;
}

export async function listSpecial(): Promise<SpecialMember[]> {
  await requireStaff("backoffice");
  const rows = await listSpecialAccess();
  if (rows.length === 0) return [];
  const { data, error } = await supabaseAdmin().from("agents")
    .select("id, agent_code, name, role, is_admin, member_tier, membership_expires_at, created_at, tenant:tenants(id, slug, name, status, config, key_epoch)")
    .in("id", rows.map((r) => r.agentId));
  if (error) throw new Error(`อ่านข้อมูลตัวแทนไม่ได้: ${error.message}`);
  const agents = new Map(((data ?? []) as unknown as AgentRow[]).map((a) => [a.id, a]));
  // Bluewealth's agents, as of their last sign-in (src/lib/auth/bluewealth.ts)
  const missing = rows.map((r) => r.agentId).filter((id) => !agents.has(id));
  const outside = new Map((await bluewealthNames(missing)).map((b) => [b.id, b]));
  return rows.map((r) => {
    const a = agents.get(r.agentId);
    const b = outside.get(r.agentId);
    return {
      agentId: r.agentId,
      code: a?.agent_code ?? b?.agent_code ?? "",
      name: a?.name?.trim() || a?.agent_code || b?.name?.trim() || b?.agent_code || "(ไม่พบใน UnitOS)",
      room: a?.tenant?.name?.trim() || a?.tenant?.slug || b?.tenant_name || "",
      locked: a ? studioLocked(a) : false,
      monthlySatang: r.monthlySatang,
      since: r.createdAt,
      month: r.month,
    };
  });
}

/** whole baht, ฿0 (entry only) to MAX_SPECIAL_BAHT */
function readBaht(raw: string): { ok: true; satang: number } | { ok: false; error: string } {
  const t = raw.trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return { ok: false, error: "กรอกงบเป็นบาทเต็ม เช่น 100" };
  const baht = Number(t);
  if (baht > MAX_SPECIAL_BAHT) return { ok: false, error: `งบต่อเดือนไม่เกิน ฿${MAX_SPECIAL_BAHT.toLocaleString("th-TH")}` };
  return { ok: true, satang: baht * 100 };
}

/** Who a code belongs to, shown before ให้สิทธิ์; an agent the Premium lock keeps out is found too. */
export async function lookUpSpecial(code: string): Promise<{ ok: true; name: string; room: string; locked: boolean } | { ok: false; error: string }> {
  await requireStaff("backoffice");
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "กรอกรหัสตัวแทน 6 หลัก" };
  const agents = await agentsByCode(code.trim());
  if (agents.length > 1) return { ok: false, error: "รหัสนี้มีในมากกว่าหนึ่งห้อง — เพิ่มจากที่นี่ไม่ได้" };
  const agent = agents[0] ?? null;
  const viewer = agent ? admit(agent, null, Date.now(), Date.now(), true) : null;
  if (!agent || !viewer) return { ok: false, error: "ไม่พบรหัสนี้ใน UnitOS หรือห้องของเขายังไม่เปิดใช้" };
  return { ok: true, name: viewer.name, room: viewer.tenantName, locked: studioLocked(agent) };
}

export async function addSpecial(code: string, baht: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireStaff("backoffice");
  const amount = readBaht(baht);
  if (!amount.ok) return amount;
  const found = await agentsByCode(code.trim());
  const agent = found.length === 1 ? found[0] : null;
  if (!agent || !admit(agent, null, Date.now(), Date.now(), true)) return { ok: false, error: "ไม่พบรหัสนี้ใน UnitOS หรือห้องของเขายังไม่เปิดใช้" };
  if ((await listSpecialAccess()).some((r) => r.agentId === agent.id)) return { ok: false, error: "คนนี้มีสิทธิ์เข้าพิเศษอยู่แล้ว — แก้งบจากรายชื่อด้านล่าง" };
  await setSpecialAccess(agent.id, amount.satang, me.code);
  // named on the list before their first sign-in
  if (agent.system === "bluewealth") await rememberBluewealthAgent(agent);
  await audit("special-add", agent.id, { code: agent.agent_code, satang: amount.satang });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function setSpecialBudget(agentId: string, baht: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireStaff("backoffice");
  const amount = readBaht(baht);
  if (!amount.ok) return amount;
  if (!(await listSpecialAccess()).some((r) => r.agentId === agentId)) return { ok: false, error: "ไม่พบคนนี้ในรายชื่อสิทธิ์เข้าพิเศษ" };
  await setSpecialAccess(agentId, amount.satang, me.code);
  await audit("special-update", agentId, { satang: amount.satang });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function removeSpecial(agentId: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("backoffice");
  await removeSpecialAccess(agentId);
  await audit("special-remove", agentId);
  revalidatePath("/admin/team");
  return { ok: true };
}
