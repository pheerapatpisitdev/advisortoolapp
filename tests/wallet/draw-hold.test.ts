import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Flags } from "@/lib/content/store";
import type { ContentOutput } from "@/lib/content/output";

/**
 * What a picture sets aside from the wallet before it is drawn: the dearest model the round can
 * reach, and the person it is priced for is the person it draws (review, 2026-10-01).
 */

const PAGE = "105";
let row: ContentItem;

const store = vi.hoisted(() => ({
  getContent: vi.fn(), saveOutputIf: vi.fn(), removeBackground: vi.fn(), holdContentBudget: vi.fn(), releaseContentBudget: vi.fn(),
  contentSpentThisMonth: vi.fn(), contentCap: vi.fn(), saveBackground: vi.fn(), recentLooks: vi.fn(async (): Promise<object[]> => []),
}));
const ai = vi.hoisted(() => ({ chat: vi.fn(), drawImage: vi.fn() }));
const quota = vi.hoisted(() => ({ takeRound: vi.fn(), allowanceOf: vi.fn() }));

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("@/lib/auth/quota", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/quota")>()), ...quota }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.5"]]) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), ...ai }));
vi.mock("@/lib/content/people-store", () => ({
  personPhotos: vi.fn(async () => ({ person: { id: "person-1" }, photos: [{ bytes: Buffer.from("x"), mimeType: "image/png" }] })),
}));

const { drawBackground } = await import("@/app/studio/actions");

const clean: Flags = { numbers: [], words: [], policy: [], fixes: null };
const output: ContentOutput = {
  hooks: ["หัวเรื่อง"], body: "เนื้อหา", closing: "ทักแชท", hashtags: [], imagePrompt: "", disclaimer: "d",
  poster: { layout: "bottom", theme: "navy", blocks: [{ kind: "headline", text: "หัวเรื่อง" }] },
};
const make = (out: ContentOutput = output): ContentItem => ({
  id: "p1", createdAt: "2026-09-25T00:00:00Z", planHref: "/nowhere", format: "post", angle: "", length: null,
  output: out, flags: clean, model: null, costThb: 0, status: "draft", hookTemplateId: null, publish: null, agentId: null, pageId: PAGE, plan: null, campaignId: null,
});
const withPerson = { ...output, person: { id: "person-1", pose: "auto" } } as ContentOutput;

beforeEach(() => {
  vi.clearAllMocks();
  row = make();
  store.getContent.mockImplementation(async () => row);
  store.saveOutputIf.mockImplementation(async (_id: string, out: ContentOutput) => (row = { ...row, output: out }));
  store.holdContentBudget.mockResolvedValue({ ok: true, id: "hold-1" });
  store.contentSpentThisMonth.mockResolvedValue(0);
  store.contentCap.mockResolvedValue(30);
  store.saveBackground.mockResolvedValue("p1/new.png");
  ai.chat.mockRejectedValue(new Error("no look today"));
  ai.drawImage.mockResolvedValue({ bytes: Buffer.from("img"), mimeType: "image/png", model: "gpt-image", id: "gpt-image-medium", costThb: 0.43 });
  quota.takeRound.mockResolvedValue({ ok: true, paidBy: "staff" });
});

const heldThb = () => quota.takeRound.mock.calls[0][3] as number;

describe("a picture's hold", () => {
  it("covers the lite fallback behind มาตรฐาน, not มาตรฐาน alone", async () => {
    await drawBackground("p1", "", "standard", null);
    expect(heldThb()).toBeCloseTo(1.26, 9);
  });

  it("is Gemini's when the piece's own person will be drawn", async () => {
    row = make(withPerson);
    await drawBackground("p1", "", "standard");
    expect(heldThb()).toBeCloseTo(2.44, 9);
    expect(ai.drawImage.mock.calls[0][0].references).toHaveLength(1);
  });

  it("draws the person it was priced for: one put on the piece after the hold is not drawn in", async () => {
    // the first read has no person; by the round's own read one has been set
    store.getContent.mockImplementationOnce(async () => make()).mockImplementation(async () => make(withPerson));
    await drawBackground("p1", "", "standard");
    expect(heldThb()).toBeCloseTo(1.26, 9);
    expect(ai.drawImage.mock.calls[0][0].references).toBeUndefined();
  });
});
