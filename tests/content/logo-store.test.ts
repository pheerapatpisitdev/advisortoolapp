import { beforeEach, describe, expect, it, vi } from "vitest";

/** Whose logo a round carries, and who may have one drawn. */

const viewer = vi.hoisted(() => ({ getViewer: vi.fn() }));
const conn = vi.hoisted(() => ({ pageConnections: vi.fn() }));
const row = vi.hoisted(() => ({ value: null as null | { page_id: string | null; agent_id: string | null } }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("@/lib/facebook/connection", () => conn);
// the Pages the caller looks after: p1 unless a test narrows it
const mine = vi.hoisted(() => ({ ids: ["p1"] as string[] }));
vi.mock("@/lib/auth/pages", () => ({
  // as the real one: an agent who does not post looks after no Page
  myPageIds: vi.fn(async () => ((await viewer.getViewer()) as { staff?: unknown } | null)?.staff ? new Set(mine.ids) : new Set<string>()),
  seesEveryPage: (v: { staff?: { owner?: boolean; admin?: boolean } | null } | null) => Boolean(v?.staff?.owner || v?.staff?.admin),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row.value, error: null }) }) }) }),
  }),
}));

const { logoOwner, mayUseLogo } = await import("@/lib/content/logo-store");

const agent = { agentId: "a1", staff: null };
const staff = { agentId: "s1", staff: { owner: false, publish: true, connect: false, admin: false } };
const PATH = "logos/0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f.png";

beforeEach(() => {
  vi.clearAllMocks();
  mine.ids = ["p1"];
  conn.pageConnections.mockResolvedValue([{ pageId: "p1", pageName: "LuckyPlanner" }]);
});

describe("whose logo a round carries", () => {
  it("the Page's, for the posting staff working for a connected Page", async () => {
    viewer.getViewer.mockResolvedValue(staff);
    expect(await logoOwner("p1")).toEqual({ pageId: "p1" });
    expect(await logoOwner("p9")).toEqual({ agentId: "s1" });
  });

  it("the agent's own, for an agent who posts to no Page, whatever Page is named", async () => {
    viewer.getViewer.mockResolvedValue(agent);
    expect(await logoOwner("p1")).toEqual({ agentId: "a1" });
  });

  it("nobody's, for nobody signed in", async () => {
    viewer.getViewer.mockResolvedValue(null);
    expect(await logoOwner("p1")).toBeNull();
  });
});

describe("who may have a logo drawn", () => {
  it("a Page's logo: the posting staff only", async () => {
    row.value = { page_id: "p1", agent_id: null };
    viewer.getViewer.mockResolvedValue(staff);
    expect(await mayUseLogo(PATH)).toBe(true);
    viewer.getViewer.mockResolvedValue(agent);
    expect(await mayUseLogo(PATH)).toBe(false);
  });

  it("an agent's logo: that agent, and the staff who see their pieces", async () => {
    row.value = { page_id: null, agent_id: "a1" };
    viewer.getViewer.mockResolvedValue(agent);
    expect(await mayUseLogo(PATH)).toBe(true);
    viewer.getViewer.mockResolvedValue({ ...agent, agentId: "a2" });
    expect(await mayUseLogo(PATH)).toBe(false);
    viewer.getViewer.mockResolvedValue(staff);
    expect(await mayUseLogo(PATH)).toBe(true);
  });

  it("a path with no logo behind it: nobody", async () => {
    row.value = null;
    viewer.getViewer.mockResolvedValue(staff);
    expect(await mayUseLogo(PATH)).toBe(false);
  });
});

describe("a Page's logo and the Pages a member of staff looks after (owner, 2026-09-29)", () => {
  it("is drawn only for staff who look after that Page", async () => {
    row.value = { page_id: "p1", agent_id: null };
    viewer.getViewer.mockResolvedValue(staff);
    mine.ids = [];
    expect(await mayUseLogo(PATH)).toBe(false);
  });

  it("is not set by staff for a Page they do not look after: the round carries their own", async () => {
    viewer.getViewer.mockResolvedValue(staff);
    mine.ids = [];
    expect(await logoOwner("p1")).toEqual({ agentId: "s1" });
  });
});
