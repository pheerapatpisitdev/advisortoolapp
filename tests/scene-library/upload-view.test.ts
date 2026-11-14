import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadRow } from "@/lib/scene-library/upload-rules";

/** uploadViews: what the page may hold of the three lists (no agentId; `by` only on the owner's waiting) */
const store = vi.hoisted(() => ({
  mine: [] as UploadRow[], shared: [] as UploadRow[], waiting: [] as UploadRow[], fail: false, namesFail: false,
  nameCalls: [] as string[][],
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
              const rows = eq("agent_id") ? store.mine : eq("state") === "ok" ? store.shared : store.waiting;
              return Promise.resolve({ data: (rows as UploadRow[]).map(dbRow), error: null }).then(ok, bad);
            };
          }
          return (...args: unknown[]) => { steps.push({ method: String(method), args }); return chain; };
        },
      });
      return chain;
    },
  }),
}));
vi.mock("@/lib/auth/viewer", () => ({
  displayNames: async (ids: string[]) => {
    store.nameCalls.push(ids);
    if (store.namesFail) throw new Error("names down");
    return Object.fromEntries(ids.map((i) => [i, `ชื่อของ ${i.slice(-2)}`]));
  },
}));

import { uploadViews } from "@/lib/scene-library/uploads";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const row = (o: Partial<UploadRow>): UploadRow => ({
  id: crypto.randomUUID(), agentId: A, kind: "part", name: "ตะกร้า", note: "n", paths: ["library/a.png"], state: "wait", reason: null, createdAt: "2026-11-14T00:00:00Z", ...o,
});

beforeEach(() => { store.mine = []; store.shared = []; store.waiting = []; store.fail = false; store.namesFail = false; store.nameCalls = []; });

describe("uploadViews", () => {
  it("never carries an agentId, and counts the files", async () => {
    store.mine = [row({ paths: ["a", "b"], kind: "ask" })];
    store.shared = [row({ agentId: B, state: "ok" })];
    const v = (await uploadViews({ agentId: A, owner: false }))!;
    expect(JSON.stringify(v)).not.toContain(B);
    expect(JSON.stringify(v)).not.toContain("agentId");
    expect(v.mine[0].files).toBe(2);
    expect(v.mine[0].mine).toBe(true);
    expect(v.shared[0].mine).toBe(false);
  });

  it("an agent's waiting list is empty, and no name is looked up", async () => {
    store.waiting = [row({ agentId: B })];
    const v = (await uploadViews({ agentId: A, owner: false }))!;
    expect(v.waiting).toEqual([]);
    expect(store.nameCalls).toEqual([]);
  });

  it("the owner's waiting rows carry the sender's name, the other lists none", async () => {
    store.waiting = [row({ agentId: B })];
    store.shared = [row({ agentId: B, state: "ok" })];
    store.mine = [row({ agentId: A })];
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.waiting[0].by).toBe("ชื่อของ 0b");
    expect(v.shared[0].by).toBeUndefined();
    expect(v.mine[0].by).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain(B);
  });

  it("still answers when only the names cannot be read", async () => {
    store.namesFail = true;
    store.waiting = [row({ agentId: B })];
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.waiting).toHaveLength(1);
    expect(v.waiting[0].by).toBeUndefined();
  });

  it("answers null when the store throws", async () => {
    store.fail = true;
    expect(await uploadViews({ agentId: A, owner: true })).toBeNull();
  });
});
