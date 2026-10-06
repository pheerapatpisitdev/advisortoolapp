import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A run is one Organic post put on Facebook as an ad set and an ad under the Page's standing
 * campaign. The database is stood in for here — never the real one — and what is checked is what
 * each call sends it, and that a row comes back in camelCase. The migration is read as text.
 */

interface Call { table: string; op: string; payload?: unknown; filters: [string, unknown][]; or?: string; order?: [string, unknown]; onConflict?: string }
const calls: Call[] = [];
let insertOne: { data: unknown; error: { message: string } | null };
let rows: Record<string, unknown>[];
let one: Record<string, unknown> | null;
let updated: { id: string }[];

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return b; },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return b; },
    upsert: (payload: unknown, opts: { onConflict?: string }) => { call.op = "upsert"; call.payload = payload; call.onConflict = opts?.onConflict; return b; },
    select: () => b,
    or: (cond: string) => { call.or = cond; return b; },
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    order: (col: string, opts: unknown) => { call.order = [col, opts]; return b; },
    single: async () => { calls.push(call); return insertOne; },
    maybeSingle: async () => { calls.push(call); return { data: one, error: null }; },
    then: (resolve: (v: unknown) => unknown) => {
      calls.push(call);
      return resolve({ data: call.op === "update" ? updated : rows, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));

const { claimRun, createRun, getRun, getStanding, listRuns, releaseRun, saveRun, saveStanding } = await import("@/lib/ads/run-store");

const runRow = {
  id: "R1", created_at: "2026-10-07T00:00:00Z", page_id: "105", act_id: "act_1", content_id: "C1",
  path: "boost", story_id: "105_77", daily_budget_minor: 20000, end_at: "2026-10-14T00:00:00Z",
  meta_campaign_id: "900", adset_id: null, image_hash: null, creative_id: null, ad_id: null,
  step: "none", error: null, claimed_at: null, paused_at: null, created_by: "U1",
};

beforeEach(() => {
  calls.length = 0;
  rows = [];
  one = null;
  updated = [];
  insertOne = { data: runRow, error: null };
});

describe("creating and reading runs", () => {
  it("inserts the run and answers it in camelCase at step none", async () => {
    const run = await createRun({
      pageId: "105", actId: "act_1", contentId: "C1", path: "boost", storyId: "105_77",
      dailyBudgetMinor: 20000, endAt: "2026-10-14T00:00:00Z", metaCampaignId: "900", createdBy: "U1",
    });
    expect(calls[0]).toMatchObject({ table: "ins_ad_run", op: "insert" });
    expect(calls[0].payload).toEqual({
      page_id: "105", act_id: "act_1", content_id: "C1", path: "boost", story_id: "105_77",
      daily_budget_minor: 20000, end_at: "2026-10-14T00:00:00Z", meta_campaign_id: "900", created_by: "U1",
    });
    expect(run).toEqual({
      id: "R1", createdAt: "2026-10-07T00:00:00Z", pageId: "105", actId: "act_1", contentId: "C1",
      path: "boost", storyId: "105_77", dailyBudgetMinor: 20000, endAt: "2026-10-14T00:00:00Z",
      metaCampaignId: "900", adsetId: null, imageHash: null, creativeId: null, adId: null,
      step: "none", error: null, pausedAt: null, createdBy: "U1",
    });
  });

  it("answers null when the post already has an open run (the database's one-open-run index)", async () => {
    insertOne = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"ins_ad_run_one_open\"" } as { message: string } };
    expect(await createRun({
      pageId: "105", actId: "act_1", contentId: "C1", path: "boost", storyId: null,
      dailyBudgetMinor: 20000, endAt: "2026-10-14T00:00:00Z", metaCampaignId: "900", createdBy: "U1",
    })).toBeNull();
  });

  it("throws the database's error from the insert", async () => {
    insertOne = { data: null, error: { message: "no such table" } };
    await expect(createRun({
      pageId: "105", actId: "act_1", contentId: "C1", path: "new", storyId: null,
      dailyBudgetMinor: 20000, endAt: "2026-10-14T00:00:00Z", metaCampaignId: "900", createdBy: "U1",
    })).rejects.toThrow("no such table");
  });

  it("finds one run by id, or null", async () => {
    one = runRow;
    expect(await getRun("R1")).toMatchObject({ id: "R1", storyId: "105_77" });
    expect(calls[0].filters).toEqual([["id", "R1"]]);
    one = null;
    expect(await getRun("nope")).toBeNull();
  });

  it("lists a Page's runs newest first", async () => {
    rows = [runRow];
    const list = await listRuns("105");
    expect(calls[0]).toMatchObject({ table: "ins_ad_run", filters: [["page_id", "105"]], order: ["created_at", { ascending: false }] });
    expect(list.map((r) => r.id)).toEqual(["R1"]);
  });
});

