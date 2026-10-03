import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The launch table is the record of one attempt to put an ad on Facebook, and the unique index
 * on it is what stops a double click making two campaigns. The database is stood in for here —
 * never the real one — and what is checked is what each call sends it, and that a clash with
 * the index comes back as the existing row rather than as a thrown error.
 */

interface Call { table: string; op: string; payload?: unknown; filters: [string, unknown][]; or?: string }
const calls: Call[] = [];
/** what the next insert answers; the select that follows (find/get) answers `existing` */
let insertReply: { data: unknown; error: { code?: string; message: string } | null };
let existing: Record<string, unknown> | null;
/** the rows a conditional update answers when it asks for them back */
let updated: { id: string }[];

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return b; },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return b; },
    select: () => b,
    or: (cond: string) => { call.or = cond; return b; },
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    single: async () => { calls.push(call); return insertReply; },
    maybeSingle: async () => { calls.push(call); return { data: existing, error: null }; },
    then: (resolve: (v: unknown) => unknown) => { calls.push(call); return resolve({ data: updated, error: null }); },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));

const { claimLaunch, createLaunch, findLaunch, getLaunch, markActivated, releaseLaunch, saveError, saveStep, supersede } =
  await import("@/lib/ads/launch-store");

const dbRow = {
  id: "L1", created_at: "2026-10-04T00:00:00Z", piece_id: "P1", act_id: "act_1", page_id: "pg1",
  link: "https://example.com", currency: "THB", daily_budget_minor: 20000,
  headline: "h", primary_text: "p", description: "d",
  campaign_id: null, adset_id: null, image_hash: null, creative_id: null, ad_id: null,
  step: "none", error: null, activated_at: null, claimed_at: null, superseded: false, created_by: "U1",
};
const input = {
  pieceId: "P1", actId: "act_1", pageId: "pg1", link: "https://example.com", currency: "THB",
  dailyBudgetMinor: 20000, headline: "h", primaryText: "p", description: "d", createdBy: "U1",
};

beforeEach(() => {
  calls.length = 0;
  existing = null;
  updated = [];
  insertReply = { data: dbRow, error: null };
});

describe("reading a launch", () => {
  it("finds the live row of a piece and account, in camelCase", async () => {
    existing = dbRow;
    const row = await findLaunch("P1", "act_1");
    expect(row).toMatchObject({ id: "L1", pieceId: "P1", actId: "act_1", dailyBudgetMinor: 20000, primaryText: "p", step: "none" });
    expect(calls[0].filters).toEqual([["piece_id", "P1"], ["act_id", "act_1"], ["superseded", false]]);
  });

  it("answers null when there is none", async () => {
    expect(await findLaunch("P1", "act_1")).toBeNull();
    expect(await getLaunch("nope")).toBeNull();
  });
});

describe("creating a launch", () => {
  it("inserts snake_case columns and says it created the row", async () => {
    const out = await createLaunch(input);
    expect(out.created).toBe(true);
    expect(out.row.id).toBe("L1");
    expect(calls[0].op).toBe("insert");
    expect(calls[0].payload).toMatchObject({
      piece_id: "P1", act_id: "act_1", page_id: "pg1", daily_budget_minor: 20000,
      primary_text: "p", created_by: "U1",
    });
  });

  it("returns the existing row, not an error, when the unique index is hit", async () => {
    insertReply = { data: null, error: { code: "23505", message: "duplicate key value" } };
    existing = { ...dbRow, id: "OLD", step: "adset", campaign_id: "c1" };
    const out = await createLaunch(input);
    expect(out.created).toBe(false);
    expect(out.row).toMatchObject({ id: "OLD", step: "adset", campaignId: "c1" });
    // it looked the winner up among the live rows only
    expect(calls[1].filters).toContainEqual(["superseded", false]);
  });

  it("throws any other database error", async () => {
    insertReply = { data: null, error: { code: "42P01", message: "no such table" } };
    await expect(createLaunch(input)).rejects.toThrow("no such table");
  });
});

describe("recording progress", () => {
  it("sends only the fields given, and clears the error", async () => {
    await saveStep("L1", { campaignId: "c1", step: "campaign" });
    expect(calls[0].op).toBe("update");
    expect(calls[0].payload).toEqual({ campaign_id: "c1", step: "campaign", error: null });
    expect(calls[0].filters).toEqual([["id", "L1"]]);
  });

  it("writes the error text on its own", async () => {
    await saveError("L1", "ขั้นชุดโฆษณาพัง");
    expect(calls[0].payload).toEqual({ error: "ขั้นชุดโฆษณาพัง" });
  });

  it("stamps the moment of switching on", async () => {
    await markActivated("L1", "2026-10-04T01:00:00Z");
    expect(calls[0].payload).toEqual({ activated_at: "2026-10-04T01:00:00Z" });
  });

  it("retires a row", async () => {
    await supersede("L1");
    expect(calls[0].payload).toEqual({ superseded: true });
    expect(calls[0].filters).toEqual([["id", "L1"]]);
  });
});

describe("claiming a launch", () => {
  const now = new Date("2026-10-04T01:00:00.000Z");

  it("wins when the conditional update changes one row", async () => {
    updated = [{ id: "L1" }];
    expect(await claimLaunch("L1", 120_000, now)).toBe(true);
    expect(calls[0].op).toBe("update");
    expect(calls[0].payload).toEqual({ claimed_at: "2026-10-04T01:00:00.000Z" });
    expect(calls[0].filters).toEqual([["id", "L1"]]);
    // free, or held longer ago than the stale time; the timestamp is quoted for PostgREST
    expect(calls[0].or).toBe('claimed_at.is.null,claimed_at.lt."2026-10-04T00:58:00.000Z"');
  });

  it("loses when another request holds it", async () => {
    updated = [];
    expect(await claimLaunch("L1", 120_000, now)).toBe(false);
  });

  it("uses the stale time it is given", async () => {
    updated = [{ id: "L1" }];
    await claimLaunch("L1", 60_000, now);
    expect(calls[0].or).toContain('"2026-10-04T00:59:00.000Z"');
  });

  it("gives the claim back", async () => {
    await releaseLaunch("L1");
    expect(calls[0].payload).toEqual({ claimed_at: null });
    expect(calls[0].filters).toEqual([["id", "L1"]]);
  });

  it("reads claimed_at back as claimedAt", async () => {
    existing = { ...dbRow, claimed_at: "2026-10-04T00:59:00Z" };
    expect((await getLaunch("L1"))?.claimedAt).toBe("2026-10-04T00:59:00Z");
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261004_ad_launch.sql", "utf8");

  it("keeps launch rows when a piece is deleted", () => {
    expect(sql).toContain("on delete set null");
    expect(sql).not.toMatch(/piece_id uuid not null/);
  });

  it("has the claim column", () => {
    expect(sql).toContain("claimed_at timestamptz");
  });
});
