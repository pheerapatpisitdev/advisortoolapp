import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Another agent's words stay theirs (review, 2026-10-01): the formula library is shared, but the
 * hook a formula was drawn from is shown only to whoever may see its piece; the planner's "do not
 * repeat" list and the people library's usage count read only the asker's own pieces.
 */

const db = vi.hoisted(() => {
  const calls: { table: string; step: unknown[] }[] = [];
  const answers: Record<string, { data: unknown; error: unknown }> = {};
  /** a PostgREST query on `table` that writes down every step and answers that table's answer when awaited */
  const query = (table: string): unknown => {
    const q: unknown = new Proxy({}, {
      get: (_t, key) => key === "then"
        ? (resolve: (v: unknown) => void) => resolve(answers[table] ?? { data: [], error: null })
        : (...args: unknown[]) => { calls.push({ table, step: [key, ...args] }); return q; },
    });
    return q;
  };
  return { calls, answers, query };
});
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => db.query(table),
    storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({ error: null }) }) },
  }),
}));
// an ordinary agent: their own pieces, and those of the one Page they look after
vi.mock("@/lib/auth/scope", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/scope")>()),
  currentScope: async () => ({ agents: ["a1"], unowned: false, pages: ["p1"], owner: { agentId: "a1", tenantId: "t1" } }),
}));

const { deleteContent, getHookTemplate, listHookTemplates, piecesWithPerson, recentHooks, usedHooks } = await import("@/lib/content/store");

const template = (id: string, source: string | null, example: string | null = `hook of ${id}`) => ({
  id, category: "CLAIM", template: `สูตร ${id} [ช่อง]`, example_hook: example, source_content_id: source, use_count: 0, seed: false, created_at: "2026-09-30T00:00:00Z",
});

beforeEach(() => {
  db.calls.length = 0;
  for (const k of Object.keys(db.answers)) delete db.answers[k];
});

describe("the formula library's examples", () => {
  it("are shown to whoever may see the piece they came from, and to nobody else", async () => {
    db.answers.ins_hook_templates = {
      data: [
        template("mine", "c-mine"), template("theirs", "c-theirs"), template("page", "c-page"),
        template("other-page", "c-other-page"), template("orphan", null), { ...template("seed", null, null), seed: true },
      ],
      error: null,
    };
    db.answers.ins_content = {
      data: [
        { id: "c-mine", agent_id: "a1", page_id: null },
        { id: "c-theirs", agent_id: "a2", page_id: null },
        { id: "c-page", agent_id: "a2", page_id: "p1" },
        { id: "c-other-page", agent_id: "a1", page_id: "p9" },
      ],
      error: null,
    };
    const shown = Object.fromEntries((await listHookTemplates()).map((t) => [t.id, t.exampleHook]));
    expect(shown).toEqual({
      mine: "hook of mine",
      // another agent's own piece: the formula is theirs to share, the words are not
      theirs: null,
      // a piece of the Page the asker looks after: they may open it, so they may see its hook
      page: "hook of page",
      // a Page they do not look after, whoever wrote it
      "other-page": null,
      // the piece is gone: nobody is left to show it to
      orphan: null,
      seed: null,
    });
    // the formulas themselves are everybody's
    expect(Object.keys(shown)).toHaveLength(6);
    // only the sources with an example were asked about
    const asked = db.calls.find((c) => c.table === "ins_content" && c.step[0] === "in");
    expect(asked?.step).toEqual(["in", "id", ["c-mine", "c-theirs", "c-page", "c-other-page"]]);
  });

  it("are all left out, and the library still shown, when the pieces cannot be looked up", async () => {
    db.answers.ins_hook_templates = { data: [template("mine", "c-mine")], error: null };
    db.answers.ins_content = { data: null, error: { message: "db down" } };
    const list = await listHookTemplates();
    expect(list.map((t) => [t.id, t.exampleHook])).toEqual([["mine", null]]);
  });

  it("are left out of a single formula too", async () => {
    db.answers.ins_hook_templates = { data: template("theirs", "c-theirs"), error: null };
    db.answers.ins_content = { data: [{ id: "c-theirs", agent_id: "a2", page_id: null }], error: null };
    expect((await getHookTemplate("theirs"))?.exampleHook).toBeNull();
    db.answers.ins_content = { data: [{ id: "c-theirs", agent_id: "a1", page_id: null }], error: null };
    expect((await getHookTemplate("theirs"))?.exampleHook).toBe("hook of theirs");
  });

  it("go with the piece when it is deleted", async () => {
    await deleteContent("c-mine");
    const cleared = db.calls.filter((c) => c.table === "ins_hook_templates").map((c) => c.step);
    expect(cleared).toEqual([["update", { example_hook: null }], ["eq", "source_content_id", "c-mine"]]);
  });
});

describe("the asker's own pieces only", () => {
  const scoped = (table = "ins_content") => db.calls.filter((c) => c.table === table && c.step[0] === "or").map((c) => c.step[1]);
  const RULE = "page_id.in.(p1),and(page_id.is.null,or(agent_id.in.(a1)))";

  it("are the hooks the planner is told not to repeat", async () => {
    db.answers.ins_content = { data: [{ output: { hooks: ["ของฉัน"] } }], error: null };
    expect(await usedHooks()).toEqual(["ของฉัน"]);
    expect(scoped()).toEqual([RULE]);
  });

  it("are the openings a round is told not to repeat, of its kind on its Page, whatever became of them", async () => {
    db.answers.ins_content = { data: [{ output: { hooks: ["คำคมเดิม"] } }], error: null };
    expect(await recentHooks("saying", "p1")).toEqual(["คำคมเดิม"]);
    expect(scoped()).toEqual([RULE]);
    const steps = db.calls.filter((c) => c.table === "ins_content").map((c) => c.step);
    expect(steps).toContainEqual(["eq", "plan_href", "saying"]);
    expect(steps).toContainEqual(["eq", "page_id", "p1"]);
    expect(steps.some((s) => s[0] === "eq" && s[1] === "status")).toBe(false);
  });

  it("are what a person's usage counts", async () => {
    db.answers.ins_content = { data: [{ publish_state: "published" }, { publish_state: null }], error: null };
    expect(await piecesWithPerson("person-1")).toEqual({ total: 2, onPage: 1 });
    expect(scoped()).toEqual([RULE]);
  });
});
