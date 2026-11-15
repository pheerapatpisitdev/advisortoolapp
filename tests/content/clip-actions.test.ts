import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/content/store";
import { clipOutput, NO_FLAGS } from "@/lib/content/clip";

const store = vi.hoisted(() => ({ getContent: vi.fn(), saveOutputIf: vi.fn(), listWords: vi.fn(async () => [{ word: "การันตี", kind: "banned", fix: null }]) }));
vi.mock("@/lib/content/store", () => store);
const auth = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => auth);

const { saveClipCaption } = await import("@/app/studio/clip");
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const item = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: PIECE, createdAt: "", planHref: "/life-protect", format: "script", angle: "", length: "60",
  output: { ...clipOutput("d"), hooks: ["h"], body: "บท" }, flags: NO_FLAGS, model: null, costThb: 0, status: "draft",
  hookTemplateId: null, publish: null, agentId: "a1", pageId: "105", plan: null, campaignId: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.requireMember.mockImplementation(async () => ({ kind: "unitos", agentId: "a1", staff: null }));
  store.saveOutputIf.mockImplementation(async (_id: string, output: ContentItem["output"]) => item({ output }));
});

describe("saveClipCaption", () => {
  const withClip = (over: Partial<ContentItem> = {}) => item({
    output: { ...item().output, video: { path: "x", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "เดิม", flags: NO_FLAGS } },
    ...over,
  });

  it("keeps the words and checks them again", async () => {
    store.getContent.mockResolvedValue(withClip());
    const r = await saveClipCaption(PIECE, "  การันตีครับ  ");
    expect(r.ok).toBe(true);
    const v = (store.saveOutputIf.mock.calls[0][1] as ContentItem["output"]).video!;
    expect(v.caption).toBe("การันตีครับ");
    expect(v.flags.words.map((w) => w.word)).toEqual(["การันตี"]);
  });

  it("refuses a Reel already held or posted, and a piece with no clip", async () => {
    store.getContent.mockResolvedValue(withClip({ publish: { state: "scheduled", pageId: "105", postId: "v", at: "2099-01-01T00:00:00Z", error: null } }));
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    store.getContent.mockResolvedValue(item());
    expect((await saveClipCaption(PIECE, "x")).ok).toBe(false);
    expect(store.saveOutputIf).not.toHaveBeenCalled();
  });
});
