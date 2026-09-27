"use server";
import { revalidatePath } from "next/cache";
import { admit } from "@/lib/auth/access";
import { agentsByCode, audit, requireStaff } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * ทีมงาน: the owner's list of assistants, and what each may do (owner, 2026-09-27).
 *
 * An assistant is a UnitOS agent the owner names here by their 6-digit code; the row keeps
 * the agent's id, so a code that changes later changes nothing. A new assistant may post and
 * schedule (the reason there are assistants); connecting Pages and the rest of the back office
 * are ticked one by one. The owner's own row is not on offer: it cannot be removed or
 * narrowed from here, so the owner cannot lock themself out.
 */

export interface StaffMember {
  agentId: string;
  code: string;
  name: string;
  room: string;
  owner: boolean;
  publish: boolean;
  connect: boolean;
  admin: boolean;
  since: string;
}

type Joined = {
  agent_id: string; is_owner: boolean; can_publish: boolean; can_connect: boolean; can_admin: boolean; created_at: string;
  agent: { agent_code: string; name: string | null; tenant: { slug: string; name: string | null } | null } | null;
};

export async function listStaff(): Promise<StaffMember[]> {
  await requireStaff("owner");
  const { data, error } = await supabaseAdmin().from("ins_staff")
    .select("agent_id, is_owner, can_publish, can_connect, can_admin, created_at, agent:agents!ins_staff_agent_id_fkey(agent_code, name, tenant:tenants(slug, name))")
    .order("is_owner", { ascending: false }).order("created_at");
  if (error) throw new Error(`อ่านรายชื่อทีมงานไม่ได้: ${error.message}`);
  return ((data ?? []) as unknown as Joined[]).map((r) => ({
    agentId: r.agent_id,
    code: r.agent?.agent_code ?? "",
    name: r.agent?.name?.trim() || r.agent?.agent_code || "(ไม่พบใน UnitOS)",
    room: r.agent?.tenant?.name?.trim() || r.agent?.tenant?.slug || "",
    owner: r.is_owner, publish: r.can_publish, connect: r.can_connect, admin: r.can_admin,
    since: r.created_at,
  }));
}

/** Who a code belongs to, shown before เพิ่ม so the owner adds the person they meant. */
export async function lookUpAgent(code: string): Promise<{ ok: true; name: string; room: string } | { ok: false; error: string }> {
  await requireStaff("owner");
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "กรอกรหัสตัวแทน 6 หลัก" };
  const agents = await agentsByCode(code.trim());
  if (agents.length > 1) return { ok: false, error: "รหัสนี้มีในมากกว่าหนึ่งห้อง — เพิ่มจากที่นี่ไม่ได้" };
  const viewer = agents[0] ? admit(agents[0], null, Date.now()) : null;
  if (!viewer) return { ok: false, error: "ไม่พบรหัสนี้ใน UnitOS หรือห้องของเขายังไม่เปิดใช้" };
  return { ok: true, name: viewer.name, room: viewer.tenantName };
}

export async function addStaff(code: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireStaff("owner");
  const found = await agentsByCode(code.trim());
  const agent = found.length === 1 ? found[0] : null;
  if (!agent || !admit(agent, null, Date.now())) return { ok: false, error: "ไม่พบรหัสนี้ใน UnitOS หรือห้องของเขายังไม่เปิดใช้" };
  const { error } = await supabaseAdmin().from("ins_staff")
    .insert({ agent_id: agent.id, can_publish: true, can_connect: false, can_admin: false, added_by: me.agentId });
  if (error) return { ok: false, error: error.code === "23505" ? "คนนี้อยู่ในทีมงานแล้ว" : `เพิ่มไม่สำเร็จ: ${error.message}` };
  await audit("staff-add", agent.id, { code: agent.agent_code });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function setStaffFlags(agentId: string, flags: { publish: boolean; connect: boolean; admin: boolean }): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("owner");
  const { data, error } = await supabaseAdmin().from("ins_staff")
    .update({ can_publish: flags.publish, can_connect: flags.connect, can_admin: flags.admin })
    .eq("agent_id", agentId).eq("is_owner", false).select("agent_id");
  if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data?.length) return { ok: false, error: "แก้สิทธิ์เจ้าของจากที่นี่ไม่ได้" };
  await audit("staff-update", agentId, flags);
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function removeStaff(agentId: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("owner");
  const { data, error } = await supabaseAdmin().from("ins_staff")
    .delete().eq("agent_id", agentId).eq("is_owner", false).select("agent_id");
  if (error) return { ok: false, error: `เอาออกไม่สำเร็จ: ${error.message}` };
  if (!data?.length) return { ok: false, error: "เอาเจ้าของออกจากทีมงานไม่ได้" };
  await audit("staff-remove", agentId);
  revalidatePath("/admin/team");
  return { ok: true };
}
