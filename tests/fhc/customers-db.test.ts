import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two writes added after the review (2026-10-22): a save of the same name within a minute
 * gives back the row already there, and a corrected check replaces the saved one only for the
 * agent who owns it.
 */
const db = vi.hoisted(() => {
  const calls: { op: string; args: unknown[] }[] = [];
  let recent: { id: string }[] = [];
  let updated: { id: string }[] = [];
  const chain = (op: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "limit", "insert", "update", "single"]) {
      q[m] = (...args: unknown[]) => { calls.push({ op: `${op}.${m}`, args }); return q; };
    }
    q.then = (ok: (v: unknown) => void) =>
      ok(op === "update" ? { data: updated, error: null } : op === "insert" ? { data: { id: "new-id" }, error: null } : { data: recent, error: null });
    return q;
  };
  return {
    calls,
    set: (r: { id: string }[], u: { id: string }[] = []) => { recent = r; updated = u; },
    client: {
      from: () => ({
        select: (...a: unknown[]) => { calls.push({ op: "read.select", args: a }); return chain("read"); },
        insert: (...a: unknown[]) => { calls.push({ op: "insert", args: a }); return chain("insert"); },
        update: (...a: unknown[]) => { calls.push({ op: "update", args: a }); return chain("update"); },
      }),
    },
  };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => db.client }));

const { saveCustomer, updateCustomerCheck } = await import("@/lib/fhc/customers");
const { cleanFhc } = await import("@/lib/fhc/health");

const AGENT = "11111111-1111-4111-8111-111111111111";
const viewer = { agentId: AGENT } as never;
const form = cleanFhc({ age: 38, sex: "M", income: 58_000, expense: 40_000 }) as never;
const snapshot = { figures: {}, scores: [], events: [], plan: { areas: [], order: ["life"] } } as never;
const ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => { db.calls.length = 0; db.set([]); });

describe("saveCustomer", () => {
  it("adds a row when this agent has not just saved the name", async () => {
    expect(await saveCustomer(viewer, { name: "สมชาย ใจดี", contact: "", note: "" }, form, snapshot)).toBe("new-id");
    expect(db.calls.some((c) => c.op === "insert")).toBe(true);
  });

  it("gives back the row saved under the same name a moment ago, adding nothing", async () => {
    db.set([{ id: "first-id" }]);
    expect(await saveCustomer(viewer, { name: "สมชาย ใจดี", contact: "", note: "" }, form, snapshot)).toBe("first-id");
    expect(db.calls.some((c) => c.op === "insert")).toBe(false);
    expect(db.calls).toContainEqual({ op: "read.eq", args: ["agent_id", AGENT] });
    expect(db.calls).toContainEqual({ op: "read.eq", args: ["name", "สมชาย ใจดี"] });
  });
});

describe("updateCustomerCheck", () => {
  it("replaces the check, stamps the day, and keeps to the agent's own row", async () => {
    db.set([], [{ id: ID }]);
    expect(await updateCustomerCheck(viewer, ID, false, form, snapshot)).toBe(true);
    const set = db.calls.find((c) => c.op === "update")!.args[0] as Record<string, unknown>;
    expect(Object.keys(set).sort()).toEqual(["age", "first_area", "gaps", "input", "sex", "snapshot"]);
    expect((set.snapshot as { updatedAt?: string }).updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(db.calls).toContainEqual({ op: "update.eq", args: ["agent_id", AGENT] });
  });

  it("lets the owner correct any agent's row", async () => {
    db.set([], [{ id: ID }]);
    await updateCustomerCheck(viewer, ID, true, form, snapshot);
    expect(db.calls.some((c) => c.op === "update.eq" && c.args[0] === "agent_id")).toBe(false);
  });

  it("says no for another agent's row or a malformed id", async () => {
    db.set([], []);
    expect(await updateCustomerCheck(viewer, ID, false, form, snapshot)).toBe(false);
    expect(await updateCustomerCheck(viewer, "not-an-id", false, form, snapshot)).toBe(false);
  });
});
