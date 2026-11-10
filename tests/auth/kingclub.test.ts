import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * KingClub's agents (owner chose plan ข and ก, 2026-11-11): KingClub moved into a Supabase project of
 * its own. Its tickets are taken there and its agents read live from there, through two functions
 * opened by KingClub's publishable key and a lookup key of ours; what they made here stays here.
 */

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const session = vi.hoisted(() => ({ value: null as null | { agentId: string; issuedAt: number } }));
vi.mock("@/lib/auth/session", () => ({ readSession: async () => session.value }));
/** KingClub's (and Bluewealth's) functions, by the project asked */
const remote = vi.hoisted(() => ({ kingclub: vi.fn(), bluewealth: vi.fn() }));
const createClient = vi.hoisted(() => vi.fn((url: string) => ({
  rpc: (fn: string, args: unknown) => (url.includes("kc") ? remote.kingclub : remote.bluewealth)(fn, args),
})));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
const kc = await import("@/lib/auth/kingclub");
const { agentsByCode, displayNames, getViewer } = await import("@/lib/auth/viewer");

const BASE = {
  agent_code: "731204", name: "เก่ง", role: "member", is_admin: false, member_tier: "premium",
  membership_expires_at: null, created_at: "2026-09-01T00:00:00Z",
};
const ROOM = { id: "9f35fe97", slug: "ga83i", name: "KingClub", key_epoch: null, config: { features: {}, premiumOnly: [] } };
/** the row UnitClub kept: the room suspended there on the move */
const LEFT_IN_UNITCLUB = { id: "k1", ...BASE, tenant: { ...ROOM, status: "suspended" } };
/** KingClub's own row */
const AT_KINGCLUB = { id: "k1", ...BASE, tenant: { ...ROOM, status: "active" } };
const OTHER = { id: "a1", ...BASE, agent_code: "015495", tenant: { ...ROOM, id: "t1", slug: "83g", name: "83G", status: "active" } };

