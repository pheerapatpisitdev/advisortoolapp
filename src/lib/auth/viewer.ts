import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { memberAccess, passOpen } from "@/lib/members/access";
import { PASS_PAGE } from "@/lib/members/pass";
import type { Who } from "@/lib/shell/menu";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { admit, admitMember, admitSuper, can, refusal, type AgentRow, type MemberRow, type Perm, type StaffRow, type SuperAdminRow, type Viewer } from "./access";
import { sessionNotBefore } from "./epoch";
import { safeNext } from "./next";
import { readSession } from "./session";

export type { Perm, Viewer } from "./access";

const AGENT_COLUMNS =
  "id, agent_code, name, role, is_admin, member_tier, membership_expires_at, created_at, tenant:tenants(id, slug, name, status, config, key_epoch)";

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

const MEMBER_COLUMNS = "id, email, name, status, revoked_at";

/** A member who signed up here (src/lib/auth/member.ts), or null. */
export async function memberById(id: string): Promise<MemberRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_members").select(MEMBER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสมาชิกไม่ได้: ${error.message}`);
  return (data as MemberRow | null) ?? null;
}

const SUPER_COLUMNS = "id, email, name, revoked_at";

/** A Super Admin who runs the back office (owner, 2026-10-15), or null. */
export async function superAdminById(id: string): Promise<SuperAdminRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_super_admins").select(SUPER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลผู้ดูแลระบบไม่ได้: ${error.message}`);
  return (data as SuperAdminRow | null) ?? null;
}