describe("saving steps", () => {
  it("writes only the fields given, in snake_case", async () => {
    await saveRun("R1", { adsetId: "9", step: "adset", error: null });
    expect(calls[0]).toMatchObject({ table: "ins_ad_run", op: "update", filters: [["id", "R1"]] });
    expect(calls[0].payload).toEqual({ adset_id: "9", step: "adset", error: null });
  });

  it("maps every patchable field", async () => {
    await saveRun("R1", {
      path: "fallback", storyId: null, imageHash: "h", creativeId: "c", adId: "a", pausedAt: "t",
      dailyBudgetMinor: 30000, endAt: "e",
    });
    expect(calls[0].payload).toEqual({
      path: "fallback", story_id: null, image_hash: "h", creative_id: "c", ad_id: "a", paused_at: "t",
      daily_budget_minor: 30000, end_at: "e",
    });
  });
});

describe("the claim", () => {
  it("takes a free or stale run and says whether this request holds it", async () => {
    const now = new Date("2026-10-07T00:10:00Z");
    updated = [{ id: "R1" }];
    expect(await claimRun("R1", 300_000, now)).toBe(true);
    expect(calls[0].payload).toEqual({ claimed_at: now.toISOString() });
    expect(calls[0].or).toBe('claimed_at.is.null,claimed_at.lt."2026-10-07T00:05:00.000Z"');
    updated = [];
    expect(await claimRun("R1", 300_000, now)).toBe(false);
  });

  it("gives the run back", async () => {
    await releaseRun("R1");
    expect(calls[0]).toMatchObject({ op: "update", payload: { claimed_at: null }, filters: [["id", "R1"]] });
  });
});

describe("the standing campaign", () => {
  it("is read per Page and account", async () => {
    one = { meta_campaign_id: "900" };
    expect(await getStanding("105", "act_1")).toBe("900");
    expect(calls[0]).toMatchObject({ table: "ins_ad_standing", filters: [["page_id", "105"], ["act_id", "act_1"]] });
    one = null;
    expect(await getStanding("105", "act_1")).toBeNull();
  });

  it("is upserted on the Page and account", async () => {
    await saveStanding("105", "act_1", "901");
    expect(calls[0]).toMatchObject({ table: "ins_ad_standing", op: "upsert", onConflict: "page_id,act_id" });
    expect(calls[0].payload).toMatchObject({ page_id: "105", act_id: "act_1", meta_campaign_id: "901" });
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261011_ad_run.sql", "utf8");
  it("turns row security on for both tables and grants nothing to anon or authenticated", () => {
    expect(sql).toContain("alter table public.ins_ad_run enable row level security");
    expect(sql).toContain("alter table public.ins_ad_standing enable row level security");
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\b(anon|authenticated)\b/i);
  });
  it("allows one open run per post: no ad yet and not dropped", () => {
    expect(sql).toMatch(/create unique index if not exists ins_ad_run_one_open\s+on public\.ins_ad_run \(content_id\)\s+where ad_id is null and paused_at is null/);
  });
});
