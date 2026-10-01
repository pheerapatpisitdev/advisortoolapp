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
    viewer.getViewer.mockRejectedValue(new Error("`cookies` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context"));
    expect((await currentScope()).pages).toBeNull();
    viewer.getViewer.mockResolvedValue(null);
    expect((await currentScope()).pages).toEqual([]);
  });
});

/** ALL is for Next saying there is no request, and for nothing else (review, 2026-10-01). */
describe("a viewer that cannot be read", () => {
  const nextError = (message: string, code: string) =>
    Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", { value: code, enumerable: false });

  it("is everything only for work outside a request or inside after()", async () => {
    viewer.getViewer.mockRejectedValue(nextError("`cookies` was called outside a request scope.", "E251"));
    expect(await currentScope()).toMatchObject({ agents: null, pages: null, unowned: true });
    viewer.getViewer.mockRejectedValue(nextError('Route /studio/calendar used "cookies" inside "after(...)". This is not supported.', "E88"));
    expect(await currentScope()).toMatchObject({ agents: null, pages: null });
    // the code alone, should Next ever reword the message
    viewer.getViewer.mockRejectedValue(nextError("reworded", "E251"));
    expect((await currentScope()).agents).toBeNull();
  });

  it("is nothing, and said, when the database fails mid-request", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    viewer.getViewer.mockRejectedValue(new Error("อ่านข้อมูลตัวแทนไม่ได้: connection reset"));
    expect(await currentScope()).toEqual({ agents: [], unowned: false, pages: [], owner: null });
    viewer.getViewer.mockRejectedValue("not even an Error");
    expect((await currentScope()).agents).toEqual([]);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(pages.myPageIds).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});
