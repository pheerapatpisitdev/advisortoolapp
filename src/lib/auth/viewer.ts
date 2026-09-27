import { cache } from "react";
import { redirect } from "next/navigation";
import type { Who } from "@/lib/shell/menu";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { admit, can, type AgentRow, type Perm, type StaffRow, type Viewer } from "./access";
import { readSession } from "./session";

export type { Perm, Viewer } from "./access";

const AGENT_COLUMNS = "id, agent_code, name, tenant:tenants(id, slug, name, status, config, key_epoch)";

/** UnitOS's agent row with its room, or null. */
export async function agentById(id: string): Promise<AgentRow | null> {
  const { data, error } = await supabaseAdmin().from("agents").select(AGENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลตัวแทนไม่ได้: ${error.message}`);
  return (data as unknown as AgentRow | null) ?? null;
}

/** Every agent holding this code. Codes do not repeat across rooms today; this says if they ever do. */
export async function agentsByCode(code: string): Promise<AgentRow[]> {
  const { data, error } = await supabaseAdmin().from("agents").select(AGENT_COLUMNS).eq("agent_code", code).limit(2);
  if (error) throw new Error(`อ่านข้อมูลตัวแทนไม่ได้: ${error.message}`);
  return (data as unknown as AgentRow[]) ?? [];
}

export async function staffRow(agentId: string): Promise<StaffRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_staff")
    .select("is_owner, can_publish, can_connect, can_admin").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านสิทธิ์ไม่ได้: ${error.message}`);
  return (data as StaffRow | null) ?? null;
}

/**
 * Who is asking, read afresh from UnitOS's rows once per request. The cookie says who signed
 * in; the rows say whether they still may — an agent removed in UnitOS, a room suspended or a
 * room that revoked its keys is out on the next click, not when the cookie runs out.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  const [agent, staff] = await Promise.all([agentById(session.agentId), staffRow(session.agentId)]);
  return admit(agent, staff, session.issuedAt);
});

/** For server actions and routes: a layout's gate does not cover an action, so each one asks. */
export async function requireMember(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("กรุณาเข้าสู่ระบบด้วยรหัสตัวแทนก่อน");
  return viewer;
}

export async function requireStaff(perm: Perm): Promise<Viewer> {
  const viewer = await requireMember();
  if (!can(viewer, perm)) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
  return viewer;
}

/** A route's answer when the caller may not: the same words, as JSON. */
export async function refuseUnless(perm?: Perm): Promise<Response | null> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบด้วยรหัสตัวแทนก่อน" }, { status: 401 });
  if (perm && !can(viewer, perm)) return Response.json({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" }, { status: 403 });
  return null;
}

/**
 * For pages. Somebody not signed in is sent to sign in and brought back; somebody signed in
 * without the permission goes to Studio, which every agent may use, rather than to an error.
 */
export async function gatePage(next: string, perm?: Perm): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (perm && !can(viewer, perm)) redirect("/studio");
  return viewer;
}

/** The little the menu needs to know, handed down from a layout (see `Who` in src/lib/shell/menu.ts). */
export function whoOf(viewer: Viewer | null): Who | null {
  if (!viewer) return null;
  return {
    name: viewer.name,
    room: viewer.tenantName,
    publish: can(viewer, "publish"),
    connect: can(viewer, "connect"),
    admin: can(viewer, "admin"),
    owner: can(viewer, "owner"),
  };
}

/** What staff did to the Page or the staff list. Never throws: a lost line must not undo a post. */
export async function audit(action: string, target: string | null, detail?: Record<string, unknown>): Promise<void> {
  try {
    const viewer = await getViewer();
    const { error } = await supabaseAdmin().from("ins_audit").insert({
      agent_id: viewer?.agentId ?? null, action, target, detail: detail ?? null,
    });
    if (error) console.error(`audit ${action} not written:`, error.message);
  } catch (e) {
    console.error(`audit ${action} not written:`, e);
  }
}
