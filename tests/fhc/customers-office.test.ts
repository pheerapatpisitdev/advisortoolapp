import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An office's admins and managers see their office's FHC customers, view only (owner,
 * 2026-11-09, mockup WjpC1vZN2AW9SB8KCHXhwk 1ก 2ก).
 */
const ROOM_G = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROOM_K = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD = "11111111-1111-4111-8111-111111111111";
const BILL = "22222222-2222-4222-8222-222222222222"; // 83G
const JOKE = "33333333-3333-4333-8333-333333333333"; // KingClub
const MEMBER = "44444444-4444-4444-8444-444444444444"; // Google member, no room
const CUST = "55555555-5555-4555-8555-555555555555";

const db = vi.hoisted(() => {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const results: Record<string, unknown> = {};
  const from = (table: string) => {
    const q: Record<string, unknown> = {};
    let first = "";
    for (const m of ["select", "eq", "in", "order", "limit", "maybeSingle"]) {
      q[m] = (...args: unknown[]) => {
        if (!first) first = String(args[0]);
        calls.push({ table, op: m, args });
        return q;
      };
    }
    q.then = (ok: (v: unknown) => void) => ok({ data: results[`${table}|${first}`] ?? results[table] ?? [], error: null });
    return q;
  };
  return { calls, results, client: { from } };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db.client }));

const { getCustomer, inRoom, isRoomLead, listCustomers } = await import("@/lib/fhc/customers");

const lead = { agentId: LEAD, tenantId: ROOM_G, roomLead: true } as never;
const agent = { agentId: BILL, tenantId: ROOM_G } as never;
const row = (agentId: string) => ({
  id: CUST, agent_id: agentId, created_at: "2026-11-05T00:00:00Z", name: "ตะวัน", contact: "", note: "", age: 30, sex: "F",
  gaps: [], first_area: null, kind: "fhc", meet_date: null, meet_time: null, top: null, snapshot: {}, input: {},
});

beforeEach(() => {
  db.calls.length = 0;
  for (const k of Object.keys(db.results)) delete db.results[k];
  db.results["ins_fhc_customers|agent_id"] = [{ agent_id: BILL }, { agent_id: BILL }, { agent_id: JOKE }, { agent_id: MEMBER }];
  db.results.agents = [
    { id: BILL, tenant: { id: ROOM_G, slug: "83g", name: "Krungthai-AXA Life 83G" } },
    { id: JOKE, tenant: { id: ROOM_K, slug: "kc", name: "Krungthai-AXA Life KingClub" } },
  ];
  db.results.ins_bluewealth_agents = [];
});

describe("inRoom", () => {
  it("keeps only the agents of this room, once each", () => {
    const rooms = new Map([[BILL, { id: ROOM_G }], [JOKE, { id: ROOM_K }]]);
    expect(inRoom(rooms, [BILL, JOKE, BILL, MEMBER], ROOM_G)).toEqual([BILL]);
  });
});

describe("isRoomLead", () => {
  it("needs the mark and a room", () => {
    expect(isRoomLead(lead)).toBe(true);
    expect(isRoomLead(agent)).toBe(false);
    expect(isRoomLead({ agentId: MEMBER, tenantId: null, roomLead: true } as never)).toBe(false);
  });
});

describe("listCustomers office", () => {
  it("lists the lead's own room's agents and the lead, never another office or a member", async () => {
    await listCustomers(lead, "office");
    const filter = db.calls.find((c) => c.table === "ins_fhc_customers" && c.op === "in");
    expect(filter?.args[0]).toBe("agent_id");
    expect((filter?.args[1] as string[]).sort()).toEqual([BILL, LEAD].sort());
  });

  it("gives an agent who is not a lead their own list only", async () => {
    await listCustomers(agent, "office");
    expect(db.calls).toContainEqual({ table: "ins_fhc_customers", op: "eq", args: ["agent_id", BILL] });
    expect(db.calls.some((c) => c.op === "in")).toBe(false);
  });
});

describe("getCustomer for a lead", () => {
  it("opens an office agent's customer view only", async () => {
    db.results.ins_fhc_customers = row(BILL);
    expect((await getCustomer(lead, CUST, false, true))?.readOnly).toBe(true);
  });

  it("refuses another office's customer", async () => {
    db.results.ins_fhc_customers = row(JOKE);
    expect(await getCustomer(lead, CUST, false, true)).toBeNull();
  });

  it("refuses when the caller did not ask for office reading (the video maker, edits)", async () => {
    db.results.ins_fhc_customers = row(BILL);
    expect(await getCustomer(lead, CUST, false)).toBeNull();
  });

  it("leaves the lead's own customer editable", async () => {
    db.results.ins_fhc_customers = row(LEAD);
    expect((await getCustomer(lead, CUST, false, true))?.readOnly).toBe(false);
  });
});
