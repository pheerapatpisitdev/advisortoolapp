import { beforeEach, describe, expect, it, vi } from "vitest";

/** The planning calendar's reads and writes, within the asker's own pieces (owner, 2026-09-30). */

const db = vi.hoisted(() => {
  const calls: unknown[][] = [];
  const answer = { value: { data: [] as unknown, error: null } };
  /** a PostgREST query that writes down every step and answers `answer.value` when awaited */
  const query = (): unknown => {
    const q: unknown = new Proxy({}, {
      get: (_t, key) => key === "then"
        ? (resolve: (v: unknown) => void) => resolve(answer.value)
        : (...args: unknown[]) => { calls.push([key, ...args]); return q; },
    });
    return q;
  };
  return { calls, answer, query };
});
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: () => db.query() }) }));
vi.mock("@/lib/auth/scope", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/scope")>()),
  currentScope: async () => ({ agents: ["a1"], unowned: false, pages: [], owner: null }),
}));

const { listPlanned, listUnplanned, setPlan, setPlanDone } = await import("@/lib/content/store");

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const row = { id: ID, agent_id: "a1", page_id: null, output: { hooks: ["หัว"] }, flags: {}, status: "draft", plan_day: "2026-10-01", planned_done_at: null };

beforeEach(() => {
  db.calls.length = 0;
  db.answer.value = { data: [row], error: null };
});
const has = (...call: unknown[]) => db.calls.some((c) => JSON.stringify(c) === JSON.stringify(call));
/** the workbench's own "not on a Facebook Page" filter (store.ts offPage) */
const offPage = () => db.calls.some((c) => c[0] === "or" && String(c[1]).startsWith("publish_state.is.null,publish_state.not.in."));

describe("the planned pieces of a month", () => {
  it("are the asker's own, still in รอตรวจ or ใช้จริง, between the grid's first and last day", async () => {
    const items = await listPlanned("2026-09-28", "2026-11-01");
    expect(has("gte", "plan_day", "2026-09-28")).toBe(true);
    expect(has("lte", "plan_day", "2026-11-01")).toBe(true);
    expect(has("in", "status", ["draft", "used"])).toBe(true);
    expect(has("or", "and(page_id.is.null,or(agent_id.in.(a1)))")).toBe(true);
    expect(items[0].plan).toEqual({ day: "2026-10-01", doneAt: null });
  });

  it("leave the rail only the pieces with no day", async () => {
    await listUnplanned();
    expect(has("is", "plan_day", null)).toBe(true);
    expect(has("in", "status", ["draft", "used"])).toBe(true);
    expect(has("or", "and(page_id.is.null,or(agent_id.in.(a1)))")).toBe(true);
  });
});

describe("ad pieces (Ads Studio campaigns, 2026-10-04)", () => {
  it("are left out of the plan's grid and of its rail", async () => {
    await listPlanned("2026-09-28", "2026-11-01");
    expect(has("neq", "format", "ad")).toBe(true);
    db.calls.length = 0;
    await listUnplanned();
    expect(has("neq", "format", "ad")).toBe(true);
  });
});

describe("pieces on a Facebook Page (final review, 2026-09-30)", () => {
  it("are kept off the plan and its rail, as off the workbench's lists", async () => {
    await listPlanned("2026-09-28", "2026-11-01");
    expect(offPage()).toBe(true);
    db.calls.length = 0;
    await listUnplanned();
    expect(offPage()).toBe(true);
  });
});

describe("putting a piece on a day", () => {
  it("sets the day and forgets it was posted, so a move is planned anew", async () => {
    db.answer.value = { data: row, error: null };
    await setPlan(ID, "2026-10-02");
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ plan_day: "2026-10-02", planned_done_at: null });
  });

  it("takes it off the plan", async () => {
    db.answer.value = { data: { ...row, plan_day: null }, error: null };
    await setPlan(ID, null);
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ plan_day: null, planned_done_at: null });
  });

  it("marks it posted, and unmarks it", async () => {
    db.answer.value = { data: { ...row, planned_done_at: "2026-09-30T10:00:00Z" }, error: null };
    expect((await setPlanDone(ID, true)).plan?.doneAt).toBe("2026-09-30T10:00:00Z");
    const set = db.calls.find((c) => c[0] === "update")?.[1] as { planned_done_at: string | null };
    expect(typeof set.planned_done_at).toBe("string");
    db.calls.length = 0;
    await setPlanDone(ID, false);
    expect(db.calls.find((c) => c[0] === "update")?.[1]).toEqual({ planned_done_at: null });
  });
});
