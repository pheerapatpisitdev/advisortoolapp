import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextVariants, orderedVariants, type Variant } from "@/lib/ads/dimensions";
import type { Dimensions } from "@/lib/ads/campaign-store";
import { OVERHEAD_THB, writerOf } from "@/lib/content/models";

/**
 * Ads are written into a campaign (Ads Studio, 2026-10-04), one combination of its four
 * dimensions at a time, from the campaign's queue: the campaign's product, Page, focus and voice
 * stand in for whatever the browser sent, only the owner may write one, and everything that can
 * refuse a round — no campaign, no dimensions, a queue already walked to its end — refuses it
 * before anything is counted, held or written.
 */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn(), myPages: vi.fn() }));
const campaigns = vi.hoisted(() => ({ getCampaign: vi.fn(), listCampaignPieces: vi.fn(), updateCampaign: vi.fn() }));
const write = vi.hoisted(() => ({ writeAdVariants: vi.fn() }));
const viewer = vi.hoisted(() => ({ owner: true }));
const store = vi.hoisted(() => ({
  saveContent: vi.fn(),
  contentSpentThisMonth: vi.fn(async () => 0),
  contentCap: vi.fn(async () => 1000),
  holdContentBudget: vi.fn(async () => ({ ok: true, id: "hold-1" })),
  releaseContentBudget: vi.fn(async () => {}),
  usedHooks: vi.fn(async () => []),
  listWords: vi.fn(async () => []),
}));

vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return {
    ...asOwner,
    requireStaff: async () => {
      if (!viewer.owner) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return OWNER;
    },
  };
});
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-real-ip", "1.2.3.4"]]) }));
vi.mock("@/lib/auth/quota", () => quota);
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage, myPages: project.myPages }));
vi.mock("@/lib/ads/campaign-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/campaign-store")>()), ...campaigns }));
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/content/write", async (orig) => ({ ...(await orig<typeof import("@/lib/content/write")>()), ...write }));

const { generateContent } = await import("@/app/studio/actions");

const dims: Dimensions = {
  hooks: [{ text: "ฮุก 1", note: "" }, { text: "ฮุก 2", note: "" }],
  personas: [{ text: "พ่อแม่มือใหม่", note: "" }],
  angles: [{ text: "ครอบครัวไปต่อได้", note: "" }],
  styles: [{ text: "ภาพถ่ายครอบครัว", note: "" }, { text: "ตัวเลขเด่น", note: "" }],
};
const order = orderedVariants(dims);

const campaign = {
  id: "c1", createdAt: "2026-10-04T00:00:00Z", pageId: "P1", planHref: "/lifeprotect", name: null,
  angles: 3, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null,
  dimensions: dims, queuePos: 1, brandVoice: "อบอุ่น เป็นกันเอง",
};
const output = {
  hooks: ["h"], angle: "a", body: "b", closing: "c", hashtags: [], imagePrompt: "i", disclaimer: "d",
};
const adOf = (v: Variant) => ({ angle: v.angle, tone: v.persona, hook: v.hook, persona: v.persona, style: v.style, combo: v.combo });
/** a piece already in the campaign, in any state */
const pieceFor = (v: Variant, status = "draft") => ({ id: `p-${v.combo}`, status, output: { ...output, ad: adOf(v) } });

// what the browser may send: a different product and Page, and values the ad round does not read
const sent = {
  href: "/ishield", format: "ad" as const, angle: "" as const, custom: "ของเบราว์เซอร์", length: null, count: 2, hookTemplateId: null,
  page: "P9", adAngles: 1, adTones: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.projectPage.mockImplementation(async (asked?: string) => ({ ok: true, pageId: asked ?? null }));
  project.myPages.mockResolvedValue([{ pageId: "P1", pageName: "เพจ" }]);
  campaigns.getCampaign.mockResolvedValue(campaign);
  // the first combination of the queue is already made
  campaigns.listCampaignPieces.mockResolvedValue([pieceFor(order[0])]);
  campaigns.updateCampaign.mockResolvedValue(undefined);
  write.writeAdVariants.mockImplementation(async ({ variants }: { variants: Variant[] }) => ({
    pieces: variants.map((v) => ({ output: { ...output, ad: adOf(v) }, model: "m", costThb: 1 })), budgetHit: 0,
  }));
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: "x", costThb: row.costThb, ...row }));
});

function nothingSpent() {
  expect(quota.takeRound).not.toHaveBeenCalled();
  expect(store.holdContentBudget).not.toHaveBeenCalled();
  expect(write.writeAdVariants).not.toHaveBeenCalled();
  expect(store.saveContent).not.toHaveBeenCalled();
}

describe("an ad round is refused before anything is counted", () => {
  it("without a campaign", async () => {
    expect(await generateContent({ ...sent, campaignId: undefined })).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    nothingSpent();
  });

  it("for anyone but the owner", async () => {
    viewer.owner = false;
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" });
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    nothingSpent();
  });

  it("when the campaign is not found", async () => {
    campaigns.getCampaign.mockResolvedValue(null);
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    nothingSpent();
  });

  it("when its Page is no longer connected", async () => {
    project.myPages.mockResolvedValue([{ pageId: "P2", pageName: "เพจอื่น" }]);
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
    expect(project.projectPage).not.toHaveBeenCalled();
    nothingSpent();
  });

  it("when the campaign has no dimensions yet", async () => {
    campaigns.getCampaign.mockResolvedValue({ ...campaign, dimensions: null });
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "ให้ AI วิเคราะห์มิติก่อน" });
    nothingSpent();
  });

  it("when every combination is already made — a trashed piece counts as made", async () => {
    campaigns.listCampaignPieces.mockResolvedValue(order.map((v, i) => pieceFor(v, i === 0 ? "trashed" : "used")));
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "สร้างครบทุกแบบแล้ว" });
    nothingSpent();
  });

  it("when the campaign's pieces cannot be read", async () => {
    campaigns.listCampaignPieces.mockRejectedValue(new Error("db down"));
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(r.ok).toBe(false);
    nothingSpent();
  });
});

