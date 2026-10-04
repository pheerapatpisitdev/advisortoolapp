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
/** what a plain read of one table answers, where a test needs the tables to differ */
let rowsByTable: Record<string, Record<string, unknown>[]> = {};

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; return b; },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return b; },
    select: () => b,
    eq: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    in: (col: string, val: unknown) => { call.filters.push([col, val]); return b; },
    order: (col: string, opts: unknown) => { call.order = [col, opts]; return b; },
    single: async () => { calls.push(call); return { data: one, error: null }; },
    maybeSingle: async () => { calls.push(call); return { data: one, error: null }; },
    then: (resolve: (v: unknown) => unknown) => { calls.push(call); return resolve({ data: rowsByTable[table] ?? rows, error: null }); },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ from: builder }) }));
vi.mock("@/lib/auth/scope", () => ({
  currentScope: async () => ({ owner: { agentId: "A1", tenantId: "T1" } }),
  maySeePiece: () => true,
  pieceFilter: () => null,
}));

const { campaignCountsByPage, createCampaign, getCampaign, listCampaignPieces, listCampaigns, updateCampaign } = await import("@/lib/ads/campaign-store");
const { saveContent } = await import("@/lib/content/store");
const { MAX_ANGLES, MAX_TONES } = await import("@/lib/content/ads");

const UUID = "0b9f2c1e-5d3a-4c7b-9e11-2a4f6d8c0b13";
const dbRow = {
  id: UUID, created_at: "2026-10-04T00:00:00Z", page_id: "p1", plan_href: "/plans/ishield",
  name: "iShield", angles: 2, tones: 2, theme: "t", hint: "h", agent_id: "A1",
  brand_voice: null,
};