export async function staffRow(agentId: string): Promise<StaffRow | null> {
  const { data, error } = await supabaseAdmin().from("ins_staff")
    .select("is_owner, can_publish, can_connect, can_admin").eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านสิทธิ์ไม่ได้: ${error.message}`);
  return (data as StaffRow | null) ?? null;
}

/** Every staff member's agent id: the pool of pieces the staff share (src/lib/auth/scope.ts). */
export const staffAgentIds = cache(async (): Promise<string[]> => {
  const { data, error } = await supabaseAdmin().from("ins_staff").select("agent_id");
  if (error) throw new Error(`อ่านรายชื่อทีมงานไม่ได้: ${error.message}`);
  return ((data ?? []) as { agent_id: string }[]).map((r) => r.agent_id);
});

/**
 * Who is asking, read afresh from UnitOS's rows once per request. The cookie says who signed
 * in; the rows say whether they still may — an agent removed in UnitOS, a room suspended or a
 * room that revoked its keys is out on the next click, not when the cookie runs out.
 *
 * A session issued before the agent last signed out is over too, on every device (./epoch.ts,
 * 2026-10-01). That stamp is read alongside the agent's rows, so it adds no round trip.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession();
  if (!session) return null;
  const [agent, staff, notBefore] = await Promise.all([
    agentById(session.agentId), staffRow(session.agentId), sessionNotBefore(session.agentId),
  ]);
  if (notBefore !== null && session.issuedAt < notBefore) return null;
  if (agent) return admit(agent, staff, session.issuedAt);
  // not UnitOS's: a member who signed up here (owner, 2026-10-01), the Super Admin
  // (2026-10-15), or nobody
  const member = await memberById(session.agentId);
  if (member) return admitMember(member, session.issuedAt);
  return admitSuper(await superAdminById(session.agentId), session.issuedAt);
});

/**
 * Why a session that no longer lets anybody in was turned away, when it is for UnitClub's tier
 * (owner, 2026-10-16): the agent goes to the front page told to renew or upgrade. Read only on
 * the way out, so it costs the signed-in nothing.
 */
async function whyOut(): Promise<"premium" | null> {
  const session = await readSession();
  if (!session) return null;
  const [agent, staff, notBefore] = await Promise.all([
    agentById(session.agentId), staffRow(session.agentId), sessionNotBefore(session.agentId),
  ]);
  if (notBefore !== null && session.issuedAt < notBefore) return null;
  return refusal(agent, staff, session.issuedAt);
}

/**
 * For server actions and routes: a layout's gate does not cover an action, so each one asks.
 * The front of the app's: the Super Admin runs the back office only (owner, 2026-10-15), so
 * Studio's rounds, the wallet and the rest are refused to them here.
 */
export async function requireMember(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  if (viewer.kind === "super") throw new Error("ส่วนนี้สำหรับตัวแทนและสมาชิก");
  return viewer;
}

/** The back office asks for "backoffice", which only the Super Admin has; the front asks for the rest. */
export async function requireStaff(perm: Perm): Promise<Viewer> {
  const viewer = perm === "backoffice" ? await getViewer() : await requireMember();
  if (!viewer) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  if (!can(viewer, perm)) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
  return viewer;
}

/** A route's answer when the caller may not: the same words, as JSON. */
export async function refuseUnless(perm?: Perm): Promise<Response | null> {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  // the Super Admin's routes ask for "backoffice"; every other route is the front's
  if (viewer.kind === "super" && perm !== "backoffice") return Response.json({ ok: false, error: "ส่วนนี้สำหรับตัวแทนและสมาชิก" }, { status: 403 });
  if (perm && !can(viewer, perm)) return Response.json({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" }, { status: 403 });
  return null;
}

/** the pages an outside member needs a live pass for: หน้าหลัก, ถาม AI and Studio (owner, 2026-10-13; /ask since 2026-10-14) */
const passPage = (next: string) => next === "/home" || next.startsWith("/home/") || next === "/ask" || next === "/studio" || next.startsWith("/studio/");

/**
 * For pages. Somebody not signed in is sent to sign in and brought back; somebody signed in
 * without the permission goes to Studio, which every agent may use, rather than to an error —
 * or, turned away from the back office, to /home (owner, 2026-10-15).
 *
 * The Super Admin has the back office only: any other page sends them back to /admin.
 *
 * An outside member whose pass has run out is sent to renew it instead (owner, 2026-10-13).
 * Only a member is ever asked about a pass. A pass that cannot be read throws to the error
 * page: a redirect on it would loop or turn away a member who has paid.
 */
export async function gatePage(next: string, perm?: Perm): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    // the page actually asked for, when the middleware passed it on; the caller's guess otherwise
    const asked = safeNext((await headers()).get("x-pathname"), next);
    const premium = (await whyOut().catch(() => null)) === "premium" ? "premium=1&" : "";
    redirect(`/?${premium}next=${encodeURIComponent(asked)}`);
  }
  if (viewer.kind === "member" && passPage(next) && !passOpen(await memberAccess(viewer))) {
    redirect(`${PASS_PAGE}?expired=1`);
  }
  const office = next === "/admin" || next.startsWith("/admin/");
  if (viewer.kind === "super" && !office) redirect("/admin");
  if (perm && !can(viewer, perm)) redirect(office ? "/home" : "/studio");
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
    member: viewer.kind === "member",
    super: viewer.kind === "super",
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

/**
 * What to call each id in a list: a UnitOS agent's name or code, a member's name or email.
 * Two plain reads rather than a join — since 2026-10-01 an `agent_id` may be either kind,
 * and the foreign keys that joins went through are gone. An id found in neither is left out.
 */
export async function displayNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const [agents, members, supers] = await Promise.all([
    supabaseAdmin().from("agents").select("id, name, agent_code").in("id", unique),
    supabaseAdmin().from("ins_members").select("id, name, email").in("id", unique),
    supabaseAdmin().from("ins_super_admins").select("id, name, email").in("id", unique),
  ]);
  if (agents.error) console.error("agent names unreadable:", agents.error.message);
  if (members.error) console.error("member names unreadable:", members.error.message);
  if (supers.error) console.error("super admin names unreadable:", supers.error.message);
  const names: Record<string, string> = {};
  for (const s of (supers.data ?? []) as { id: string; name: string | null; email: string }[]) names[s.id] = s.name?.trim() || s.email;
  for (const m of (members.data ?? []) as { id: string; name: string | null; email: string }[]) names[m.id] = m.name?.trim() || m.email;
  for (const a of (agents.data ?? []) as { id: string; name: string | null; agent_code: string }[]) names[a.id] = a.name?.trim() || a.agent_code;
  return names;
}

/**
 * Who last posted, scheduled or moved each piece, by name — the calendar's "โดย". Staff share
 * one Page, so a post nobody remembers making should say whose it was. Pieces placed before
 * the log began (2026-09-27) have no line and show no name.
 */
export async function placedBy(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabaseAdmin().from("ins_audit")
    .select("target, agent_id")
    .in("target", ids).in("action", ["post", "schedule", "reschedule"])
    .order("at", { ascending: false });
  if (error) {
    console.error("placed-by unreadable:", error.message);
    return {};
  }
  const rows = (data ?? []) as { target: string; agent_id: string | null }[];
  const latest: Record<string, string> = {};
  for (const row of rows) if (!latest[row.target] && row.agent_id) latest[row.target] = row.agent_id;
  const names = await displayNames(Object.values(latest));
  const by: Record<string, string> = {};
  for (const [target, agentId] of Object.entries(latest)) if (names[agentId]) by[target] = names[agentId];
  return by;
}
