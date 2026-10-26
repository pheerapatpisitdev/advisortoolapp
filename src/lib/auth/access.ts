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
  /** what UnitClub's tiers are read from (studioLocked below) */
  role: string | null;
  is_admin: boolean | null;
  member_tier: string | null;
  membership_expires_at: string | null;
  created_at: string | null;
  /** หน่วย: read for Bluewealth's agents only, whose names the back office keeps (./bluewealth.ts) */
  unit?: string | null;
  /** set on a row read from Bluewealth's copy of UnitOS rather than UnitClub (./bluewealth.ts) */
  system?: "bluewealth";
  tenant: {
    id: string;
    slug: string;
    name: string | null;
    status: string;
    config: {
      features?: { advisorTool?: boolean; adStudio?: boolean };
      isDemo?: boolean;
      /** the menus this room keeps for Premium agents; "ad-studio" is advisortool */
      premiumOnly?: unknown;
      /** memberFee: the room charges a membership, so a Premium agent past their date is basic */
      flags?: { memberFee?: unknown };
    } | null;
    key_epoch: string | null;
  } | null;
}

export interface StaffRow {
  is_owner: boolean;
  can_publish: boolean;
  can_connect: boolean;
  can_admin: boolean;
}

/**
 * "backoffice" is the Super Admin's alone (owner, 2026-10-15): every page and action under
 * /admin asks for it. The other four keep their meaning at the front of the app.
 */
export type Perm = "publish" | "connect" | "admin" | "owner" | "backoffice";

export interface Viewer {
  /**
   * a UnitOS agent, a member who signed up here (src/lib/auth/member.ts, owner 2026-10-01), or
   * the Super Admin who runs the back office and nothing else (owner, 2026-10-15). Bluewealth's
   * agents are "unitos" too: they get what a UnitOS agent gets (owner, 2026-10-24, ./bluewealth.ts)
   */
  kind: "unitos" | "member" | "super";
  agentId: string;
  /** the agent's 6-digit code; a member's Google email */
  code: string;
  name: string;
  /** null for a member: no UnitOS room */
  tenantId: string | null;
  tenantSlug: string;
  tenantName: string;
  /** a room still on its free trial, whose Studio allowance is smaller */
  trial: boolean;
  /** null for an agent who is not staff: Studio only */
  staff: { owner: boolean; publish: boolean; connect: boolean; admin: boolean } | null;
  /** a member who has not filled in สมัครสมาชิก yet: every page sends them there first (owner, 2026-10-27) */
  profileDue?: true;
}

/**
 * The rooms UnitOS itself lets in (supabase/functions/unitos-key in the UnitOS repo): a room
 * late with its payment keeps working through its grace period there, and so it does here.
 */
export const OPEN_ROOMS = ["trialing", "active", "past_due"];

// ---- UnitClub's Premium / basic tiers (owner, 2026-10-16) ----
// Each room picks the menus only its Premium agents may open (tenants.config.premiumOnly);
// advisortool is the menu "ad-studio". UnitClub locks its menu and its ticket (unitos-sso) by
// these rules; here they close the agent code and the sessions already handed out. Ported
// letter for letter from UnitOS/supabase/functions/_shared/line-submit.ts (membershipExpiresAt,
// agentTier, premiumOnlyMenus, agentLocked), itself a port of the web app and of
// app.agent_locked in the database: change the rule there first, then here.

const MEMBERSHIP_DAYS = 90;
const MEMBERSHIP_DAYS_NEW = 30;
const MEMBERSHIP_CUTOVER = "2026-07-01";
const DAY_MS = 24 * 60 * 60 * 1000;

type TierFields = Pick<AgentRow, "role" | "is_admin" | "member_tier" | "membership_expires_at" | "created_at">;

