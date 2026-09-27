import { describe, it, expect } from "vitest";
import { admit, can, type AgentRow, type StaffRow } from "@/lib/auth/access";

const room = (over: Partial<NonNullable<AgentRow["tenant"]>> = {}): NonNullable<AgentRow["tenant"]> => ({
  id: "t1", slug: "83g", name: "83G", status: "active", config: null, key_epoch: null, ...over,
});
const agent = (over: Partial<AgentRow> = {}): AgentRow => ({
  id: "a1", agent_code: "015495", name: "บอย", tenant: room(), ...over,
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
  });
});
