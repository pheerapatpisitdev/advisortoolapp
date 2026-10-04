import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ads are written into a campaign (Ads Studio, 2026-10-04): the campaign's product, Page and
 * settings stand in for whatever the browser sent, only the owner may write one, and a round
 * without a campaign is refused before anything is counted or written.
 */

const quota = vi.hoisted(() => ({ takeRound: vi.fn(async () => ({ ok: true, paidBy: "staff" })), allowanceOf: vi.fn() }));
const project = vi.hoisted(() => ({ projectPage: vi.fn() }));
const campaigns = vi.hoisted(() => ({ getCampaign: vi.fn() }));
const write = vi.hoisted(() => ({ writeAds: vi.fn() }));
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
vi.mock("@/lib/auth/pages", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/pages")>()), projectPage: project.projectPage }));
vi.mock("@/lib/ads/campaign-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/campaign-store")>()), ...campaigns }));
vi.mock("@/lib/content/ceiling", () => ({ ceilingBeforeRound: vi.fn(async () => null) }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/content/write", async (orig) => ({ ...(await orig<typeof import("@/lib/content/write")>()), ...write }));

const { generateContent } = await import("@/app/studio/actions");

const campaign = {
  id: "c1", createdAt: "2026-10-04T00:00:00Z", pageId: "P1", planHref: "/lifeprotect", name: null,
  angles: 3, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null,
};
const output = {
  hooks: ["h"], angle: "a", body: "b", closing: "c", hashtags: [], imagePrompt: "i", disclaimer: "d",
};
// what the browser may send: a different product and Page, and counts of its own
const sent = {
  href: "/ishield", format: "ad" as const, angle: "" as const, custom: "ของเบราว์เซอร์", length: null, count: 1, hookTemplateId: null,
  page: "P9", adAngles: 1, adTones: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  viewer.owner = true;
  project.projectPage.mockImplementation(async (asked?: string) => ({ ok: true, pageId: asked ?? null }));
  campaigns.getCampaign.mockResolvedValue(campaign);
  write.writeAds.mockResolvedValue({
    pieces: [{ output, model: "m", costThb: 1 }], planThb: 0.5, planned: 1, budgetHit: 0,
  });
  store.saveContent.mockImplementation(async (row: Record<string, unknown>) => ({ id: "x", costThb: row.costThb, ...row }));
});

describe("an ad round", () => {
  it("without a campaign is refused before anything is counted or written", async () => {
    expect(await generateContent(sent)).toEqual({ ok: false, error: "โฆษณาย้ายไปทำใน Ads Studio แล้ว" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(write.writeAds).not.toHaveBeenCalled();
    expect(store.saveContent).not.toHaveBeenCalled();
  });

  it("is refused for anyone but the owner", async () => {
    viewer.owner = false;
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "ไม่มีสิทธิ์ใช้ส่วนนี้" });
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    expect(write.writeAds).not.toHaveBeenCalled();
  });

  it("is refused when the campaign is not found", async () => {
    campaigns.getCampaign.mockResolvedValue(null);
    expect(await generateContent({ ...sent, campaignId: "c1" })).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    expect(quota.takeRound).not.toHaveBeenCalled();
    expect(write.writeAds).not.toHaveBeenCalled();
  });

  it("takes its angles, tones and hint from the campaign, not from the browser", async () => {
    const r = await generateContent({ ...sent, campaignId: "c1" });
    expect(r.ok).toBe(true);
    expect(write.writeAds).toHaveBeenCalledTimes(1);
    const call = write.writeAds.mock.calls[0][0];
    expect(call.angles).toBe(3);
    expect(call.tones).toBe(1);
    expect(call.hint).toContain("เน้นครอบครัว");
    expect(call.hint).not.toContain("ของเบราว์เซอร์");
  });

  it("saves every piece into the campaign, on its Page and product", async () => {
    await generateContent({ ...sent, campaignId: "c1" });
    expect(project.projectPage).toHaveBeenCalledWith("P1");
    expect(store.saveContent).toHaveBeenCalledTimes(1);
    expect(store.saveContent.mock.calls[0][0]).toMatchObject({ campaignId: "c1", pageId: "P1", planHref: "/lifeprotect", format: "ad" });
  });
});

describe("a post or a script", () => {
  it("is written as before: no campaign is read, none is saved", async () => {
    write.writeAds.mockClear();
    await generateContent({ ...sent, format: "post", campaignId: "c1" }).catch(() => {});
    expect(campaigns.getCampaign).not.toHaveBeenCalled();
    expect(write.writeAds).not.toHaveBeenCalled();
    for (const [row] of store.saveContent.mock.calls) expect(row.campaignId ?? null).toBeNull();
  });
});