/** When the membership runs out: the date UnitClub set, else 30 days from joining (90 before 2026-07-01). */
export function membershipExpiresAt(agent: TierFields): Date | null {
  if (agent.membership_expires_at) {
    const t = new Date(agent.membership_expires_at);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const createdAt = agent.created_at;
  const base = createdAt ? new Date(createdAt) : null;
  if (!base || Number.isNaN(base.getTime())) return null;
  const days = String(createdAt || "").slice(0, 10) >= MEMBERSHIP_CUTOVER ? MEMBERSHIP_DAYS_NEW : MEMBERSHIP_DAYS;
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Basic: set basic, or a room that charges a membership and the date has passed. A room's
 * admins and managers are always Premium; no tier or an unknown one is Premium.
 */
export function agentTier(agent: TierFields, memberFeeOn: boolean, now: number = Date.now()): "premium" | "basic" {
  if (agent.is_admin || agent.role === "admin" || agent.role === "manager") return "premium";
  if (agent.member_tier === "basic") return "basic";
  if (memberFeeOn) {
    const expiresAt = membershipExpiresAt(agent);
    if (expiresAt && now >= expiresAt.getTime()) return "basic";
  }
  return "premium";
}

/** a room that never set its list; advisortool is not on it */
export const PREMIUM_ONLY_DEFAULT = ["activities", "rewards", "challenges", "lotto"];
/** the menus tied to LINE, open to every tier whatever a room's list says */
const PREMIUM_NEVER_LOCK = ["line-submit", "recruit", "sales", "schedule"];
/** the menu ids a room's list may hold */
const PREMIUM_MENU_IDS = [
  "goals", "goal-track", "financial-goals", "sales", "recruit", "qualification", "team-competition",
  "rewards", "activities", "leaderboard", "challenges", "lms", "course-replay", "schedule", "events",
  "card", "documents", "training", "ad-studio", "line-submit", "insurance-forms", "portfolio", "lotto",
];

/** The menus this room keeps for Premium: its own list when it is one ([] locks nothing), the default otherwise. */
export function premiumOnlyMenus(config: Record<string, unknown> | null | undefined): string[] {
  const raw = config?.premiumOnly;
  const ids = [...new Set((Array.isArray(raw) ? raw : PREMIUM_ONLY_DEFAULT).filter((id) =>
    typeof id === "string" && id !== "leaderboard" && !PREMIUM_NEVER_LOCK.includes(id) && PREMIUM_MENU_IDS.includes(id)))] as string[];
  return ids.includes("activities") ? [...ids, "leaderboard"] : ids;
}

/** A basic agent, and the room keeps this menu for Premium. */
export function agentLocked(
  agent: TierFields, config: Record<string, unknown> | null | undefined, memberFeeOn: boolean, menu: string,
  now: number = Date.now(),
): boolean {
  return agentTier(agent, memberFeeOn, now) === "basic" && premiumOnlyMenus(config).includes(menu);
}

/** advisortool is closed to this agent for their tier, as unitos-sso decides it. */
export function studioLocked(agent: AgentRow, now: number = Date.now()): boolean {
  const config = agent.tenant?.config ?? null;
  const memberFeeOn = !!config?.flags?.memberFee;
  return agentLocked(agent, config as Record<string, unknown> | null, memberFeeOn, "ad-studio", now);
}

/**
 * Why an agent is kept out, when it is for their tier: the room is open to them otherwise, so
 * the front page says to renew or upgrade rather than that the code is wrong. null for anybody
 * let in, and for anybody kept out for another reason.
 */
export function refusal(
  agent: AgentRow | null, staff: StaffRow | null, issuedAt: number, now: number = Date.now(), special = false,
): "premium" | null {
  if (!agent || special || !admitRoom(agent, staff, issuedAt)) return null;
  return studioLocked(agent, now) ? "premium" : null;
}

/**
 * The one gate for a UnitOS agent: the code typed on the front page, the ticket from UnitOS's
 * menu (/sso) and every request after (getViewer) all come through here. A basic agent of a
 * room that keeps advisortool for Premium is out on the next click (owner, 2026-10-16), unless
 * the owner put them on the สิทธิ์เข้าพิเศษ list (`special`, ins_special_access, 2026-10-20);
 * their room must still be open.
 */
export function admit(
  agent: AgentRow | null, staff: StaffRow | null, issuedAt: number, now: number = Date.now(), special = false,
): Viewer | null {
  const viewer = admitRoom(agent, staff, issuedAt);
  if (!viewer || !agent || (studioLocked(agent, now) && !special)) return null;
  return viewer;
}

function admitRoom(agent: AgentRow | null, staff: StaffRow | null, issuedAt: number): Viewer | null {
  const room = agent?.tenant;
  if (!agent || !room) return null;
  if (!OPEN_ROOMS.includes(room.status)) return null;
  // missing means on; the owner's Console turns a room off with `false`. The Console's switch
  // is Application+ (adStudio), the hub advisortool is opened from in UnitOS — off there means
  // off here too, so a room closed in the Console cannot come in through /login instead
  const features = room.config?.features;
  if (features?.advisorTool === false || features?.adStudio === false) return null;
  // a showroom: its demo codes are handed to anyone trying UnitOS, and would hand them the
  // owner's AI budget too (owner, 2026-09-27)
  if (room.config?.isDemo) return null;
  // UnitOS revokes every key of a room by moving key_epoch forward; a session is one of those keys
  if (room.key_epoch && issuedAt < Date.parse(room.key_epoch)) return null;
  return {
    kind: "unitos",
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

/** A member's row in ins_members, as src/lib/auth/viewer.ts reads it. */
export interface MemberRow {
  id: string;
  email: string;
  name: string;
  status: string;
  /** set on suspension: sessions issued before it are over */
  revoked_at: string | null;
  /** สำนักงาน; null until the member fills in สมัครสมาชิก (owner, 2026-10-27) */
  office?: string | null;
}

/** What a member's menu says in place of a room. */
export const MEMBER_ROOM = "สมาชิกทั่วไป";

/**
 * A member outside UnitOS (owner, 2026-10-01): Studio as any agent who is not staff has it —
 * the free rounds, then their own wallet — and nothing of the Page or the back office. A
 * suspension after the session was issued ends it, as a room's key_epoch does.
 */
export function admitMember(member: MemberRow | null, issuedAt: number): Viewer | null {
  if (!member || member.status !== "active") return null;
  if (member.revoked_at && issuedAt < Date.parse(member.revoked_at)) return null;
  return {
    kind: "member",
    agentId: member.id,
    code: member.email,
    name: member.name.trim() || member.email,
    tenantId: null,
    tenantSlug: "",
    tenantName: MEMBER_ROOM,
    trial: false,
    staff: null,
    // null, not missing: a row read before the column existed asks nothing of anybody
    ...(member.office === null ? { profileDue: true as const } : {}),
  };
}

/** A Super Admin's row in ins_super_admins, as src/lib/auth/viewer.ts reads it. */
export interface SuperAdminRow {
  id: string;
  email: string;
  name: string | null;
  revoked_at: string | null;
}

/** What the back office's menu says in place of a room. */
export const SUPER_ROOM = "Super Admin";

/**
 * The Super Admin (owner, 2026-10-15): the back office, all of it, and none of the front of the
 * app — gatePage sends them back to /admin from anywhere else. A revocation after the session
 * was issued ends it.
 */
export function admitSuper(row: SuperAdminRow | null, issuedAt: number): Viewer | null {
  if (!row) return null;
  if (row.revoked_at && issuedAt < Date.parse(row.revoked_at)) return null;
  return {
    kind: "super",
    agentId: row.id,
    code: row.email,
    name: row.name?.trim() || row.email,
    tenantId: null,
    tenantSlug: "",
    tenantName: SUPER_ROOM,
    trial: false,
    staff: null,
  };
}

/**
 * The Super Admin may do everything the back office asks; nobody else may open it, the owner's
 * UnitOS account included (owner, 2026-10-15). At the front, the owner may do everything, an
 * assistant exactly what was ticked, an agent none of it.
 */
export function can(viewer: Viewer | null, perm: Perm): boolean {
  if (viewer?.kind === "super") return true;
  if (perm === "backoffice") return false;
  const staff = viewer?.staff;
  if (!staff) return false;
  if (staff.owner) return true;
  return perm === "owner" ? false : staff[perm];
}
