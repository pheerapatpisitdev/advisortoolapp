import { describe, it, expect } from "vitest";
import { agentFilter, maySee, roomFilter, roomMaySee, type Scope } from "@/lib/auth/scope";

const member: Scope = { agents: ["a1"], unowned: false, room: "t1", owner: { agentId: "a1", tenantId: "t1" } };
const staff: Scope = { agents: ["s1", "s2"], unowned: true, room: "t1", owner: { agentId: "s1", tenantId: "t1" } };
const all: Scope = { agents: null, unowned: true, room: null, owner: null };
const none: Scope = { agents: [], unowned: false, room: "", owner: null };

describe("scope", () => {
  it("shows an agent their own pieces and nobody else's", () => {
    expect(maySee(member, "a1")).toBe(true);
    expect(maySee(member, "a2")).toBe(false);
    expect(maySee(member, null)).toBe(false);
  });

  it("shows staff the staff's pieces and the unowned ones", () => {
    expect(maySee(staff, "s2")).toBe(true);
    expect(maySee(staff, null)).toBe(true);
    expect(maySee(staff, "a1")).toBe(false);
  });

  it("shows work with no request everything, and a request from nobody nothing", () => {
    expect(maySee(all, "anyone")).toBe(true);
    expect(maySee(none, "anyone")).toBe(false);
    expect(maySee(none, null)).toBe(false);
  });

  it("writes the same rules as filters", () => {
    expect(agentFilter(member)).toBe("agent_id.in.(a1)");
    expect(agentFilter(staff)).toBe("agent_id.in.(s1,s2),agent_id.is.null");
    expect(agentFilter(all)).toBeNull();
    expect(agentFilter(none)).toBe("agent_id.eq.00000000-0000-0000-0000-000000000000");
  });

  it("keeps the people library to the room", () => {
    expect(roomMaySee(member, "t1")).toBe(true);
    expect(roomMaySee(member, "t2")).toBe(false);
    expect(roomMaySee(member, null)).toBe(false);
    expect(roomMaySee(staff, null)).toBe(true);
    expect(roomMaySee(all, "t9")).toBe(true);
    expect(roomFilter(member)).toBe("tenant_id.eq.t1");
    expect(roomFilter(staff)).toBe("tenant_id.eq.t1,tenant_id.is.null");
    expect(roomFilter(none)).toBe("tenant_id.eq.00000000-0000-0000-0000-000000000000");
  });
});
