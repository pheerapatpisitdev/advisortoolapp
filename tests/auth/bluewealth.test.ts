import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bluewealth's agents (owner, 2026-10-24): read live from Bluewealth's own copy of UnitOS through
 * its one lookup function, and let in by the same gate as UnitOS's agents — Bluewealth's Console
 * switch set aside, the Super Admin's switch in its place.
 */

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
const rpc = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ rpc })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db } from "../helpers/fake-db";
import { admit, type AgentRow } from "@/lib/auth/access";
const bw = await import("@/lib/auth/bluewealth");

const ROW: AgentRow = {
  id: "b1", agent_code: "482913", name: "สมชาย", unit: "หน่วยสาทร",
  role: "member", is_admin: false, member_tier: "premium", membership_expires_at: null, created_at: "2026-09-01T00:00:00Z",
  tenant: {
    id: "tb", slug: "bluewealth", name: "Bluewealth", status: "active", key_epoch: null,
    config: { features: { adStudio: false }, premiumOnly: ["lms", "portfolio"] },
  },
};

const ENV = { BLUEWEALTH_SUPABASE_URL: "https://bw.supabase.co", BLUEWEALTH_ANON_KEY: "anon", BLUEWEALTH_LOOKUP_KEY: "secret" };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

describe("asGateRow", () => {
  it("sets Bluewealth's Console switch aside, so an open room lets its agents in as UnitOS's", () => {
    expect(admit(ROW, null, Date.now())).toBeNull();
    const row = bw.asGateRow(ROW, true);
    expect(row.system).toBe("bluewealth");
    expect(row.tenant?.config?.features).toEqual({});
    expect(admit(row, null, Date.now())).toMatchObject({ kind: "unitos", agentId: "b1", tenantName: "Bluewealth", staff: null });
  });

  it("closes every Bluewealth room while the Super Admin's switch is off", () => {
    expect(admit(bw.asGateRow(ROW, false), null, Date.now())).toBeNull();
  });

  it("still keeps out a room Bluewealth itself suspended", () => {
    const suspended = { ...ROW, tenant: { ...ROW.tenant!, status: "suspended" } };
    expect(admit(bw.asGateRow(suspended, true), null, Date.now())).toBeNull();
  });
});

describe("bluewealthOpenOf", () => {
  it("is open unless closed in so many words", () => {
    expect(bw.bluewealthOpenOf(null)).toBe(true);
    expect(bw.bluewealthOpenOf({ clipFx: { for: "all" } })).toBe(true);
    expect(bw.bluewealthOpenOf({ bluewealth: { open: true } })).toBe(true);
    expect(bw.bluewealthOpenOf({ bluewealth: { open: false } })).toBe(false);
  });
});

describe("looking Bluewealth's agents up", () => {
  it("finds nobody, and asks nobody, until the keys are set", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("BLUEWEALTH_LOOKUP_KEY", "");
    expect(bw.bluewealthConfigured()).toBe(false);
    expect(await bw.bluewealthAgentsByCode("482913")).toEqual([]);
    expect(await bw.bluewealthAgentById("b1")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("asks with the publishable key and the lookup key, and reads the switch only when somebody is found", async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null });
    db.on("ins_ai_settings", { data: { feature_switches: { bluewealth: { open: false } } } });
    const [found] = await bw.bluewealthAgentsByCode("482913");
    expect(createClient).toHaveBeenCalledWith("https://bw.supabase.co", "anon", expect.anything());
    expect(rpc).toHaveBeenCalledWith("advisortool_agents", { p_key: "secret", p_code: "482913" });
    expect(found.system).toBe("bluewealth");
    expect(admit(found, null, Date.now())).toBeNull();

    rpc.mockResolvedValue({ data: [], error: null });
    db.reset();
    expect(await bw.bluewealthAgentById("b9")).toBeNull();
    expect(rpc).toHaveBeenLastCalledWith("advisortool_agents", { p_key: "secret", p_id: "b9" });
    expect(db.log.some((l) => l.table === "ins_ai_settings")).toBe(false);
  });

  it("throws when Bluewealth cannot be read, rather than letting anybody in", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not allowed" } });
    await expect(bw.bluewealthAgentsByCode("482913")).rejects.toThrow("not allowed");
  });
});

describe("rememberBluewealthAgent", () => {
  it("keeps the name, code, หน่วย and room for the back office", async () => {
    await bw.rememberBluewealthAgent(bw.asGateRow(ROW, true));
    const [write] = db.writes("ins_bluewealth_agents", "upsert");
    expect(write[0].args[0]).toMatchObject({ id: "b1", agent_code: "482913", name: "สมชาย", unit: "หน่วยสาทร", tenant_id: "tb", tenant_name: "Bluewealth" });
  });

  it("never throws: a name not written must not undo a sign-in", async () => {
    db.on("ins_bluewealth_agents", { error: { message: "down" } });
    await expect(bw.rememberBluewealthAgent(ROW)).resolves.toBeUndefined();
  });
});
