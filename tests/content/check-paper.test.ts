import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Publish } from "@/lib/content/store";

/**
 * ตรวจแล้ว on a รีวิวเคลม's papers (checkPaper) is an edit like any other: not of a piece
 * Facebook has or holds — its papers are the ones the Page went up with (review, 2026-10-01).
 */

const store = vi.hoisted(() => ({
  getContent: vi.fn(), saveBackground: vi.fn(async () => "c1/new.jpg"), saveOutputIf: vi.fn(), removeBackground: vi.fn(async () => {}),
}));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));

const { checkPaper } = await import("@/lib/content/claim-run");
const { CLAIM_HREF } = await import("@/lib/content/claim");

const piece = (publish: Publish | null): ContentItem => ({
  id: "c1", createdAt: "2026-10-01T00:00:00Z", planHref: CLAIM_HREF, format: "post", angle: "", length: null,
  output: {
    hooks: ["h"], body: "b", closing: "c", hashtags: [], imagePrompt: "", disclaimer: "d", paperChecked: false, rev: "r1",
    poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "h" }], documents: [{ path: "c1/old.jpg", ratio: 0.75 }] },
  },
  flags: { numbers: [], words: [], policy: [], fixes: null }, model: null, costThb: 0, status: "draft", hookTemplateId: null,
  publish, agentId: "a1", pageId: "p1", plan: null,
});
const stickered = () => new Map([[0, { bytes: Buffer.from("jpg"), mimeType: "image/jpeg", ratio: 0.75 }]]);

beforeEach(() => {
  vi.clearAllMocks();
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => ({ ...piece(null), output }));
});

describe("ตรวจแล้ว on a claim poster's papers", () => {
  it("is refused for a piece held by Facebook or up on the Page, and files nothing", async () => {
    for (const publish of [
      { state: "scheduled", pageId: "p1", postId: "p1_9", at: new Date(Date.now() + 3_600_000).toISOString(), error: null },
      { state: "published", pageId: "p1", postId: "p1_9", at: new Date().toISOString(), error: null },
    ] as Publish[]) {
      store.getContent.mockResolvedValue(piece(publish));
      expect(await checkPaper("c1", stickered())).toEqual({ ok: false, error: expect.stringContaining("ตั้งเวลา") });
    }
    expect(store.saveBackground).not.toHaveBeenCalled();
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });

  it("removes what it filed when the piece went up between tries", async () => {
    // the first write loses to another; by the second read the piece is scheduled
    store.getContent
      .mockResolvedValueOnce(piece(null))
      .mockResolvedValueOnce(piece({ state: "scheduled", pageId: "p1", postId: "p1_9", at: new Date(Date.now() + 3_600_000).toISOString(), error: null }));
    store.saveOutputIf.mockResolvedValueOnce(null);
    expect((await checkPaper("c1", stickered())).ok).toBe(false);
    expect(store.removeBackground).toHaveBeenCalledWith("c1", "c1/new.jpg");
  });

  it("still goes through for a piece not on the Page", async () => {
    store.getContent.mockResolvedValue(piece(null));
    const r = await checkPaper("c1", stickered());
    expect(r.ok).toBe(true);
    expect(store.saveOutputIf.mock.calls[0][1]).toMatchObject({ paperChecked: true, poster: { documents: [{ path: "c1/new.jpg" }] } });
  });
});
