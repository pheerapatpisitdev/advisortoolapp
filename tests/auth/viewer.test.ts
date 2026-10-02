import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const session = vi.hoisted(() => ({ value: null as null | { agentId: string; issuedAt: number } }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => session.value }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const { displayNames, getViewer, placedBy } = await import("@/lib/auth/viewer");

const AGENT_ROW = {
  id: "a1", agent_code: "015495", name: "บอย",
  tenant: { id: "t1", slug: "83g", name: "83G", status: "active", config: null, key_epoch: null },
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
