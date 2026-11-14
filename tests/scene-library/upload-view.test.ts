import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadRow } from "@/lib/scene-library/upload-rules";

/** uploadViews: what the page may hold of the three lists (no agentId; `by` only on the owner's waiting) */
const store = vi.hoisted(() => ({
  mine: [] as UploadRow[], shared: [] as UploadRow[], waiting: [] as UploadRow[], fail: false, namesFail: false,
  nameCalls: [] as string[][],
  namesOf: null as null | ((ids: string[]) => Record<string, string>),
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
/** the strict lookups senderGone makes: a row, nobody (null), or a failed read (an Error, thrown) */
const people = vi.hoisted(() => ({ agent: null as unknown, member: null as unknown, superAdmin: null as unknown, bluewealth: null as unknown, kingclub: null as unknown, asked: [] as string[] }));
const look = (name: string, v: unknown) => { people.asked.push(name); if (v instanceof Error) throw v; return v; };
vi.mock("@/lib/auth/bluewealth", () => ({ bluewealthConfigured: () => true, bluewealthAgentById: async () => look("bluewealth", people.bluewealth) }));
vi.mock("@/lib/auth/kingclub", () => ({ kingclubConfigured: () => true, kingclubAgentById: async () => look("kingclub", people.kingclub) }));
vi.mock("@/lib/auth/viewer", () => ({
  agentById: async (id: string) => look(`agent ${id.slice(-2)}`, people.agent),
  memberById: async () => look("member", people.member),
  superAdminById: async () => look("super", people.superAdmin),
  displayNames: async (ids: string[]) => {
    store.nameCalls.push(ids);
    if (store.namesFail) throw new Error("names down");
    if (store.namesOf) return store.namesOf(ids);
    return Object.fromEntries(ids.map((i) => [i, `ชื่อของ ${i.slice(-2)}`]));
  },
}));

import { uploadViews } from "@/lib/scene-library/uploads";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const row = (o: Partial<UploadRow>): UploadRow => ({
  id: crypto.randomUUID(), agentId: A, kind: "part", name: "ตะกร้า", note: "n", paths: ["library/a.png"], state: "wait", reason: null, createdAt: "2026-11-14T00:00:00Z", ...o,
});

beforeEach(() => {
  store.mine = []; store.shared = []; store.waiting = []; store.fail = false; store.namesFail = false; store.nameCalls = []; store.namesOf = null;
  // by default every sender is a live UnitClub agent
  Object.assign(people, { agent: { id: "x" }, member: null, superAdmin: null, bluewealth: null, kingclub: null, asked: [] });
});
afterEach(() => { vi.restoreAllMocks(); });

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

  it("the owner's waiting and in-library rows carry the sender's name, mine none", async () => {
    store.waiting = [row({ agentId: B })];
    store.shared = [row({ agentId: B, state: "ok" })];
    store.mine = [row({ agentId: A })];
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.waiting[0].by).toBe("ชื่อของ 0b");
    expect(v.shared[0].by).toBe("ชื่อของ 0b");
    expect(v.mine[0].by).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain(B);
  });

  const GONE = "00000000-0000-4000-8000-0000000000dd";
  it("an unnamed sender the strict lookups find nowhere is สมาชิกที่ลบบัญชีแล้ว", async () => {
    store.shared = [row({ agentId: GONE, state: "ok" }), row({ agentId: B, state: "ok" })];
    store.namesOf = (ids) => Object.fromEntries(ids.filter((i) => i !== GONE).map((i) => [i, `ชื่อของ ${i.slice(-2)}`]));
    people.agent = null;
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.shared.map((s) => s.by)).toEqual(["สมาชิกที่ลบบัญชีแล้ว", "ชื่อของ 0b"]);
    expect(JSON.stringify(v)).not.toContain(GONE);
    // only the unnamed id is looked up
    expect(people.asked).toContain("agent dd");
    expect(people.asked).not.toContain("agent 0b");
  });

  it("a displayNames that swallowed a failed read (no name for a live sender) says สมาชิก, not deleted", async () => {
    store.shared = [row({ agentId: B, state: "ok" })];
    store.namesOf = () => ({});
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.shared[0].by).toBe("สมาชิก");
  });

  it("an outside agent with no remembered name, still found at KingClub or Bluewealth, says สมาชิก", async () => {
    for (const k of ["kingclub", "bluewealth"] as const) {
      Object.assign(people, { agent: null, kingclub: null, bluewealth: null });
      people[k] = { id: B };
      store.shared = [row({ agentId: B, state: "ok" })];
      store.namesOf = () => ({});
      expect((await uploadViews({ agentId: A, owner: true }))!.shared[0].by, k).toBe("สมาชิก");
    }
  });

  it("a strict lookup that fails says สมาชิก", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.shared = [row({ agentId: B, state: "ok" })];
    store.namesOf = () => ({});
    people.agent = new Error("agents unreadable");
    expect((await uploadViews({ agentId: A, owner: true }))!.shared[0].by).toBe("สมาชิก");
  });

  it("each unnamed sender is looked up once, however many files", async () => {
    store.shared = [row({ agentId: GONE, state: "ok" }), row({ agentId: GONE, state: "ok", kind: "style" })];
    store.namesOf = () => ({});
    people.agent = null;
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.shared.map((s) => s.by)).toEqual(["สมาชิกที่ลบบัญชีแล้ว", "สมาชิกที่ลบบัญชีแล้ว"]);
    expect(people.asked.filter((x) => x === "agent dd")).toHaveLength(1);
  });

  it("nobody but the owner gets a name on the in-library rows, and none is looked up", async () => {
    store.shared = [row({ agentId: B, state: "ok" })];
    const v = (await uploadViews({ agentId: A, owner: false }))!;
    expect(v.shared[0].by).toBeUndefined();
    expect(store.nameCalls).toEqual([]);
    expect(people.asked).toEqual([]);
  });

  it("still answers when only the names cannot be read", async () => {
    store.namesFail = true;
    store.waiting = [row({ agentId: B })];
    store.shared = [row({ agentId: B, state: "ok" })];
    const v = (await uploadViews({ agentId: A, owner: true }))!;
    expect(v.waiting).toHaveLength(1);
    expect(v.waiting[0].by).toBeUndefined();
    // a failed read is not a deleted account: the sender is still found, so สมาชิก
    expect(v.shared[0].by).toBe("สมาชิก");
  });

  it("answers null when the store throws", async () => {
    store.fail = true;
    const said = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await uploadViews({ agentId: A, owner: true })).toBeNull();
      expect(said).toHaveBeenCalled();
    } finally {
      said.mockRestore();
    }
  });
});
