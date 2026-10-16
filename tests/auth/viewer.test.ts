import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error(`redirect ${to}`); }) }));
vi.mock("next/navigation", () => nav);
const session = vi.hoisted(() => ({ value: null as null | { agentId: string; issuedAt: number } }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => session.value }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { displayNames, gatePage, getViewer, placedBy } = await import("@/lib/auth/viewer");

const AGENT_ROW = {
  id: "a1", agent_code: "015495", name: "บอย",
  role: "member", is_admin: false, member_tier: "premium", membership_expires_at: null, created_at: "2026-01-01T00:00:00Z",
  tenant: { id: "t1", slug: "83g", name: "83G", status: "active", config: null as unknown, key_epoch: null },
};
const MEMBER_ROW = { id: "m1", email: "somchai@gmail.com", name: "สมชาย", status: "active", revoked_at: null };

beforeEach(() => {
  db.reset();
  session.value = null;
});

describe("getViewer", () => {
  it("is nobody without a session", async () => {
    expect(await getViewer()).toBeNull();
  });

  it("finds a UnitOS agent first", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() };
    db.on("agents", { data: AGENT_ROW });
    db.on("ins_staff", { data: null });
    const v = await getViewer();
    expect(v?.kind).toBe("unitos");
    expect(v?.tenantSlug).toBe("83g");
    expect(db.log.some((l) => l.table === "ins_members")).toBe(false);
  });

  it("finds a member when UnitOS has nobody by that id", async () => {
    session.value = { agentId: "m1", issuedAt: Date.now() };
    db.on("agents", { data: null });
    db.on("ins_staff", { data: null });
    db.on("ins_members", { data: MEMBER_ROW });
    const v = await getViewer();
    expect(v).toMatchObject({ kind: "member", agentId: "m1", tenantId: null, tenantName: "สมาชิกทั่วไป", staff: null });
  });

  it("shuts out a suspended member, and an id found nowhere", async () => {
    session.value = { agentId: "m1", issuedAt: Date.now() };
    db.on("agents", { data: null });
    db.on("ins_staff", { data: null });
    db.on("ins_members", { data: { ...MEMBER_ROW, status: "suspended" } });
    expect(await getViewer()).toBeNull();
    db.on("ins_members", { data: null });
    expect(await getViewer()).toBeNull();
  });
});

/** Signing out ends every session issued before it, on any device (review, 2026-10-01). */
describe("getViewer and signing out everywhere", () => {
  const signedOutAt = Date.parse("2026-10-01T03:00:00Z");

  it("refuses a session issued before the agent last signed out", async () => {
    session.value = { agentId: "a1", issuedAt: signedOutAt - 1 };
    db.on("agents", { data: AGENT_ROW });
    db.on("ins_staff", { data: null });
    db.on("ins_session_epochs", { data: { not_before: new Date(signedOutAt).toISOString() } });
    expect(await getViewer()).toBeNull();
  });

  it("refuses a member's old session the same way", async () => {
    session.value = { agentId: "m1", issuedAt: signedOutAt - 1 };
    db.on("agents", { data: null });
    db.on("ins_staff", { data: null });
    db.on("ins_members", { data: MEMBER_ROW });
    db.on("ins_session_epochs", { data: { not_before: new Date(signedOutAt).toISOString() } });
    expect(await getViewer()).toBeNull();
  });

  it("lets in a session issued since, and asks with the agent's rows rather than after them", async () => {
    session.value = { agentId: "a1", issuedAt: signedOutAt };
    db.on("agents", { data: AGENT_ROW });
    db.on("ins_staff", { data: null });
    db.on("ins_session_epochs", { data: { not_before: new Date(signedOutAt).toISOString() } });
    expect((await getViewer())?.agentId).toBe("a1");
    const epochs = db.log.find((l) => l.table === "ins_session_epochs")!;
    expect(epochs.steps.some((s) => s.method === "eq" && s.args[0] === "agent_id" && s.args[1] === "a1")).toBe(true);
  });

  it("lets the cookie stand, and says so, when the stamp cannot be read", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    session.value = { agentId: "a1", issuedAt: signedOutAt - 1 };
    db.on("agents", { data: AGENT_ROW });
    db.on("ins_staff", { data: null });
    db.on("ins_session_epochs", { error: { message: "timeout" } });
    expect((await getViewer())?.agentId).toBe("a1");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

/**
 * A session handed out before the agent became basic, in a room that keeps advisortool for
 * Premium (owner, 2026-10-16): out on the next click, sent to the front page told why.
 */
describe("getViewer and UnitClub's tiers", () => {
  const locked = { ...AGENT_ROW, tenant: { ...AGENT_ROW.tenant, config: { premiumOnly: ["ad-studio"] } } };

  it("ends a basic agent's session in a room that locks advisortool", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() - 86_400_000 };
    db.on("agents", { data: { ...locked, member_tier: "basic" } });
    db.on("ins_staff", { data: null });
    expect(await getViewer()).toBeNull();
    await expect(gatePage("/studio")).rejects.toThrow("redirect /?premium=1&next=%2Fstudio");
  });

  it("ends it when a Premium membership runs out in a room that charges one", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() - 86_400_000 };
    db.on("agents", { data: { ...locked, membership_expires_at: "2026-01-01T00:00:00Z", tenant: { ...locked.tenant, config: { premiumOnly: ["ad-studio"], flags: { memberFee: true } } } } });
    db.on("ins_staff", { data: null });
    expect(await getViewer()).toBeNull();
  });

  it("keeps a Premium agent's session, and a staff member's", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() };
    db.on("agents", { data: locked });
    db.on("ins_staff", { data: null });
    expect((await gatePage("/studio")).agentId).toBe("a1");
    db.on("agents", { data: { ...locked, member_tier: "basic", role: "manager" } });
    expect((await getViewer())?.agentId).toBe("a1");
  });

  it("sends somebody signed out to the plain front page", async () => {
    await expect(gatePage("/studio")).rejects.toThrow("redirect /?next=%2Fstudio");
  });
});

describe("displayNames", () => {
  it("names agents by name or code, and members by name or email", async () => {
    db.on("agents", { data: [{ id: "a1", name: "บอย", agent_code: "015495" }, { id: "a2", name: " ", agent_code: "000111" }] });
    db.on("ins_members", { data: [{ id: "m1", name: "", email: "somchai@gmail.com" }] });
    expect(await displayNames(["a1", "a2", "m1", "a1"])).toEqual({ a1: "บอย", a2: "000111", m1: "somchai@gmail.com" });
  });

  it("asks nothing for no ids", async () => {
    expect(await displayNames([])).toEqual({});
    expect(db.log).toHaveLength(0);
  });
});

describe("placedBy", () => {
  it("names who last placed each piece without joining agents through a foreign key", async () => {
    db.on("ins_audit", {
      data: [
        { target: "p1", agent_id: "m1" },
        { target: "p2", agent_id: "a1" },
        { target: "p1", agent_id: "a1" },
        { target: "p3", agent_id: null },
      ],
    });
    db.on("agents", { data: [{ id: "a1", name: "บอย", agent_code: "015495" }] });
    db.on("ins_members", { data: [{ id: "m1", name: "สมชาย", email: "somchai@gmail.com" }] });
    expect(await placedBy(["p1", "p2", "p3"])).toEqual({ p1: "สมชาย", p2: "บอย" });
    const audit = db.log.find((l) => l.table === "ins_audit")!;
    expect(String(audit.steps.find((s) => s.method === "select")?.args[0])).not.toContain("agents");
  });
});
