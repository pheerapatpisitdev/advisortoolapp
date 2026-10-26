import { describe, it, expect } from "vitest";
import { admit, admitMember, admitSuper, agentTier, can, membershipExpiresAt, premiumOnlyMenus, refusal, studioLocked, type AgentRow, type MemberRow, type StaffRow } from "@/lib/auth/access";

const room = (over: Partial<NonNullable<AgentRow["tenant"]>> = {}): NonNullable<AgentRow["tenant"]> => ({
  id: "t1", slug: "83g", name: "83G", status: "active", config: null, key_epoch: null, ...over,
});
const agent = (over: Partial<AgentRow> = {}): AgentRow => ({
  id: "a1", agent_code: "015495", name: "บอย",
  role: "member", is_admin: false, member_tier: "premium", membership_expires_at: "2099-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
  tenant: room(), ...over,
});
const staff = (over: Partial<StaffRow> = {}): StaffRow => ({
  is_owner: false, can_publish: true, can_connect: false, can_admin: false, ...over,
});

describe("admit", () => {
  it("lets an agent of an open room in, as a member", () => {
    const v = admit(agent(), null, Date.now());
    expect(v?.agentId).toBe("a1");
    expect(v?.tenantSlug).toBe("83g");
    expect(v?.staff).toBeNull();
    expect(v?.trial).toBe(false);
  });

  it("marks a trial room", () => {
    expect(admit(agent({ tenant: room({ status: "trialing" }) }), null, Date.now())?.trial).toBe(true);
  });

  it("keeps a room that is late to pay, as UnitOS does", () => {
    expect(admit(agent({ tenant: room({ status: "past_due" }) }), null, Date.now())).not.toBeNull();
  });

  it("shuts out an agent that is gone, or has no room", () => {
    expect(admit(null, null, Date.now())).toBeNull();
    expect(admit(agent({ tenant: null }), null, Date.now())).toBeNull();
  });

  it("shuts out a closed room", () => {
    for (const status of ["canceled", "suspended", "template", "expired"]) {
      expect(admit(agent({ tenant: room({ status }) }), null, Date.now())).toBeNull();
    }
  });

  it("shuts out a room with advisortool switched off in the Console", () => {
    const config = { features: { advisorTool: false } };
    expect(admit(agent({ tenant: room({ config }) }), null, Date.now())).toBeNull();
  });

  it("shuts out a room whose Application+ is switched off in the Console", () => {
    expect(admit(agent({ tenant: room({ config: { features: { adStudio: false } } }) }), null, Date.now())).toBeNull();
  });

  it("shuts out UnitOS's demo room, whose codes are handed to anyone trying it", () => {
    expect(admit(agent({ tenant: room({ config: { isDemo: true } }) }), null, Date.now())).toBeNull();
  });

  it("shuts out a session issued before the room revoked its keys", () => {
    const epoch = "2026-09-27T12:00:00Z";
    expect(admit(agent({ tenant: room({ key_epoch: epoch }) }), null, Date.parse(epoch) - 1)).toBeNull();
    expect(admit(agent({ tenant: room({ key_epoch: epoch }) }), null, Date.parse(epoch) + 1)).not.toBeNull();
  });

  it("carries the staff row's permissions", () => {
    const v = admit(agent(), staff({ can_connect: true }), Date.now());
    expect(v?.staff).toEqual({ owner: false, publish: true, connect: true, admin: false });
  });
});

describe("can", () => {
  it("gives a member nothing beyond Studio", () => {
    const v = admit(agent(), null, Date.now());
    for (const perm of ["publish", "connect", "admin", "owner"] as const) expect(can(v, perm)).toBe(false);
  });

  it("gives an assistant exactly what was ticked", () => {
    const v = admit(agent(), staff({ can_publish: true, can_admin: true }), Date.now());
    expect(can(v, "publish")).toBe(true);
    expect(can(v, "admin")).toBe(true);
    expect(can(v, "connect")).toBe(false);
    expect(can(v, "owner")).toBe(false);
  });

  it("gives the owner everything, whatever the switches say", () => {
    const v = admit(agent(), staff({ is_owner: true, can_publish: false, can_connect: false, can_admin: false }), Date.now());
    for (const perm of ["publish", "connect", "admin", "owner"] as const) expect(can(v, perm)).toBe(true);
  });

  it("gives nobody anything when nobody is signed in", () => {
    expect(can(null, "publish")).toBe(false);
    expect(can(null, "backoffice")).toBe(false);
  });

  it("keeps the back office from every agent, the owner included (owner, 2026-10-15)", () => {
    const owner = admit(agent(), staff({ is_owner: true, can_admin: true, can_connect: true }), Date.now());
    expect(can(owner, "backoffice")).toBe(false);
    expect(can(admit(agent(), staff({ can_admin: true, can_connect: true }), Date.now()), "backoffice")).toBe(false);
  });
});

