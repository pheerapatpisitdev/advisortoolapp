import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A campaign is one insurance product on one Facebook Page, and every ad piece is filed into
 * one. The database is stood in for here — never the real one — and what is checked is what
 * each call sends it: which rows it asks for, in what order, and that the numbers are held to
 * the limits the writer can honour. The migration is read as text, since it cannot be run here.
 */

interface Call { table: string; op: string; payload?: unknown; filters: [string, unknown][]; order?: [string, unknown] }
const calls: Call[] = [];
/** what a select answers: the list for a plain read, the one row for single/maybeSingle */
let rows: Record<string, unknown>[];
let one: Record<string, unknown> | null;

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return b; },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return b; },
    select: () => b,
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    order: (col: string, opts: unknown) => { call.order = [col, opts]; return b; },
    single: async () => { calls.push(call); return { data: one, error: null }; },
    maybeSingle: async () => { calls.push(call); return { data: one, error: null }; },
    then: (resolve: (v: unknown) => unknown) => { calls.push(call); return resolve({ data: rows, error: null }); },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));
vi.mock("@/lib/auth/scope", () => ({
  currentScope: async () => ({ owner: { agentId: "A1", tenantId: "T1" } }),
  maySeePiece: () => true,
  pieceFilter: () => null,
}));

const { createCampaign, getCampaign, listCampaignPieces, listCampaigns, updateCampaign } = await import("@/lib/ads/campaign-store");
const { saveContent } = await import("@/lib/content/store");
const { MAX_ANGLES, MAX_TONES } = await import("@/lib/content/ads");

const UUID = "0b9f2c1e-5d3a-4c7b-9e11-2a4f6d8c0b13";
const dbRow = {
  id: UUID, created_at: "2026-10-04T00:00:00Z", page_id: "p1", plan_href: "/plans/ishield",
  name: "iShield", angles: 2, tones: 2, theme: "t", hint: "h", agent_id: "A1",
};

beforeEach(() => {
  calls.length = 0;
  rows = [];
  one = dbRow;
});

describe("reading campaigns", () => {
  it("lists a Page's campaigns newest first, in camelCase", async () => {
    rows = [dbRow];
    const list = await listCampaigns("p1");
    expect(calls[0]).toMatchObject({ table: "ins_ad_campaign", op: "select", filters: [["page_id", "p1"]], order: ["created_at", { ascending: false }] });
    expect(list).toEqual([{
      id: UUID, createdAt: "2026-10-04T00:00:00Z", pageId: "p1", planHref: "/plans/ishield",
      name: "iShield", angles: 2, tones: 2, theme: "t", hint: "h", agentId: "A1",
    }]);
  });

  it("answers null for an id that is not a uuid without asking the database", async () => {
    expect(await getCampaign("not-a-uuid")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("finds a campaign by its id, or null when there is none", async () => {
    expect((await getCampaign(UUID))?.pageId).toBe("p1");
    expect(calls[0].filters).toEqual([["id", UUID]]);
    one = null;
    expect(await getCampaign(UUID)).toBeNull();
  });

  it("lists every piece filed in a campaign, whatever its state, newest first", async () => {
    rows = [];
    await listCampaignPieces("c1");
    expect(calls[0]).toMatchObject({ table: "ins_content", op: "select", filters: [["campaign_id", "c1"]], order: ["created_at", { ascending: false }] });
  });
});

describe("making and changing campaigns", () => {
  it("holds angles and tones to what the writer can honour", async () => {
    await createCampaign({ pageId: "p1", planHref: "/plans/ishield", angles: 9, tones: 0, agentId: "A1" });
    expect(calls[0].payload).toMatchObject({ angles: MAX_ANGLES, tones: 1, page_id: "p1", plan_href: "/plans/ishield", agent_id: "A1", name: null, theme: null, hint: null });
  });

  it("clamps an update the same way and sends only what was given", async () => {
    await updateCampaign(UUID, { angles: 0, tones: 99, hint: "x" });
    expect(calls[0]).toMatchObject({ op: "update", payload: { angles: 1, tones: MAX_TONES, hint: "x" }, filters: [["id", UUID]] });
    expect(calls[0].payload).not.toHaveProperty("name");
  });
});

describe("filing a piece into a campaign", () => {
  const save = (campaignId?: string | null) => saveContent({
    planHref: "/plans/ishield", format: "ad", angle: "" as never, length: null,
    output: {} as never, flags: { numbers: [], words: [], fixes: null }, rateVersion: null,
    model: "m", costThb: 0, hookTemplateId: null, pageId: "p1", ...(campaignId === undefined ? {} : { campaignId }),
  });

  it("writes campaign_id and reads it back as campaignId", async () => {
    one = { id: "P1", created_at: "2026-10-04T00:00:00Z", plan_href: "/plans/ishield", format: "ad", campaign_id: "c1", flags: {} };
    const item = await save("c1");
    expect(calls[0].payload).toMatchObject({ campaign_id: "c1" });
    expect(item.campaignId).toBe("c1");
  });

  it("files nothing when no campaign is given", async () => {
    one = { id: "P1", created_at: "2026-10-04T00:00:00Z", plan_href: "/x", format: "post", flags: {} };
    const item = await save();
    expect(calls[0].payload).toMatchObject({ campaign_id: null });
    expect(item.campaignId).toBeNull();
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261004_ad_campaigns.sql", "utf8");

  it("keeps a piece when its campaign is gone, and locks the table to the server", () => {
    expect(sql).toContain("on delete set null");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on public.ins_ad_campaign from public, anon, authenticated");
    expect(sql).toContain("grant all on public.ins_ad_campaign to service_role");
  });

  it("files old ad pieces only when they are unfiled, so running it twice changes nothing more", () => {
    expect(sql).toContain("campaign_id is null");
    expect(sql).toMatch(/not exists/i);
    expect(sql).toContain("page_id is not null");
  });
});
