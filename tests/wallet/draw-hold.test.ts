import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Flags } from "@/lib/content/store";
import type { ContentOutput } from "@/lib/content/output";

/**
 * What a picture sets aside from the wallet before it is drawn: the owner's fixed price for the
 * painter it would be drawn by (owner, 2026-10-12), Gemini's with a person — and the person it
 * is priced for is the person it draws (review, 2026-10-01).
 */

const PAGE = "105";
let row: ContentItem;

const store = vi.hoisted(() => ({
  getContent: vi.fn(), saveOutputIf: vi.fn(), removeBackground: vi.fn(), holdContentBudget: vi.fn(), releaseContentBudget: vi.fn(),
  contentSpentThisMonth: vi.fn(), contentCap: vi.fn(), saveBackground: vi.fn(), recentLooks: vi.fn(async (): Promise<object[]> => []),
}));
const ai = vi.hoisted(() => ({ chat: vi.fn(), drawImage: vi.fn() }));
const quota = vi.hoisted(() => ({ takeRound: vi.fn(), allowanceOf: vi.fn() }));
const prices = vi.hoisted(() => ({ walletPrices: vi.fn(), settleWallet: vi.fn(), releaseWallet: vi.fn() }));
vi.mock("@/lib/wallet/store", async (orig) => ({ ...(await orig<typeof import("@/lib/wallet/store")>()), ...prices }));

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("@/lib/auth/quota", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/quota")>()), ...quota }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.5"]]) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/ai/client", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/client")>()), ...ai }));
vi.mock("@/lib/content/people-store", () => ({
  personPhotos: vi.fn(async () => ({ person: { id: "person-1" }, photos: [{ bytes: Buffer.from("x"), mimeType: "image/png" }] })),
}));

const { drawBackground } = await import("@/app/studio/actions");
const { DEFAULT_PRICES } = await import("@/lib/wallet/prices");

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
  prices.walletPrices.mockResolvedValue(DEFAULT_PRICES);
});

const held = () => quota.takeRound.mock.calls[0][3] as { satang: number } | undefined;

describe("a picture's hold", () => {
  it("is the picked painter's price: มาตรฐาน ฿1, คมชัด ฿2, Gemini ฿5", async () => {
    for (const [painter, satang] of [["standard", 100], ["sharp", 200], ["gemini", 500]] as const) {
      quota.takeRound.mockClear();
      await drawBackground("p1", "", painter, null);
      expect(held()).toEqual({ satang });
    }
  });

  it("follows the owner's own prices", async () => {
    prices.walletPrices.mockResolvedValue({ ...DEFAULT_PRICES, drawStandard: 150 });
    await drawBackground("p1", "", "standard", null);
    expect(held()).toEqual({ satang: 150 });
  });

  it("is Gemini's when the piece's own person will be drawn", async () => {
    row = make(withPerson);
    await drawBackground("p1", "", "standard");
    expect(held()).toEqual({ satang: 500 });
    expect(ai.drawImage.mock.calls[0][0].references).toHaveLength(1);
  });

  it("is the round's default when nothing will be drawn", async () => {
    await drawBackground("p1", "", "none", null);
    expect(held()).toBeUndefined();
  });

  it("draws the person it was priced for: one put on the piece after the hold is not drawn in", async () => {
    // the first read has no person; by the round's own read one has been set
    store.getContent.mockImplementationOnce(async () => make()).mockImplementation(async () => make(withPerson));
    await drawBackground("p1", "", "standard");
    expect(held()).toEqual({ satang: 100 });
    expect(ai.drawImage.mock.calls[0][0].references).toBeUndefined();
  });
});

describe("a picture's charge", () => {
  const wallet = { ok: true as const, paidBy: "wallet" as const, holdId: "h1", heldSatang: 500, multiplier: 2, agentId: "a1" };

  it("is the chosen painter's fixed price, not the drawing's cost times the multiplier", async () => {
    quota.takeRound.mockResolvedValue({ ...wallet, heldSatang: 100 });
    prices.settleWallet.mockResolvedValue(0);
    await drawBackground("p1", "", "standard", null);
    expect(prices.settleWallet).toHaveBeenCalledWith("h1", 100, expect.any(Number));
  });

  it("is Gemini's when a person is drawn, whatever was picked", async () => {
    row = make(withPerson);
    quota.takeRound.mockResolvedValue(wallet);
    prices.settleWallet.mockResolvedValue(0);
    await drawBackground("p1", "", "standard");
    expect(prices.settleWallet).toHaveBeenCalledWith("h1", 500, expect.any(Number));
  });
});