describe("admitSuper (owner, 2026-10-15)", () => {
  const row = { id: "s1", email: "boss@gmail.com", name: null, revoked_at: null };

  it("lets the Super Admin in with the back office and every permission it asks for", () => {
    const v = admitSuper(row, Date.now());
    expect(v).toMatchObject({ kind: "super", agentId: "s1", code: "boss@gmail.com", name: "boss@gmail.com", tenantName: "Super Admin", staff: null });
    for (const perm of ["backoffice", "publish", "connect", "admin", "owner"] as const) expect(can(v, perm)).toBe(true);
  });

  it("ends sessions issued before a revocation", () => {
    const at = Date.parse("2026-10-15T00:00:00Z");
    expect(admitSuper({ ...row, revoked_at: "2026-10-15T00:00:00Z" }, at - 1)).toBeNull();
    expect(admitSuper({ ...row, revoked_at: "2026-10-15T00:00:00Z" }, at + 1)).not.toBeNull();
    expect(admitSuper(null, at)).toBeNull();
  });
});

describe("admitMember (owner, 2026-10-01)", () => {
  const member = (over: Partial<MemberRow> = {}): MemberRow => ({
    id: "m1", email: "somchai@gmail.com", name: "สมชาย", status: "active", revoked_at: null, ...over,
  });

  it("lets an active member in with Studio only and no room", () => {
    expect(admitMember(member(), Date.now())).toEqual({
      kind: "member", agentId: "m1", code: "somchai@gmail.com", name: "สมชาย",
      tenantId: null, tenantSlug: "", tenantName: "สมาชิกทั่วไป", trial: false, staff: null,
    });
  });

  it("marks a member who has not filled in สมัครสมาชิก, and only one whose สำนักงาน is null (owner, 2026-10-27)", () => {
    expect(admitMember(member({ office: null }), Date.now())?.profileDue).toBe(true);
    expect(admitMember(member({ office: "AIA ตึกสาทร" }), Date.now())?.profileDue).toBeUndefined();
    expect(admitMember(member(), Date.now())?.profileDue).toBeUndefined();
  });

  it("names a member with a blank name by their email", () => {
    expect(admitMember(member({ name: "  " }), Date.now())?.name).toBe("somchai@gmail.com");
  });

  it("shuts out a member who is gone or suspended", () => {
    expect(admitMember(null, Date.now())).toBeNull();
    expect(admitMember(member({ status: "suspended" }), Date.now())).toBeNull();
  });

  it("shuts out a session issued before the member was suspended", () => {
    const at = "2026-10-01T05:00:00Z";
    expect(admitMember(member({ revoked_at: at }), Date.parse(at) - 1)).toBeNull();
    expect(admitMember(member({ revoked_at: at }), Date.parse(at))).not.toBeNull();
  });

  it("marks a UnitOS agent as one", () => {
    expect(admit(agent(), null, Date.now())?.kind).toBe("unitos");
  });
});

/**
 * UnitClub's Premium / basic tiers (owner, 2026-10-16): a room that puts advisortool ("ad-studio")
 * on its Premium-only list keeps its basic agents out, by the same rule as UnitOS's
 * _shared/line-submit.ts agentLocked and app.agent_locked.
 */