describe("an ad round from the queue", () => {
  it("writes the next combinations, skipping the ones already made, with the campaign's focus and voice", async () => {
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(r.ok).toBe(true);
    expect(write.writeAdVariants).toHaveBeenCalledTimes(1);
    const call = write.writeAdVariants.mock.calls[0][0];
    expect(call.variants).toEqual(nextVariants(dims, new Set([order[0].combo]), 2));
    expect(call.variants.map((v: Variant) => v.combo)).not.toContain(order[0].combo);
    expect(call.focus).toBe("เน้นครอบครัว");
    expect(call.voice).toBe("อบอุ่น เป็นกันเอง");
    expect(JSON.stringify(call)).not.toContain("ของเบราว์เซอร์");
  });

  it("holds the round's price for the pieces it will write", async () => {
    await generateContent({ ...sent, campaignId: "c1" });
    const writer = writerOf(undefined, 1000);
    expect((store.holdContentBudget.mock.calls[0] as unknown[])[0] as number).toBeCloseTo(2 * (writer.thb + OVERHEAD_THB));
  });

  it("saves every piece into the campaign, on its Page and product, with its combination", async () => {
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(project.projectPage).toHaveBeenCalledWith("P1");
    expect(store.saveContent).toHaveBeenCalledTimes(2);
    const combos = store.saveContent.mock.calls.map(([row]) => row.output.ad.combo);
    expect(combos).toEqual([order[1].combo, order[2].combo]);
    expect(store.saveContent.mock.calls[0][0]).toMatchObject({ campaignId: "c1", pageId: "P1", planHref: "/lifeprotect", format: "ad" });
    expect(r.ok && r.items).toHaveLength(2);
  });

  it("moves the queue on by the pieces saved", async () => {
    await generateContent({ ...sent, campaignId: "c1" });
    expect(campaigns.updateCampaign).toHaveBeenCalledWith("c1", { queuePos: 3 });
  });

  it("writes one when asked for a count other than 1, 2 or 4", async () => {
    await generateContent({ ...sent, count: 3, campaignId: "c1" });
    expect(write.writeAdVariants.mock.calls[0][0].variants).toHaveLength(1);
  });

  it("writes four when asked for four", async () => {
    campaigns.listCampaignPieces.mockResolvedValue([]);
    await generateContent({ ...sent, count: 4, campaignId: "c1" });
    expect(write.writeAdVariants.mock.calls[0][0].variants).toHaveLength(4);
  });

  it("near the end of the queue writes what is left and says why it is fewer", async () => {
    campaigns.listCampaignPieces.mockResolvedValue(order.slice(0, 3).map((v) => pieceFor(v)));
    const r = await generateContent({ ...sent, count: 4, campaignId: "c1" });
    expect(write.writeAdVariants.mock.calls[0][0].variants).toHaveLength(1);
    expect(r).toMatchObject({ ok: false, saved: 1, error: expect.stringContaining("1 จาก 4") });
    expect(!r.ok && r.error).toContain("คิวเหลือ 1 แบบ");
    expect(!r.ok && r.items).toHaveLength(1);
  });

  it("stopped by the month's AI budget part way keeps what was written and says how many", async () => {
    write.writeAdVariants.mockImplementation(async ({ variants }: { variants: Variant[] }) => ({
      pieces: [{ output: { ...output, ad: adOf(variants[0]) }, model: "m", costThb: 1 }], budgetHit: 1,
    }));
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.items).toHaveLength(1);
    expect(!r.ok && r.saved).toBe(1);
    expect(!r.ok && r.error).toContain("1 จาก 2");
    expect(!r.ok && r.error).toContain("ถึงงบค่า AI ของเดือนนี้แล้ว");
    expect(campaigns.updateCampaign).toHaveBeenCalledWith("c1", { queuePos: 2 });
    expect(store.releaseContentBudget).toHaveBeenCalledWith("hold-1");
  });

  it("does not save a combination another round saved while this one was writing", async () => {
    // the second read, just before saving, finds the first planned combination made meanwhile
    campaigns.listCampaignPieces
      .mockResolvedValueOnce([pieceFor(order[0])])
      .mockResolvedValue([pieceFor(order[0]), pieceFor(order[1])]);
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(store.saveContent).toHaveBeenCalledTimes(1);
    expect(store.saveContent.mock.calls[0][0].output.ad.combo).toBe(order[2].combo);
    expect(r).toMatchObject({ ok: false, saved: 1, error: expect.stringContaining("1 จาก 2") });
    expect(campaigns.updateCampaign).toHaveBeenCalledWith("c1", { queuePos: 2 });
  });

  it("nothing saved leaves the queue where it was", async () => {
    store.saveContent.mockRejectedValue(new Error("db down"));
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(r.ok).toBe(false);
    expect(campaigns.updateCampaign).not.toHaveBeenCalled();
  });
});

describe("a post or a script", () => {
  it("is written as before: no campaign is read, none is saved", async () => {
    await generateContent({ ...sent, format: "post", campaignId: "c1" }).catch(() => {});
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    expect(write.writeAdVariants).not.toHaveBeenCalled();
    for (const [row] of store.saveContent.mock.calls) expect(row.campaignId ?? null).toBeNull();
  });
});
