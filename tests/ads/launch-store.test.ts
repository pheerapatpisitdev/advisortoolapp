import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The launch table is only read now (batch sends replaced one-by-one launches): a piece with a
 * live row is already on Facebook. The database is stood in for here, never the real one.
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

const { findLaunch } =
  await import("@/lib/ads/launch-store");

const dbRow = {
  id: "L1", created_at: "2026-10-04T00:00:00Z", piece_id: "P1", act_id: "act_1", page_id: "pg1",
  link: "https://example.com", currency: "THB", daily_budget_minor: 20000,
  headline: "h", primary_text: "p", description: "d",
  campaign_id: null, adset_id: null, image_hash: null, creative_id: null, ad_id: null,
  step: "none", error: null, activated_at: null, claimed_at: null, superseded: false, created_by: "U1",
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

  // like the wallet tables (20260930_wallet.sql): row-level security alone leaves the table's
  // default grants to anon and authenticated, so the table is locked to service_role explicitly
  it("locks the table to service_role", () => {
    expect(sql).toContain("revoke all on public.ins_ad_launch from public, anon, authenticated;");
    expect(sql).toContain("grant all on public.ins_ad_launch to service_role;");
    expect(sql.indexOf("revoke all on public.ins_ad_launch")).toBeGreaterThan(sql.indexOf("create table if not exists public.ins_ad_launch"));
  });
});