describe("Premium-only advisortool", () => {
  const NOW = Date.parse("2026-10-16T12:00:00Z");
  const locks = (over: Record<string, unknown> = {}) => room({ config: { premiumOnly: ["ad-studio", "lotto"], ...over } });
  const basic = (over: Partial<AgentRow> = {}) => agent({ member_tier: "basic", tenant: locks(), ...over });

  it("keeps a basic agent out of a room that locks advisortool", () => {
    expect(admit(basic(), null, NOW, NOW)).toBeNull();
    expect(refusal(basic(), null, NOW, NOW)).toBe("premium");
  });

  it("lets an agent on the สิทธิ์เข้าพิเศษ list in past the lock, never into a closed room (owner, 2026-10-20)", () => {
    expect(admit(basic(), null, NOW, NOW, true)?.agentId).toBe("a1");
    expect(refusal(basic(), null, NOW, NOW, true)).toBeNull();
    const lapsed = agent({ member_tier: "premium", membership_expires_at: "2026-08-23T00:00:00Z", tenant: locks({ flags: { memberFee: true } }) });
    expect(admit(lapsed, null, NOW, NOW, true)).not.toBeNull();
    expect(admit(basic({ tenant: room({ status: "suspended", config: { premiumOnly: ["ad-studio"] } }) }), null, NOW, NOW, true)).toBeNull();
    expect(admit(basic({ tenant: locks({ features: { adStudio: false } }) }), null, NOW, NOW, true)).toBeNull();
  });

  it("lets a Premium agent of the same room in", () => {
    const v = admit(agent({ tenant: locks() }), null, NOW, NOW);
    expect(v?.agentId).toBe("a1");
    expect(refusal(agent({ tenant: locks() }), null, NOW, NOW)).toBeNull();
  });

  it("never locks a room's managers or admins, whatever their tier says", () => {
    for (const over of [{ role: "manager" }, { role: "admin" }, { is_admin: true }]) {
      expect(admit(basic(over), null, NOW, NOW)).not.toBeNull();
    }
  });

  it("lets a basic agent in where the room does not lock advisortool", () => {
    expect(admit(agent({ member_tier: "basic" }), null, NOW, NOW)).not.toBeNull();   // no list: the default, without ad-studio
    expect(admit(basic({ tenant: room({ config: { premiumOnly: [] } }) }), null, NOW, NOW)).not.toBeNull();
    expect(admit(basic({ tenant: room({ config: { premiumOnly: ["lotto"] } }) }), null, NOW, NOW)).not.toBeNull();
    expect(admit(basic({ tenant: room({ config: { premiumOnly: "ad-studio" } }) }), null, NOW, NOW)).not.toBeNull();
  });

  it("counts a Premium agent past their date as basic in a room that charges a membership", () => {
    const lapsed = { member_tier: "premium", membership_expires_at: "2026-10-01T00:00:00Z" };
    expect(admit(agent({ ...lapsed, tenant: locks({ flags: { memberFee: true } }) }), null, NOW, NOW)).toBeNull();
    expect(refusal(agent({ ...lapsed, tenant: locks({ flags: { memberFee: true } }) }), null, NOW, NOW)).toBe("premium");
    // the same date in a room that charges nothing stays Premium
    expect(admit(agent({ ...lapsed, tenant: locks() }), null, NOW, NOW)).not.toBeNull();
    // the moment the date is reached counts as past it
    const at = agent({ membership_expires_at: "2026-10-16T12:00:00Z", tenant: locks({ flags: { memberFee: true } }) });
    expect(studioLocked(at, NOW)).toBe(true);
    expect(studioLocked(at, NOW - 1)).toBe(false);
  });

  it("dates a membership with no date from joining: 30 days from 2026-07-01, 90 before", () => {
    const fresh = { membership_expires_at: null, created_at: "2026-09-01T00:00:00Z" };
    expect(membershipExpiresAt(agent(fresh))?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    const old = { membership_expires_at: null, created_at: "2026-06-30T00:00:00Z" };
    expect(membershipExpiresAt(agent(old))?.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(agentTier(agent(fresh), true, NOW)).toBe("basic");
    expect(agentTier(agent({ membership_expires_at: null, created_at: null }), true, NOW)).toBe("premium");
  });

  it("reads the room's list as UnitClub does", () => {
    expect(premiumOnlyMenus(null)).toEqual(["activities", "rewards", "challenges", "lotto", "leaderboard"]);
    expect(premiumOnlyMenus({ premiumOnly: [] })).toEqual([]);
    expect(premiumOnlyMenus({ premiumOnly: ["ad-studio", "ad-studio", "sales", "nonsense", 7] })).toEqual(["ad-studio"]);
  });

  it("says nothing of tiers for a room closed for another reason", () => {
    const closed = basic({ tenant: { ...locks(), status: "canceled" } });
    expect(admit(closed, null, NOW, NOW)).toBeNull();
    expect(refusal(closed, null, NOW, NOW)).toBeNull();
    expect(refusal(null, null, NOW, NOW)).toBeNull();
  });
});
