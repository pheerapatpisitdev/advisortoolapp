import { beforeEach, describe, expect, it, vi } from "vitest";

/** The workbench's lists, its counts and the calendar's rail keep to one Page's project (owner, 2026-09-30). */

const db = vi.hoisted(() => {
  const calls: unknown[][] = [];
  const answer = { value: { data: [] as unknown[], error: null, count: 0 } };
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
  currentScope: async () => ({ agents: ["s1"], unowned: true, pages: ["p1", "p2"], owner: null }),
}));

const { countByStatus, countDraftsByPage, listContent, listWaiting } = await import("@/lib/content/store");

beforeEach(() => {
  db.calls.length = 0;
  db.answer.value = { data: [], error: null, count: 0 };
});
const pageEq = () => db.calls.filter((c) => c[0] === "eq" && c[1] === "page_id").map((c) => c[2]);

describe("one Page's project", () => {
  it("is what the workbench lists and counts", async () => {
    await listContent({ status: "draft", pageId: "p1" });
    expect(pageEq()).toEqual(["p1"]);
    db.calls.length = 0;
    await countByStatus(undefined, "p1");
    expect(pageEq()).toEqual(["p1", "p1", "p1"]);
  });

  it("is what the calendar's rail offers", async () => {
    await listWaiting("p2");
    expect(pageEq()).toEqual(["p2"]);
  });

  it("is not narrowed for a caller with no Pages", async () => {
    await listContent({ status: "draft" });
    await listWaiting();
    expect(pageEq()).toEqual([]);
  });

  it("keeps every list to the Pages the caller looks after", async () => {
    await listContent({ status: "draft", pageId: "p1" });
    expect(db.calls).toContainEqual(["or", "page_id.in.(p1,p2),and(page_id.is.null,or(agent_id.in.(s1),agent_id.is.null))"]);
  });

  it("counts each Page's drafts for the cards on /studio", async () => {
    db.answer.value = { data: [{ page_id: "p1" }, { page_id: "p1" }, { page_id: "p2" }], error: null, count: 0 };
    expect(await countDraftsByPage()).toEqual(new Map([["p1", 2], ["p2", 1]]));
  });
});
