import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadRow } from "@/lib/scene-library/upload-rules";

/**
 * uploadViews: what the owner's page holds (spec 2026-11-14-library-owner-only-design.md): mine = the owner's
 * own rows, shared = the ok ones, no queue, and nobody looked up by name.
 */
const store = vi.hoisted(() => ({
  mine: [] as UploadRow[], shared: [] as UploadRow[], waiting: [] as UploadRow[], fail: false,
  asked: [] as string[],
}));
/** the table answers by the filter each list asks with: agent_id = mine, state ok = shared, state wait = waiting */
const dbRow = (r: UploadRow) => ({ id: r.id, agent_id: r.agentId, kind: r.kind, name: r.name, note: r.note, paths: r.paths, state: r.state, reason: r.reason, created_at: r.createdAt });
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const steps: { method: string; args: unknown[] }[] = [];
      const chain: object = new Proxy({}, {
        get(_t, method) {
          if (method === "then") {
            return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
              if (store.fail) return Promise.resolve({ data: null, error: { message: "relation does not exist" } }).then(ok, bad);
              const eq = (k: string) => steps.find((s) => s.method === "eq" && s.args[0] === k)?.args[1];
              const list = eq("agent_id") ? "mine" : eq("state") === "ok" ? "shared" : "waiting";
              store.asked.push(list);
              return Promise.resolve({ data: (store[list] as UploadRow[]).map(dbRow), error: null }).then(ok, bad);
            };
          }
          return (...args: unknown[]) => { steps.push({ method: String(method), args }); return chain; };
        },
      });
      return chain;
    },
  }),
}));
const looked = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/auth/viewer", () => ({
  displayNames: async () => { looked.push("names"); return {}; },
  agentById: async () => { looked.push("agent"); return null; },
  memberById: async () => { looked.push("member"); return null; },
  superAdminById: async () => { looked.push("super"); return null; },
}));

import { uploadViews } from "@/lib/scene-library/uploads";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const row = (o: Partial<UploadRow>): UploadRow => ({
  id: crypto.randomUUID(), agentId: A, kind: "part", name: "ตะกร้า", note: "n", paths: ["library/a.png"], state: "ok", reason: null, createdAt: "2026-11-14T00:00:00Z", ...o,
});

beforeEach(() => {
  store.mine = []; store.shared = []; store.waiting = []; store.fail = false; store.asked = [];
  looked.length = 0;
});
afterEach(() => { vi.restoreAllMocks(); });

describe("uploadViews", () => {
  it("mine is every own row, shared the ok ones; never an agentId; the files counted", async () => {
    store.mine = [row({ paths: ["a", "b"] }), row({ state: "gone" })];
    store.shared = [row({ state: "ok" }), row({ agentId: B, state: "ok" })];
    const v = (await uploadViews({ agentId: A }))!;
    expect(v.mine.map((m) => m.state)).toEqual(["ok", "gone"]);
    expect(v.mine[0].files).toBe(2);
    expect(v.mine[0].mine).toBe(true);
    expect(v.shared.map((s) => s.mine)).toEqual([true, false]);
    expect(JSON.stringify(v)).not.toContain(B);
    expect(JSON.stringify(v)).not.toContain("agentId");
  });

  it("has no queue: waiting is empty and never read", async () => {
    store.waiting = [row({ agentId: B, state: "wait" })];
    const v = (await uploadViews({ agentId: A }))!;
    expect(v.waiting).toEqual([]);
    expect(store.asked.sort()).toEqual(["mine", "shared"]);
  });

  it("looks nobody up and names nobody", async () => {
    store.shared = [row({ agentId: B, state: "ok" })];
    const v = (await uploadViews({ agentId: A }))!;
    expect(looked).toEqual([]);
    expect(v.shared[0]).not.toHaveProperty("by");
  });

  it("answers null when the store throws", async () => {
    store.fail = true;
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await uploadViews({ agentId: A })).toBeNull();
    expect(said).toHaveBeenCalled();
  });
});
