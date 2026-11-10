import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UnitOS's menu lands on /sso with a one-time ticket. A basic agent of a room that keeps
 * advisortool for Premium gets no ticket from unitos-sso (v13); one issued just before the tier
 * changed is turned away here too, to the front page told why (owner, 2026-10-16).
 */

const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
vi.mock("@/lib/auth/login-log", () => ({ noteLogin: vi.fn() }));
const who = vi.hoisted(() => ({ agentById: vi.fn(), staffRow: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => who);
vi.mock("@/lib/facebook/origin", () => ({ requestOrigin: () => "https://advisortool.test" }));
const kc = vi.hoisted(() => ({ takeKingclubTicket: vi.fn(), kingclubAgentById: vi.fn(), rememberKingclubAgent: vi.fn() }));
vi.mock("@/lib/auth/kingclub", () => kc);
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { GET } = await import("@/app/sso/route");

const TICKET = "3f1c2b1e-7a52-4d8f-9a4b-0c7d7e2b9a11";
const AGENT = {
  id: "a1", agent_code: "015495", name: "บอย",
  role: "member", is_admin: false, member_tier: "premium", membership_expires_at: null, created_at: "2026-01-01T00:00:00Z",
  tenant: { id: "t1", slug: "83g", name: "83G", status: "active", config: { premiumOnly: ["ad-studio"] }, key_epoch: null },
};
const land = async () => (await GET(new Request(`https://advisortool.test/sso?t=${TICKET}`))).headers.get("location");

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.on("ins_sso_tickets", { data: { agent_id: "a1" } });
  who.staffRow.mockResolvedValue(null);
});

describe("/sso and UnitClub's tiers", () => {
  it("lets a Premium agent in", async () => {
    who.agentById.mockResolvedValue(AGENT);
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).toHaveBeenCalledWith("a1");
  });

  it("turns a basic agent away to the Premium notice, with no session", async () => {
    who.agentById.mockResolvedValue({ ...AGENT, member_tier: "basic" });
    expect(await land()).toBe("https://advisortool.test/?premium=1");
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("lets a basic agent on the สิทธิ์เข้าพิเศษ list in (owner, 2026-10-20)", async () => {
    who.agentById.mockResolvedValue({ ...AGENT, member_tier: "basic" });
    db.on("ins_special_access", { data: { agent_id: "a1" } });
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).toHaveBeenCalledWith("a1");
  });

  it("sends a closed room to the plain front page", async () => {
    who.agentById.mockResolvedValue({ ...AGENT, member_tier: "basic", tenant: { ...AGENT.tenant, status: "canceled" } });
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).not.toHaveBeenCalled();
  });
});

/** KingClub moved into a project of its own (2026-11-11) and writes its tickets there. */
describe("/sso and KingClub's own project", () => {
  const KC = { ...AGENT, id: "k1", system: "kingclub" as const, tenant: { ...AGENT.tenant, id: "9f35", slug: "ga83i", name: "KingClub", config: { premiumOnly: [] } } };

  beforeEach(() => {
    db.on("ins_sso_tickets", { data: null });
  });

  it("never asks KingClub about a ticket UnitClub has", async () => {
    db.on("ins_sso_tickets", { data: { agent_id: "a1" } });
    who.agentById.mockResolvedValue(AGENT);
    expect(await land()).toBe("https://advisortool.test/");
    expect(kc.takeKingclubTicket).not.toHaveBeenCalled();
    expect(kc.kingclubAgentById).not.toHaveBeenCalled();
  });

  it("takes a ticket UnitClub does not have from KingClub, reads the agent there, and remembers them", async () => {
    kc.takeKingclubTicket.mockResolvedValue("k1");
    kc.kingclubAgentById.mockResolvedValue(KC);
    expect(await land()).toBe("https://advisortool.test/");
    expect(kc.takeKingclubTicket).toHaveBeenCalledWith(TICKET);
    expect(who.agentById).not.toHaveBeenCalled();
    expect(kc.rememberKingclubAgent).toHaveBeenCalledWith(KC);
    expect(auth.startSession).toHaveBeenCalledWith("k1");
  });

  it("goes to the front page when neither has the ticket", async () => {
    kc.takeKingclubTicket.mockResolvedValue(null);
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("goes to the front page, not an error, when KingClub cannot be asked", async () => {
    kc.takeKingclubTicket.mockRejectedValue(new Error("not allowed"));
    expect(await land()).toBe("https://advisortool.test/");
    kc.takeKingclubTicket.mockResolvedValue("k1");
    kc.kingclubAgentById.mockRejectedValue(new Error("fetch failed"));
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("keeps out an agent of a room KingClub itself closed", async () => {
    kc.takeKingclubTicket.mockResolvedValue("k1");
    kc.kingclubAgentById.mockResolvedValue({ ...KC, tenant: { ...KC.tenant, status: "suspended" } });
    expect(await land()).toBe("https://advisortool.test/");
    expect(auth.startSession).not.toHaveBeenCalled();
    expect(kc.rememberKingclubAgent).not.toHaveBeenCalled();
  });
});
