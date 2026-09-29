import { beforeEach, describe, expect, it, vi } from "vitest";

/** Which Pages a caller sees: the owner and admins every one, posting staff the ones tied to them, others none. */

const viewer = vi.hoisted(() => ({ getViewer: vi.fn() }));
const conn = vi.hoisted(() => ({ pageConnections: vi.fn() }));
const tied = vi.hoisted(() => ({ rows: [] as { page_id: string }[] }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("@/lib/facebook/connection", () => conn);
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: tied.rows, error: null }) }) }) }),
}));

const { myPages, myPageIds, seesEveryPage } = await import("@/lib/auth/pages");

const PAGES = [{ pageId: "p1", pageName: "เงินออม" }, { pageId: "p2", pageName: "Talk" }];
const staff = (perms: Partial<{ owner: boolean; publish: boolean; connect: boolean; admin: boolean }>) =>
  ({ agentId: "s1", staff: { owner: false, publish: false, connect: false, admin: false, ...perms } });

beforeEach(() => {
  vi.clearAllMocks();
  conn.pageConnections.mockResolvedValue(PAGES);
  tied.rows = [];
});

describe("the Pages a caller sees", () => {
  it("every one, for the owner and for admins", async () => {
    for (const v of [staff({ owner: true }), staff({ admin: true })]) {
      viewer.getViewer.mockResolvedValue(v);
      expect((await myPages()).map((p) => p.pageId)).toEqual(["p1", "p2"]);
      expect(seesEveryPage(v as never)).toBe(true);
    }
  });

  it("the ones tied to them, for posting staff — and only while still connected", async () => {
    viewer.getViewer.mockResolvedValue(staff({ publish: true }));
    tied.rows = [{ page_id: "p2" }, { page_id: "gone" }];
    expect((await myPages()).map((p) => p.pageId)).toEqual(["p2"]);
    expect([...(await myPageIds())]).toEqual(["p2"]);
  });

  it("none, for posting staff tied to nothing yet", async () => {
    viewer.getViewer.mockResolvedValue(staff({ publish: true }));
    expect(await myPages()).toEqual([]);
  });

  it("none, for an agent who does not post, and for nobody signed in", async () => {
    viewer.getViewer.mockResolvedValue({ agentId: "a1", staff: null });
    expect(await myPages()).toEqual([]);
    viewer.getViewer.mockResolvedValue(null);
    expect(await myPages()).toEqual([]);
  });
});