const ENV = { KINGCLUB_SUPABASE_URL: "https://kc.supabase.co", KINGCLUB_ANON_KEY: "anon", KINGCLUB_LOOKUP_KEY: "secret" };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  session.value = null;
  remote.kingclub.mockResolvedValue({ data: [], error: null });
  remote.bluewealth.mockResolvedValue({ data: [], error: null });
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  db.on("ins_staff", { data: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("taking KingClub's ticket", () => {
  it("asks KingClub's function with the publishable key and the lookup key", async () => {
    remote.kingclub.mockResolvedValue({ data: "k1", error: null });
    expect(await kc.takeKingclubTicket("t-1")).toBe("k1");
    expect(createClient).toHaveBeenCalledWith("https://kc.supabase.co", "anon", expect.anything());
    expect(remote.kingclub).toHaveBeenCalledWith("advisortool_take_ticket", { p_key: "secret", p_id: "t-1" });
  });

  it("is nobody for a ticket KingClub does not have, used or old", async () => {
    remote.kingclub.mockResolvedValue({ data: null, error: null });
    expect(await kc.takeKingclubTicket("t-1")).toBeNull();
  });

  it("asks nobody until the keys are set", async () => {
    vi.stubEnv("KINGCLUB_LOOKUP_KEY", "");
    expect(kc.kingclubConfigured()).toBe(false);
    expect(await kc.takeKingclubTicket("t-1")).toBeNull();
    expect(await kc.kingclubAgentById("k1")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("throws KingClub's words when it refuses", async () => {
    remote.kingclub.mockResolvedValue({ data: null, error: { message: "not allowed" } });
    await expect(kc.takeKingclubTicket("t-1")).rejects.toThrow("not allowed");
  });
});

describe("getViewer and KingClub's agents", () => {
  it("reads an agent left in UnitClub's suspended room from KingClub, and lets them in", async () => {
    session.value = { agentId: "k1", issuedAt: Date.now() };
    db.on("agents", { data: LEFT_IN_UNITCLUB });
    remote.kingclub.mockResolvedValue({ data: [AT_KINGCLUB], error: null });
    expect(await getViewer()).toMatchObject({ kind: "unitos", agentId: "k1", tenantSlug: "ga83i" });
    expect(remote.kingclub).toHaveBeenCalledWith("advisortool_agents", { p_key: "secret", p_id: "k1" });
  });

  it("follows KingClub when it closes the room or removes the agent", async () => {
    session.value = { agentId: "k1", issuedAt: Date.now() };
    db.on("agents", { data: LEFT_IN_UNITCLUB });
    remote.kingclub.mockResolvedValue({ data: [{ ...AT_KINGCLUB, tenant: { ...AT_KINGCLUB.tenant, status: "suspended" } }], error: null });
    expect(await getViewer()).toBeNull();
    remote.kingclub.mockResolvedValue({ data: [], error: null });
    expect(await getViewer()).toBeNull();
  });

  it("keeps the agent out, with no error, when KingClub cannot be asked", async () => {
    session.value = { agentId: "k1", issuedAt: Date.now() };
    db.on("agents", { data: LEFT_IN_UNITCLUB });
    remote.kingclub.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    expect(await getViewer()).toBeNull();
  });

  it("never asks KingClub about an agent of a room open in UnitClub", async () => {
    session.value = { agentId: "a1", issuedAt: Date.now() };
    db.on("agents", { data: OTHER });
    expect(await getViewer()).toMatchObject({ agentId: "a1", tenantSlug: "83g" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("finds an agent KingClub added after the move, asking KingClub before Bluewealth once they are known", async () => {
    session.value = { agentId: "k2", issuedAt: Date.now() };
    db.on("agents", { data: null });
    db.on("ins_kingclub_agents", { data: { id: "k2" } });
    remote.kingclub.mockResolvedValue({ data: [{ ...AT_KINGCLUB, id: "k2" }], error: null });
    expect(await getViewer()).toMatchObject({ agentId: "k2", tenantSlug: "ga83i" });
    expect(remote.bluewealth).not.toHaveBeenCalled();
  });
});

describe("agentsByCode and KingClub's agents", () => {
  it("answers KingClub's row in place of the one left in UnitClub's closed room", async () => {
    db.on("agents", { data: [LEFT_IN_UNITCLUB] });
    remote.kingclub.mockResolvedValue({ data: [AT_KINGCLUB], error: null });
    const [found] = await agentsByCode("731204");
    expect(found.system).toBe("kingclub");
    expect(found.tenant?.status).toBe("active");
  });

  it("keeps UnitClub's row when KingClub gave the agent another code", async () => {
    db.on("agents", { data: [LEFT_IN_UNITCLUB] });
    remote.kingclub.mockResolvedValue({ data: [{ ...AT_KINGCLUB, agent_code: "999999" }], error: null });
    const [found] = await agentsByCode("731204");
    expect(found.system).toBeUndefined();
  });

  it("finds a code UnitClub and Bluewealth do not hold at KingClub", async () => {
    db.on("agents", { data: [] });
    remote.kingclub.mockResolvedValue({ data: [{ ...AT_KINGCLUB, id: "k2", agent_code: "555123" }], error: null });
    const [found] = await agentsByCode("555123");
    expect(found).toMatchObject({ id: "k2", system: "kingclub" });
  });
});

describe("remembering KingClub's agents", () => {
  it("keeps the name, code and room for the back office, and its name wins over UnitClub's old one", async () => {
    await kc.rememberKingclubAgent({ ...AT_KINGCLUB, name: "เก่ง ใหม่", system: "kingclub" });
    const [write] = db.writes("ins_kingclub_agents", "upsert");
    expect(write[0].args[0]).toMatchObject({ id: "k1", agent_code: "731204", name: "เก่ง ใหม่", tenant_id: "9f35fe97", tenant_name: "KingClub" });

    db.on("agents", { data: [{ id: "k1", name: "เก่ง", agent_code: "731204" }] });
    db.on("ins_kingclub_agents", { data: [{ id: "k1", name: "เก่ง ใหม่", agent_code: "731204" }] });
    expect(await displayNames(["k1"])).toEqual({ k1: "เก่ง ใหม่" });
  });

  it("never throws: a name not written must not undo a sign-in", async () => {
    db.on("ins_kingclub_agents", { error: { message: "down" } });
    await expect(kc.rememberKingclubAgent(AT_KINGCLUB)).resolves.toBeUndefined();
  });
});
