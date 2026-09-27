/**
 * Who may come in, and what they may do — decided from UnitOS's own rows.
 *
 * advisortool keeps no list of users. An agent is whoever UnitOS says is an agent, in a room
 * UnitOS says is open; the only thing kept here is `ins_staff`, the owner and the assistants
 * the owner named, with what each may do to the Page and the back office. Pure, so the rules
 * can be tested without a database; src/lib/auth/viewer.ts feeds it the rows.
 */

export interface AgentRow {
  id: string;
  agent_code: string;
  name: string | null;
  tenant: {
    id: string;
    slug: string;
    name: string | null;
    status: string;
    config: { features?: { advisorTool?: boolean }; isDemo?: boolean } | null;
    key_epoch: string | null;
  } | null;
}

export interface StaffRow {
  is_owner: boolean;
  can_publish: boolean;
  can_connect: boolean;
  can_admin: boolean;
}

export type Perm = "publish" | "connect" | "admin" | "owner";

export interface Viewer {
  agentId: string;
  code: string;
  name: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  /** a room still on its free trial, whose Studio allowance is smaller */
  trial: boolean;
  /** null for an agent who is not staff: Studio only */
  staff: { owner: boolean; publish: boolean; connect: boolean; admin: boolean } | null;
}

/**
 * The rooms UnitOS itself lets in (supabase/functions/unitos-key in the UnitOS repo): a room
 * late with its payment keeps working through its grace period there, and so it does here.
 */
export const OPEN_ROOMS = ["trialing", "active", "past_due"];

export function admit(agent: AgentRow | null, staff: StaffRow | null, issuedAt: number): Viewer | null {
  const room = agent?.tenant;
  if (!agent || !room) return null;
  if (!OPEN_ROOMS.includes(room.status)) return null;
  // missing means on; the owner's Console turns advisortool off for a room with `false`
  if (room.config?.features?.advisorTool === false) return null;
  // a showroom: its demo codes are handed to anyone trying UnitOS, and would hand them the
  // owner's AI budget too (owner, 2026-09-27)
  if (room.config?.isDemo) return null;
  // UnitOS revokes every key of a room by moving key_epoch forward; a session is one of those keys
  if (room.key_epoch && issuedAt < Date.parse(room.key_epoch)) return null;
  return {
    agentId: agent.id,
    code: agent.agent_code,
    name: agent.name?.trim() || agent.agent_code,
    tenantId: room.id,
    tenantSlug: room.slug,
    tenantName: room.name?.trim() || room.slug,
    trial: room.status === "trialing",
    staff: staff
      ? { owner: staff.is_owner, publish: staff.can_publish, connect: staff.can_connect, admin: staff.can_admin }
      : null,
  };
}

/** The owner may do everything; an assistant exactly what was ticked; an agent none of it. */
export function can(viewer: Viewer | null, perm: Perm): boolean {
  const staff = viewer?.staff;
  if (!staff) return false;
  if (staff.owner) return true;
  return perm === "owner" ? false : staff[perm];
}
