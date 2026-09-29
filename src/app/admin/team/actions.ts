"use server";
import { revalidatePath } from "next/cache";
import { admit } from "@/lib/auth/access";
import { agentsByCode, audit, requireStaff } from "@/lib/auth/viewer";
import { pageConnections } from "@/lib/facebook/connection";
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
  /** the Pages tied to them (src/lib/auth/pages.ts); the owner and admins see every Page anyway */
  pages: string[];
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
  const { data: tied, error: tiedError } = await supabaseAdmin().from("ins_staff_pages").select("agent_id, page_id");
  if (tiedError) throw new Error(`อ่านเพจของทีมงานไม่ได้: ${tiedError.message}`);
  const pagesOf = (id: string) => ((tied ?? []) as { agent_id: string; page_id: string }[]).filter((t) => t.agent_id === id).map((t) => t.page_id);
  return ((data ?? []) as unknown as Joined[]).map((r) => ({
    agentId: r.agent_id,
    code: r.agent?.agent_code ?? "",
    name: r.agent?.name?.trim() || r.agent?.agent_code || "(ไม่พบใน UnitOS)",
    room: r.agent?.tenant?.name?.trim() || r.agent?.tenant?.slug || "",
    owner: r.is_owner, publish: r.can_publish, connect: r.can_connect, admin: r.can_admin,
    since: r.created_at,
    pages: pagesOf(r.agent_id),
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

/**
 * The Pages a member of staff looks after (owner, 2026-09-29): the ones ticked replace the ones
 * they had. A Page no longer connected is dropped rather than refused — the screen sends back
 * what the person had, and a stale tie refused there would lock their ticks for good (final
 * review). Never the owner's row: the owner sees every Page.
 */
export async function setStaffPages(agentId: string, pageIds: string[]): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("owner");
  const connected = new Set((await pageConnections()).map((p) => p.pageId));
  const ids = [...new Set(pageIds.filter((p): p is string => typeof p === "string" && connected.has(p)))];
  const db = supabaseAdmin();
  const { data: row, error: readError } = await db.from("ins_staff").select("is_owner").eq("agent_id", agentId).maybeSingle();
  if (readError) return { ok: false, error: `อ่านทีมงานไม่ได้: ${readError.message}` };
  if (!row) return { ok: false, error: "ไม่พบทีมงานคนนี้" };
  if ((row as { is_owner: boolean }).is_owner) return { ok: false, error: "เจ้าของเห็นทุกเพจอยู่แล้ว" };
  // Only what changed is written, the ones taken away first: a save that stops halfway leaves
  // them with fewer Pages than ticked, never with one the owner took away, and never loses the
  // ones ticked before and still ticked (clearing all and writing again lost every one on a failure).
  const { data: had, error: hadError } = await db.from("ins_staff_pages").select("page_id").eq("agent_id", agentId);
  if (hadError) return { ok: false, error: `บันทึกไม่สำเร็จ: ${hadError.message}` };
  const before = new Set(((had ?? []) as { page_id: string }[]).map((r) => r.page_id));
  const taken = [...before].filter((p) => !ids.includes(p));
  const given = ids.filter((p) => !before.has(p));
  if (taken.length) {
    const { error } = await db.from("ins_staff_pages").delete().eq("agent_id", agentId).in("page_id", taken);
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }
  if (given.length) {
    const { error } = await db.from("ins_staff_pages").insert(given.map((page_id) => ({ agent_id: agentId, page_id })));
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }
  await audit("staff-pages", agentId, { pages: ids });
  revalidatePath("/admin/team");
  return { ok: true };
}
