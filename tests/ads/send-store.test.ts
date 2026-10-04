import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A send is one batch of ad pieces put on Facebook as one campaign and one ad set, with an ad
 * per piece. The database is stood in for here — never the real one — and what is checked is
 * what each call sends it, and that a row comes back in camelCase. The migration is read as
 * text, since it cannot be run here.
 */

interface Call { table: string; op: string; payload?: unknown; filters: [string, unknown][]; or?: string; order?: [string, unknown]; is?: [string, unknown][] }
const calls: Call[] = [];
/** what an insert...select().single() answers */
let insertOne: { data: unknown; error: { code?: string; message: string } | null };
/** what a plain read, or an insert...select() awaited, answers per table */
let rowsByTable: Record<string, Record<string, unknown>[]>;
let one: Record<string, unknown> | null;
/** the rows a conditional update or delete answers when it asks for them back */
let updated: { id: string }[];

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return b; },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return b; },
    delete: () => { call.op = "delete"; return b; },
    select: () => b,
    or: (cond: string) => { call.or = cond; return b; },
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    is: (col: string, val: unknown) => { (call.is ??= []).push([col, val]); return b; },
    in: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    order: (col: string, opts: unknown) => { call.order = [col, opts]; return b; },
    single: async () => { calls.push(call); return insertOne; },
    maybeSingle: async () => { calls.push(call); return { data: one, error: null }; },
    then: (resolve: (v: unknown) => unknown) => {
      calls.push(call);
      const data = call.op === "update" || call.op === "delete" ? updated : (rowsByTable[table] ?? []);
      return resolve({ data, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));

const {
  claimSend, createSend, dropSend, getSend, listSends, markSendActivated, markSendPaused, releaseSend,
  saveItem, saveItemError, saveSendError, saveSendStep, sentPieceIds,
} = await import("@/lib/ads/send-store");
const { CLAIM_STALE_MS } = await import("@/lib/ads/launch-store");

const sendRow = {
  id: "S1", created_at: "2026-10-05T00:00:00Z", campaign_id: "C1", act_id: "act_1", page_id: "pg1",
  link: "https://example.com", currency: "THB", daily_budget_minor: 20000,
  meta_campaign_id: null, adset_id: null, step: "none", error: null, claimed_at: null,
  activated_at: null, paused_at: null, superseded: false, created_by: "U1",
};
const itemRow = (id: string, piece: string | null) => ({
  id, send_id: "S1", piece_id: piece, image_hash: null, creative_id: null, ad_id: null, error: null,
});
const input = {
  campaignId: "C1", actId: "act_1", pageId: "pg1", link: "https://example.com", currency: "THB",
  dailyBudgetMinor: 20000, createdBy: "U1",
};

beforeEach(() => {
  calls.length = 0;
  rowsByTable = {};
  one = null;
  updated = [];
  insertOne = { data: sendRow, error: null };
});

describe("creating a send", () => {
  it("inserts the send, then one item per piece, and answers both in camelCase", async () => {
    rowsByTable.ins_ad_send_item = [itemRow("I1", "P1"), itemRow("I2", "P2")];
    const out = await createSend(input, ["P1", "P2"]);
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", op: "insert" });
    expect(calls[0].payload).toMatchObject({
      campaign_id: "C1", act_id: "act_1", page_id: "pg1", link: "https://example.com", currency: "THB",
      daily_budget_minor: 20000, created_by: "U1",
    });
    expect(calls[1]).toMatchObject({ table: "ins_ad_send_item", op: "insert" });
    expect(calls[1].payload).toEqual([{ send_id: "S1", piece_id: "P1" }, { send_id: "S1", piece_id: "P2" }]);
    expect(out.send).toMatchObject({ id: "S1", campaignId: "C1", actId: "act_1", dailyBudgetMinor: 20000, step: "none", superseded: false });
    expect(out.items).toEqual([
      { id: "I1", sendId: "S1", pieceId: "P1", imageHash: null, creativeId: null, adId: null, error: null },
      { id: "I2", sendId: "S1", pieceId: "P2", imageHash: null, creativeId: null, adId: null, error: null },
    ]);
  });

  it("makes each piece one item only once", async () => {
    rowsByTable.ins_ad_send_item = [itemRow("I1", "P1")];
    await createSend(input, ["P1", "P1"]);
    expect(calls[1].payload).toEqual([{ send_id: "S1", piece_id: "P1" }]);
  });

  it("throws the database's error from the send insert, and writes no items", async () => {
    insertOne = { data: null, error: { code: "42P01", message: "no such table" } };
    await expect(createSend(input, ["P1"])).rejects.toThrow("no such table");
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_send"]);
  });
});

describe("reading sends", () => {
  it("finds one send by id, or null", async () => {
    one = sendRow;
    expect(await getSend("S1")).toMatchObject({ id: "S1", metaCampaignId: null, pausedAt: null });
    expect(calls[0].filters).toEqual([["id", "S1"]]);
    one = null;
    expect(await getSend("nope")).toBeNull();
  });

  it("lists a campaign's live sends newest first, each with its items", async () => {
    rowsByTable.ins_ad_send = [sendRow, { ...sendRow, id: "S0" }];
    rowsByTable.ins_ad_send_item = [itemRow("I1", "P1"), { ...itemRow("I0", "P9"), send_id: "S0" }];
    const list = await listSends("C1");
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", filters: [["campaign_id", "C1"], ["superseded", false]], order: ["created_at", { ascending: false }] });
    expect(calls[1]).toMatchObject({ table: "ins_ad_send_item" });
    expect(calls[1].filters).toContainEqual(["send_id", ["S1", "S0"]]);
    expect(list.map((s) => s.id)).toEqual(["S1", "S0"]);
    expect(list[0].items.map((i) => i.pieceId)).toEqual(["P1"]);
    expect(list[1].items.map((i) => i.pieceId)).toEqual(["P9"]);
  });

  it("does not ask for items when there is no send", async () => {
    expect(await listSends("C1")).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_send"]);
  });

  it("answers the pieces of a campaign's live sends, leaving out retired ones", async () => {
    rowsByTable.ins_ad_send = [{ id: "S1" }, { id: "S2" }];
    rowsByTable.ins_ad_send_item = [{ piece_id: "P1" }, { piece_id: "P2" }, { piece_id: null }, { piece_id: "P1" }];
    const ids = await sentPieceIds("C1");
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", filters: [["campaign_id", "C1"], ["superseded", false]] });
    expect(calls[1].filters).toContainEqual(["send_id", ["S1", "S2"]]);
    expect([...ids].sort()).toEqual(["P1", "P2"]);
  });

  it("answers an empty set, without asking for items, when nothing was sent", async () => {
    expect((await sentPieceIds("C1")).size).toBe(0);
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_send"]);
  });
});

describe("recording progress", () => {
  it("saves the Meta ids and the step, and clears the error", async () => {
    await saveSendStep("S1", { metaCampaignId: "m1", step: "campaign" });
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", op: "update", filters: [["id", "S1"]] });
    expect(calls[0].payload).toEqual({ meta_campaign_id: "m1", step: "campaign", error: null });
    await saveSendStep("S1", { adsetId: "a1", step: "adset" });
    expect(calls[1].payload).toEqual({ adset_id: "a1", step: "adset", error: null });
  });

  it("writes the send's error on its own", async () => {
    await saveSendError("S1", "ขั้นชุดโฆษณาพัง");
    expect(calls[0].payload).toEqual({ error: "ขั้นชุดโฆษณาพัง" });
  });

  it("saves an item's ids and clears its error", async () => {
    await saveItem("I1", { imageHash: "h", creativeId: "c", adId: "ad" });
    expect(calls[0]).toMatchObject({ table: "ins_ad_send_item", op: "update", filters: [["id", "I1"]] });
    expect(calls[0].payload).toEqual({ image_hash: "h", creative_id: "c", ad_id: "ad", error: null });
  });

  it("writes an item's error on its own", async () => {
    await saveItemError("I1", "รูปไม่ผ่าน");
    expect(calls[0]).toMatchObject({ table: "ins_ad_send_item", op: "update" });
    expect(calls[0].payload).toEqual({ error: "รูปไม่ผ่าน" });
  });

  it("stamps the moments of switching on and pausing", async () => {
    await markSendActivated("S1", "2026-10-05T01:00:00Z");
    expect(calls[0].payload).toEqual({ activated_at: "2026-10-05T01:00:00Z" });
    await markSendPaused("S1", "2026-10-05T02:00:00Z");
    expect(calls[1].payload).toEqual({ paused_at: "2026-10-05T02:00:00Z" });
  });
});

describe("claiming a send", () => {
  const now = new Date("2026-10-05T01:00:00.000Z");

  it("wins when the conditional update changes one row", async () => {
    updated = [{ id: "S1" }];
    expect(await claimSend("S1", 120_000, now)).toBe(true);
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", op: "update", filters: [["id", "S1"]] });
    expect(calls[0].payload).toEqual({ claimed_at: "2026-10-05T01:00:00.000Z" });
    expect(calls[0].or).toBe('claimed_at.is.null,claimed_at.lt."2026-10-05T00:58:00.000Z"');
  });

  it("loses when another request holds it", async () => {
    updated = [];
    expect(await claimSend("S1", 120_000, now)).toBe(false);
  });

  it("by default treats a claim as dead after the launch's stale time", async () => {
    updated = [{ id: "S1" }];
    await claimSend("S1", undefined, now);
    const stale = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
    expect(calls[0].or).toBe(`claimed_at.is.null,claimed_at.lt."${stale}"`);
  });

  it("gives the claim back", async () => {
    await releaseSend("S1");
    expect(calls[0].payload).toEqual({ claimed_at: null });
    expect(calls[0].filters).toEqual([["id", "S1"]]);
  });
});

describe("dropping a send that made nothing", () => {
  it("deletes only a send at step none with no Meta campaign, and says it did", async () => {
    updated = [{ id: "S1" }];
    expect(await dropSend("S1")).toBe(true);
    expect(calls[0]).toMatchObject({ table: "ins_ad_send", op: "delete" });
    expect(calls[0].filters).toEqual([["id", "S1"], ["step", "none"]]);
    expect(calls[0].is).toEqual([["meta_campaign_id", null]]);
  });

  it("answers false when the send has a Meta campaign or moved on, so nothing was deleted", async () => {
    updated = [];
    expect(await dropSend("S1")).toBe(false);
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261005_ad_studio_flow.sql", "utf8");

  it("adds the campaign columns without touching existing rows", () => {
    expect(sql).toContain("alter table public.ins_ad_campaign");
    expect(sql).toContain("add column if not exists dimensions jsonb");
    expect(sql).toContain("add column if not exists queue_pos int not null default 0");
    expect(sql).toContain("add column if not exists brand_voice text");
  });

  it("makes the send table and its items, and drops the items with their send", () => {
    expect(sql).toContain("create table if not exists public.ins_ad_send ");
    expect(sql).toContain("create table if not exists public.ins_ad_send_item");
    expect(sql).toContain("on delete cascade");
    expect(sql).toContain("unique (send_id, piece_id)");
  });

  it("keeps a send when its campaign goes and an item when its piece goes", () => {
    expect(sql).toMatch(/campaign_id uuid references public\.ins_ad_campaign\(id\) on delete set null/);
    expect(sql).toMatch(/piece_id uuid references public\.ins_content\(id\) on delete set null/);
  });

  it("locks both tables to service_role", () => {
    for (const t of ["ins_ad_send", "ins_ad_send_item"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security;`);
      expect(sql).toContain(`revoke all on public.${t} from public, anon, authenticated;`);
      expect(sql).toContain(`grant all on public.${t} to service_role;`);
    }
  });
});

describe("a send's objective", () => {
  it("writes a lead send's objective, form and button", async () => {
    await createSend({ ...input, objective: "leads", leadFormId: "777", cta: "GET_QUOTE" }, []);
    expect(calls[0].payload).toMatchObject({ objective: "leads", lead_form_id: "777", cta: "GET_QUOTE" });
  });

  it("writes a send that names no objective as traffic, with no form or button", async () => {
    await createSend(input, []);
    expect(calls[0].payload).toMatchObject({ objective: "traffic", lead_form_id: null, cta: null });
  });

  it("reads a lead send's objective, form and button back in camelCase", async () => {
    one = { ...sendRow, objective: "leads", lead_form_id: "777", cta: "SIGN_UP" };
    expect(await getSend("S1")).toMatchObject({ objective: "leads", leadFormId: "777", cta: "SIGN_UP" });
  });

  it("reads a row from before objectives as traffic", async () => {
    one = sendRow;
    expect(await getSend("S1")).toMatchObject({ objective: "traffic", leadFormId: null, cta: null });
  });

  it("is limited by the migration to the two objectives and three buttons, and a lead send needs both", () => {
    const sql = readFileSync("supabase/migrations/20261006_ad_send_objective.sql", "utf8");
    expect(sql).toContain("alter table public.ins_ad_send");
    expect(sql).toContain("objective text not null default 'traffic'");
    expect(sql).toContain("objective in ('traffic', 'leads')");
    expect(sql).toContain("'GET_QUOTE', 'SIGN_UP', 'LEARN_MORE'");
    expect(sql).toContain("objective <> 'leads' or (lead_form_id is not null and cta is not null)");
  });
});