beforeEach(() => {
  calls.length = 0;
  rows = [];
  rowsByTable = {};
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
      brandVoice: null,
      writer: null, painter: null, person: null, pictureBrief: null,
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

describe("a campaign's brand voice", () => {
  it("writes brand_voice when it is given, null when not, and no dimensions or queue columns", async () => {
    await createCampaign({ pageId: "p1", planHref: "/plans/ishield", angles: 2, tones: 2, agentId: "A1", brandVoice: "อบอุ่น" });
    expect(calls[0].payload).toMatchObject({ brand_voice: "อบอุ่น" });
    expect(calls[0].payload).not.toHaveProperty("dimensions");
    calls.length = 0;
    await createCampaign({ pageId: "p1", planHref: "/plans/ishield", angles: 2, tones: 2, agentId: "A1" });
    expect(calls[0].payload).toMatchObject({ brand_voice: null });
  });

  it("reads brand_voice back in camelCase, and leaves the old columns off the campaign", async () => {
    one = { ...dbRow, dimensions: { hooks: [] }, queue_pos: 5, brand_voice: "อบอุ่น" };
    const c = await getCampaign(UUID);
    expect(c).toMatchObject({ brandVoice: "อบอุ่น" });
    expect(c).not.toHaveProperty("dimensions");
    expect(c).not.toHaveProperty("queuePos");
  });

  it("updates brandVoice as a snake_case column", async () => {
    await updateCampaign(UUID, { brandVoice: null });
    expect(calls[0]).toMatchObject({ op: "update", payload: { brand_voice: null }, filters: [["id", UUID]] });
    expect(calls[0].payload).not.toHaveProperty("queue_pos");
  });
});

describe("a campaign's ภาพและโมเดล", () => {
  const PERSON = { id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", pose: "arms" };

  it("writes the picks as snake_case columns, null when not given", async () => {
    await createCampaign({ pageId: "p1", planHref: "/plans/ishield", angles: 1, tones: 1, agentId: "A1", writer: "cheap", painter: "sharp", person: PERSON, pictureBrief: "สวน" });
    expect(calls[0].payload).toMatchObject({ writer: "cheap", painter: "sharp", person: PERSON, picture_brief: "สวน" });
    calls.length = 0;
    await createCampaign({ pageId: "p1", planHref: "/plans/ishield", angles: 1, tones: 1, agentId: "A1" });
    expect(calls[0].payload).toMatchObject({ writer: null, painter: null, person: null, picture_brief: null });
  });

  it("reads them back, and a stored person not of the right shape as nobody", async () => {
    one = { ...dbRow, writer: "best", painter: "gemini", person: PERSON, picture_brief: "สวน" };
    expect(await getCampaign(UUID)).toMatchObject({ writer: "best", painter: "gemini", person: PERSON, pictureBrief: "สวน" });
    one = { ...dbRow, person: { id: "x" } };
    expect(await getCampaign(UUID)).toMatchObject({ writer: null, painter: null, person: null, pictureBrief: null });
  });

  it("updates only the picks given", async () => {
    await updateCampaign(UUID, { painter: null, pictureBrief: "ทะเล" });
    expect(calls[0]).toMatchObject({ op: "update", payload: { painter: null, picture_brief: "ทะเล" } });
    expect(calls[0].payload).not.toHaveProperty("writer");
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

  it("adds the dimensions, queue position and brand voice, and nothing else is dropped", () => {
    const flow = readFileSync("supabase/migrations/20261005_ad_studio_flow.sql", "utf8");
    expect(flow).toContain("add column if not exists dimensions jsonb");
    expect(flow).toContain("add column if not exists queue_pos int not null default 0");
    expect(flow).toContain("add column if not exists brand_voice text");
    expect(flow).not.toMatch(/drop (table|column)/i);
  });

  it("adds the picture picks, held to the lists, and drops nothing", () => {
    const pic = readFileSync("supabase/migrations/20261008_ad_campaign_picture.sql", "utf8");
    for (const col of ["writer text", "painter text", "person jsonb", "picture_brief text"]) expect(pic).toContain(`add column if not exists ${col}`);
    expect(pic).toContain("writer in ('best', 'balanced', 'cheap')");
    expect(pic).toContain("painter in ('standard', 'sharp', 'gemini')");
    expect(pic).not.toMatch(/drop (table|column)/i);
  });

  it("files old ad pieces only when they are unfiled, so running it twice changes nothing more", () => {
    expect(sql).toContain("campaign_id is null");
    expect(sql).toMatch(/not exists/i);
    expect(sql).toContain("page_id is not null");
  });
});

describe("the campaign counts on Studio's front page", () => {
  const C1 = "0b9f2c1e-5d3a-4c7b-9e11-2a4f6d8c0b13";
  const C2 = "1c0a3d2f-6e4b-4d8c-8f22-3b5a7e9d1c24";
  const C3 = "2d1b4e3a-7f5c-4e9d-9a33-4c6b8fae2d35";

  it("counts a Page's campaigns and the pieces in them that have a live launch", async () => {
    rowsByTable = {
      ins_ad_campaign: [{ id: C1, page_id: "p1" }, { id: C2, page_id: "p1" }, { id: C3, page_id: "p2" }],
      // a piece launched twice (two ad accounts) counts once; a launch whose piece was deleted counts for none
      ins_ad_launch: [{ piece_id: "a" }, { piece_id: "a" }, { piece_id: "b" }, { piece_id: null }],
      ins_content: [{ id: "a", campaign_id: C1 }, { id: "b", campaign_id: C2 }],
    };
    const counts = await campaignCountsByPage();
    expect(counts.get("p1")).toEqual({ campaigns: 2, launched: 2 });
    expect(counts.get("p2")).toEqual({ campaigns: 1, launched: 0 });
    expect(counts.has("p3")).toBe(false);
    // three reads however many campaigns: the live launches, then the pieces they are for
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_campaign", "ins_ad_launch", "ins_content"]);
    expect(calls[1].filters).toContainEqual(["superseded", false]);
    expect(calls[2].filters).toContainEqual(["id", ["a", "b"]]);
  });

  it("does not ask for pieces when nothing is launched", async () => {
    rowsByTable = { ins_ad_campaign: [{ id: C1, page_id: "p1" }], ins_ad_launch: [] };
    expect((await campaignCountsByPage()).get("p1")).toEqual({ campaigns: 1, launched: 0 });
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_campaign", "ins_ad_launch"]);
  });

  it("does not look for launches when there are no campaigns", async () => {
    expect((await campaignCountsByPage()).size).toBe(0);
    expect(calls.map((c) => c.table)).toEqual(["ins_ad_campaign"]);
  });
});
