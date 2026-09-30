import { beforeEach, describe, expect, it, vi } from "vitest";

/** currentScope knows the Pages a caller looks after (owner, 2026-09-30), and shows none it cannot read. */

const viewer = vi.hoisted(() => ({ getViewer: vi.fn(), staffAgentIds: vi.fn(async () => ["s1", "s2"]) }));
const pages = vi.hoisted(() => ({ myPageIds: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
vi.mock("@/lib/auth/pages", () => pages);
// every call answered afresh, as every request is
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

const { currentScope } = await import("@/lib/auth/scope");

const staffer = { agentId: "s1", tenantId: "t1", staff: { owner: false, publish: true, connect: false, admin: false } };

beforeEach(() => vi.clearAllMocks());

describe("the scope of a request", () => {
  it("carries the Pages the caller looks after", async () => {
    viewer.getViewer.mockResolvedValue(staffer);
    pages.myPageIds.mockResolvedValue(new Set(["p1"]));
    expect(await currentScope()).toMatchObject({ agents: ["s1", "s2"], pages: ["p1"] });
  });

  it("shows no Page's pieces when the Pages cannot be read", async () => {
    viewer.getViewer.mockResolvedValue(staffer);
    pages.myPageIds.mockRejectedValue(new Error("db down"));
    expect((await currentScope()).pages).toEqual([]);
  });

  it("is every Page's for work with no request, and none for nobody", async () => {
    viewer.getViewer.mockRejectedValue(new Error("cookies() outside a request"));
    expect((await currentScope()).pages).toBeNull();
    viewer.getViewer.mockResolvedValue(null);
    expect((await currentScope()).pages).toEqual([]);
  });
});
