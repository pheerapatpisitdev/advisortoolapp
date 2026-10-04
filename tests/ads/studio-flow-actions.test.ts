import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The doors of Ads Studio's new flow: the wizard's analysis, the room's queue and sends, and the
 * batch send's buttons. Owner only, every spend held before the AI is asked, and a send only of
 * pieces that are approved, in the campaign and not yet on Facebook. Nothing here touches the
 * database or Meta: the stores, the engines and Graph are all fakes.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

const SECRET = "SECRET-ADS-MANAGE-TOKEN";
const ACT = "act_111";
const PAGE = "222";
const CAMPAIGN = "5a6b7c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";

const who = vi.hoisted(() => ({ owner: true, audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return {
    ...asOwner,
    requireStaff: async () => {
      if (!who.owner) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return OWNER;
    },
    audit: who.audit,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const content = vi.hoisted(() => ({
  getContent: vi.fn(),
  holdContentBudget: vi.fn(),
  releaseContentBudget: vi.fn(),
  contentCap: vi.fn(),
  contentSpentThisMonth: vi.fn(),
}));
vi.mock("@/lib/content/store", () => content);
const draw = vi.hoisted(() => ({ drawPoster: vi.fn(async () => Buffer.from("png")) }));
vi.mock("@/lib/content/poster-draw", () => draw);
const pages = vi.hoisted(() => ({ myPages: vi.fn() }));
vi.mock("@/lib/auth/pages", () => pages);

const conn = vi.hoisted(() => ({
  adManageAccounts: vi.fn(),
  adManageToken: vi.fn(),
  saveAdManageAccount: vi.fn(),
  readPendingAdsManage: vi.fn(),
  clearPendingAdsManage: vi.fn(),
}));
vi.mock("@/lib/facebook/ads-manage-connection", () => conn);
const fb = vi.hoisted(() => ({
  listAdAccounts: vi.fn(),
  tokenExpiry: vi.fn(),
  adsManageOauthIsConfigured: vi.fn(() => true),
  adsManageMissingEnv: vi.fn((): string[] => []),
}));
vi.mock("@/lib/facebook/oauth", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/oauth")>()), ...fb }));

const store = vi.hoisted(() => ({ findLaunch: vi.fn(), getLaunch: vi.fn() }));
vi.mock("@/lib/ads/launch-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/launch-store")>()), ...store }));
const launch = vi.hoisted(() => ({ runLaunch: vi.fn(), activateLaunch: vi.fn(), adEffectiveStatus: vi.fn(), thVerifiedIdentity: vi.fn(() => "VID1" as string | null) }));
vi.mock("@/lib/ads/launch", () => launch);
const camps = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  listCampaignPieces: vi.fn(),
}));
vi.mock("@/lib/ads/campaign-store", () => camps);
const sends = vi.hoisted(() => ({ sentPieceIds: vi.fn(), listSends: vi.fn(), getSend: vi.fn() }));
vi.mock("@/lib/ads/send-store", () => sends);
const engine = vi.hoisted(() => ({ runSend: vi.fn(), resumeSend: vi.fn(), activateSend: vi.fn(), pauseSend: vi.fn() }));
vi.mock("@/lib/ads/send", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/send")>()), ...engine }));
const g = vi.hoisted(() => ({ graph: vi.fn() }));
vi.mock("@/lib/ads/graph", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/graph")>()), ...g }));
const ai = vi.hoisted(() => ({ analyzeDimensions: vi.fn() }));
vi.mock("@/lib/ads/analyze", () => ai);
const studio = vi.hoisted(() => ({ saveContentEdits: vi.fn(), setContentStatus: vi.fn() }));
vi.mock("@/app/studio/actions", () => studio);

const {
  analyzeCampaignDraft, analyzeCampaign, createAdCampaign, updateAdCampaign, adCampaignRoom,
  sendApproved, retrySend, activateSendAction, pauseSendAction,
} = await import("@/app/studio/ads/actions");

const dims = (over: Record<string, unknown> = {}) => ({
  hooks: [{ text: "ฮุก 1", note: "" }, { text: "ฮุก 2", note: "" }],
  personas: [{ text: "พ่อแม่", note: "" }],
  angles: [{ text: "มุม 1", note: "" }],
  styles: [{ text: "ภาพถ่าย", note: "แสงธรรมชาติ" }],
  ...over,
});

const campaign = (over: Record<string, unknown> = {}) => ({
  id: CAMPAIGN, createdAt: "2026-10-04T00:00:00.000Z", pageId: PAGE, planHref: "/lifeprotect", name: "แคมเปญทดสอบ",
  angles: 1, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null, dimensions: dims(), queuePos: 0, brandVoice: "อบอุ่น", ...over,
});

const ad = (combo: string, over: Record<string, unknown> = {}) => {
  const [hook, persona, angle, style] = combo.split("|");
  return { angle, tone: persona, hook, persona, style, combo, ...over };
};

const piece = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  createdAt: "2026-10-04T01:00:00.000Z",
  status: "used",
  format: "ad",
  campaignId: CAMPAIGN,
  flags: {},
  output: {
    hooks: [`หัวข้อ ${id}`], body: `ข้อความ ${id}`, closing: `คำอธิบาย ${id}`,
    poster: { layout: "square", theme: "navy", blocks: [], background: `${id}/bg.png` },
    ad: ad("ฮุก 1|พ่อแม่|มุม 1|ภาพถ่าย"),
  },
  ...over,
});

const send = (over: Record<string, unknown> = {}) => ({
  id: "S1", createdAt: "2026-10-04T03:00:00.000Z", campaignId: CAMPAIGN, actId: ACT, pageId: PAGE, link: "https://x.test/",
  currency: "THB", dailyBudgetMinor: 15000, metaCampaignId: "MC1", adsetId: "AS1", step: "ads", error: null, claimedAt: null,
  activatedAt: null, pausedAt: null, superseded: false, createdBy: OWNER_ID,
  items: [
    { id: "I1", sendId: "S1", pieceId: "p1", imageHash: "h1", creativeId: "c1", adId: "AD1", error: null },
    { id: "I2", sendId: "S1", pieceId: "p2", imageHash: null, creativeId: null, adId: null, error: "Facebook ไม่รับ — x" },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  content.getContent.mockImplementation(async (id: string) => piece(id));
  content.contentCap.mockResolvedValue(30);
  content.contentSpentThisMonth.mockResolvedValue(5);
  content.holdContentBudget.mockResolvedValue({ ok: true, id: "HOLD1" });
  content.releaseContentBudget.mockResolvedValue(undefined);
  pages.myPages.mockResolvedValue([{ pageId: PAGE, pageName: "เพจทดสอบ" }]);
  conn.adManageAccounts.mockResolvedValue([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB", connectedAt: "2026-10-01" }]);
  conn.adManageToken.mockResolvedValue(SECRET);
  conn.readPendingAdsManage.mockResolvedValue(null);
  fb.tokenExpiry.mockResolvedValue({ valid: true, expiresAt: "2026-12-01T00:00:00.000Z", dataAccessExpiresAt: null });
  store.findLaunch.mockResolvedValue(null);
  launch.adEffectiveStatus.mockResolvedValue("PAUSED");
  camps.getCampaign.mockResolvedValue(campaign());
  camps.createCampaign.mockImplementation(async (c: Record<string, unknown>) => campaign({ ...c, id: CAMPAIGN }));
  camps.updateCampaign.mockResolvedValue(undefined);
  camps.listCampaignPieces.mockResolvedValue([piece("p1"), piece("p2")]);
  sends.sentPieceIds.mockResolvedValue(new Set<string>());
  sends.listSends.mockResolvedValue([]);
  sends.getSend.mockResolvedValue(send());
  engine.runSend.mockImplementation(async (input: { pieces: { id: string }[] }) => ({
    ok: true, send: send(), items: input.pieces.map((p, i) => ({ id: `I${i}`, sendId: "S1", pieceId: p.id, adId: `AD${i}` })), skipped: [],
  }));
  engine.resumeSend.mockResolvedValue({ ok: true, send: send(), items: [], skipped: [] });
  engine.activateSend.mockResolvedValue({ ok: true });
  engine.pauseSend.mockResolvedValue({ ok: true });
  g.graph.mockResolvedValue({ ok: false, error: "x" });
  ai.analyzeDimensions.mockResolvedValue({ dimensions: dims(), costThb: 0.05, fallback: false });
});

describe("who may use the new actions", () => {
  it("refuses everyone but the owner, before anything is read, held or sent", async () => {
    who.owner = false;
    await expect(analyzeCampaignDraft({ pageId: PAGE, planHref: "/lifeprotect" })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(analyzeCampaign(CAMPAIGN)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(sendApproved({ campaignId: CAMPAIGN, actId: ACT, link: "https://x.test/", dailyBudgetBaht: 150, pieceIds: ["p1"] })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(retrySend("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(activateSendAction("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(pauseSendAction("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    for (const spy of [
      ...Object.values(content), ...Object.values(camps), ...Object.values(sends), ...Object.values(engine), ai.analyzeDimensions,
      pages.myPages, conn.adManageAccounts, conn.adManageToken, store.findLaunch, g.graph, who.audit,
    ]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("the wizard's analysis", () => {
  const draft = (over: Record<string, unknown> = {}) =>
    analyzeCampaignDraft({ pageId: PAGE, planHref: "/lifeprotect", ...over } as Parameters<typeof analyzeCampaignDraft>[0]);

  it("holds the AI's price first, asks with the plan's brief, focus and voice, and gives the hold back", async () => {
    const order: string[] = [];
    content.holdContentBudget.mockImplementation(async () => { order.push("hold"); return { ok: true, id: "HOLD1" }; });
    ai.analyzeDimensions.mockImplementation(async () => { order.push("analyze"); return { dimensions: dims(), costThb: 0.05, fallback: false }; });
    content.releaseContentBudget.mockImplementation(async () => { order.push("release"); });

    expect(await draft({ focus: `  ${"ก".repeat(130)} `, voice: ` ${"ข".repeat(130)} ` })).toEqual({ ok: true, dimensions: dims(), fallback: false });
    expect(order).toEqual(["hold", "analyze", "release"]);
    const [thb, cap] = content.holdContentBudget.mock.calls[0] as unknown as [number, number];
    expect(thb).toBeGreaterThan(0);
    expect(thb).toBeLessThan(1);
    expect(cap).toBe(30);
    expect(content.releaseContentBudget).toHaveBeenCalledWith("HOLD1");
    const asked = ai.analyzeDimensions.mock.calls[0][0] as { brief: string; productName: string; focus: string; voice: string };
    expect(asked.brief).toContain("Life Protect");
    expect(asked.productName).toContain("Life Protect");
    expect(asked.focus).toBe("ก".repeat(120));
    expect(asked.voice).toBe("ข".repeat(120));
  });

  it("says when it fell back to the starting set", async () => {
    ai.analyzeDimensions.mockResolvedValueOnce({ dimensions: dims(), costThb: 0, fallback: true });
    expect(await draft()).toMatchObject({ ok: true, fallback: true });
  });

  it("says plainly that the month's ceiling is full, and asks no AI", async () => {
    content.contentSpentThisMonth.mockResolvedValue(30);
    const res = await draft();
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? "" : res.error).toContain("ครบ");
    expect(content.holdContentBudget).not.toHaveBeenCalled();
    expect(ai.analyzeDimensions).not.toHaveBeenCalled();
  });

  it("says how much is left when the hold does not fit, and asks no AI", async () => {
    content.holdContentBudget.mockResolvedValueOnce({ ok: false, left: 0.01 });
    const res = await draft();
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? "" : res.error).toContain("0.01");
    expect(ai.analyzeDimensions).not.toHaveBeenCalled();
    expect(content.releaseContentBudget).not.toHaveBeenCalled();
  });

  it("refuses a plan Studio does not know or a Page not connected, before holding anything", async () => {
    expect(await draft({ planHref: "/nothing-here" })).toMatchObject({ ok: false });
    expect(await draft({ pageId: "999" })).toMatchObject({ ok: false });
    expect(content.holdContentBudget).not.toHaveBeenCalled();
    expect(ai.analyzeDimensions).not.toHaveBeenCalled();
  });

  it("gives the hold back and answers in Thai when something underneath throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    ai.analyzeDimensions.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await draft();
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    expect(content.releaseContentBudget).toHaveBeenCalledWith("HOLD1");
    log.mockRestore();
  });
});

describe("analysing an older campaign", () => {
  it("asks with the campaign's own focus and voice and saves the dimensions on it", async () => {
    camps.getCampaign.mockResolvedValue(campaign({ dimensions: null }));
    ai.analyzeDimensions.mockResolvedValueOnce({ dimensions: dims({ personas: [{ text: "คนทำงาน", note: "" }] }), costThb: 0.05, fallback: true });
    const res = await analyzeCampaign(CAMPAIGN);
    expect(res).toMatchObject({ ok: true, fallback: true });
    expect(ai.analyzeDimensions.mock.calls[0][0]).toMatchObject({ focus: "เน้นครอบครัว", voice: "อบอุ่น" });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { dimensions: dims({ personas: [{ text: "คนทำงาน", note: "" }] }) });
    expect(content.releaseContentBudget).toHaveBeenCalledWith("HOLD1");
  });

  it("does not spend on a campaign that already has dimensions, or one that is not there", async () => {
    expect(await analyzeCampaign(CAMPAIGN)).toMatchObject({ ok: false });
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await analyzeCampaign(CAMPAIGN)).toMatchObject({ ok: false, error: "ไม่พบแคมเปญนี้" });
    expect(content.holdContentBudget).not.toHaveBeenCalled();
    expect(ai.analyzeDimensions).not.toHaveBeenCalled();
    expect(camps.updateCampaign).not.toHaveBeenCalled();
  });

  it("says the ceiling is full without asking the AI or saving", async () => {
    camps.getCampaign.mockResolvedValue(campaign({ dimensions: null }));
    content.contentSpentThisMonth.mockResolvedValue(31);
    const res = await analyzeCampaign(CAMPAIGN);
    expect(res.ok ? "" : res.error).toContain("ครบ");
    expect(ai.analyzeDimensions).not.toHaveBeenCalled();
    expect(camps.updateCampaign).not.toHaveBeenCalled();
  });
});

describe("making a campaign from the wizard", () => {
  const made = (over: Record<string, unknown> = {}) =>
    createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", dimensions: dims(), ...over } as Parameters<typeof createAdCampaign>[0]);

  it("keeps the cleaned dimensions and the brand voice, trimmed to 120", async () => {
    const messy = dims({ hooks: [{ text: "  ฮุก 1  ", note: " n " }, { text: "ฮุก 1", note: "ซ้ำ" }] });
    expect(await made({ dimensions: messy, brandVoice: ` ${"ว".repeat(130)} `, hint: "  " })).toEqual({ ok: true, id: CAMPAIGN });
    expect(camps.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
      dimensions: dims({ hooks: [{ text: "ฮุก 1", note: "n" }] }), brandVoice: "ว".repeat(120), hint: null,
    }));
  });

  it("keeps no brand voice when none is given", async () => {
    await made();
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ brandVoice: null }));
  });

  it("refuses dimensions with an empty list, or none, and makes nothing", async () => {
    expect(await made({ dimensions: dims({ styles: [] }) })).toEqual({ ok: false, error: "มิติไม่ครบ" });
    expect(await made({ dimensions: undefined })).toEqual({ ok: false, error: "มิติไม่ครบ" });
    expect(await made({ dimensions: dims({ hooks: [{ text: "   ", note: "" }] }) })).toEqual({ ok: false, error: "มิติไม่ครบ" });
    expect(camps.createCampaign).not.toHaveBeenCalled();
  });
});

describe("changing a campaign's dimensions and voice", () => {
  it("saves cleaned dimensions and a trimmed voice", async () => {
    expect(await updateAdCampaign(CAMPAIGN, { dimensions: dims(), brandVoice: ` ${"ว".repeat(130)} ` })).toEqual({ ok: true });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { dimensions: dims(), brandVoice: "ว".repeat(120) });
  });

  it("refuses dimensions that would leave a list empty, and changes nothing", async () => {
    expect(await updateAdCampaign(CAMPAIGN, { dimensions: dims({ angles: [] }), name: "x" })).toEqual({ ok: false, error: "มิติไม่ครบ" });
    expect(camps.updateCampaign).not.toHaveBeenCalled();
  });

  it("clears the voice when it is blanked", async () => {
    await updateAdCampaign(CAMPAIGN, { brandVoice: "   " });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { brandVoice: null });
  });
});

describe("the room's queue, sends and older ads", () => {
  it("shows the next combination not yet made, and how many are made of all", async () => {
    // hooks 2 × 1 × 1 × 1 = 2 combinations; p1 and the binned p3 were both written to the first
    camps.listCampaignPieces.mockResolvedValue([piece("p1"), piece("p3", { status: "trashed" })]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.queue).toEqual({
      next: [{ hook: "ฮุก 2", persona: "พ่อแม่", angle: "มุม 1", style: "ภาพถ่าย", combo: "ฮุก 2|พ่อแม่|มุม 1|ภาพถ่าย" }],
      made: 1,
      total: 2,
    });
    expect(room.campaign.dimensions).toEqual(dims());
    expect(room.campaign.brandVoice).toBe("อบอุ่น");
  });

  it("has an empty next when every combination is made, and no queue without dimensions", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("p1"), piece("p2", { output: { ...piece("p2").output, ad: ad("ฮุก 2|พ่อแม่|มุม 1|ภาพถ่าย") } })]);
    let room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.queue).toEqual({ next: [], made: 2, total: 2 });

    camps.getCampaign.mockResolvedValue(campaign({ dimensions: null }));
    room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.queue).toBeNull();
  });

  it("counts only made combinations the current dimensions still have", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("p1", { output: { ...piece("p1").output, ad: ad("เก่า|พ่อแม่|มุม 1|ภาพถ่าย") } })]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.queue).toMatchObject({ made: 0, total: 2 });
  });

  it("labels each piece with its four dimensions, and older pieces with none", async () => {
    camps.listCampaignPieces.mockResolvedValue([
      piece("p1"),
      piece("old", { output: { hooks: ["h"], body: "b", closing: "c", ad: { angle: "ครอบครัว", tone: "อบอุ่น" } } }),
    ]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pieces[0].variant).toEqual({ hook: "ฮุก 1", persona: "พ่อแม่", angle: "มุม 1", style: "ภาพถ่าย" });
    expect(room.pieces[1].variant).toBeNull();
  });

  it("lays out each send with its ads, puts its pieces in the sent tab, and carries no token or Meta campaign id", async () => {
    sends.listSends.mockResolvedValue([send()]);
    g.graph.mockImplementation(async (_f: unknown, _t: string, path: string) => {
      if (path.startsWith("MC1")) return { ok: true, body: { effective_status: "PAUSED" } };
      if (path.startsWith("AD1")) return { ok: true, body: { effective_status: "PAUSED", created_time: "2026-10-04T03:01:00+0000" } };
      return { ok: false, error: "x" };
    });
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pieces.map((p) => p.tab)).toEqual(["sent", "sent"]);
    expect(room.counts).toMatchObject({ sent: 2, approved: 0 });
    expect(room.sends).toHaveLength(1);
    expect(room.sends[0]).toMatchObject({
      id: "S1", actId: ACT, pageId: PAGE, dailyBudgetBaht: 150, step: "ads", activatedAt: null, pausedAt: null,
      hasMetaCampaign: true, hasAdset: true, running: false, metaStatus: "PAUSED", madeAfterActivation: 0,
      items: [
        { id: "I1", pieceId: "p1", adId: "AD1", error: null, effectiveStatus: "PAUSED", madeAfterActivation: false },
        { id: "I2", pieceId: "p2", adId: null, error: "Facebook ไม่รับ — x", effectiveStatus: null, madeAfterActivation: false },
      ],
    });
    const json = JSON.stringify(room);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("MC1");
    expect(g.graph).toHaveBeenCalledWith(expect.anything(), SECRET, expect.stringContaining("AD1"));
  });

  it("offers pause for a send with a Meta campaign whatever activatedAt says, and says it is running while claimed", async () => {
    sends.listSends.mockResolvedValue([
      send({ id: "S2", activatedAt: null, metaCampaignId: "MC2", claimedAt: new Date().toISOString(), items: [] }),
      send({ id: "S3", metaCampaignId: null, adsetId: null, step: "none", items: [] }),
    ]);
    g.graph.mockImplementation(async (_f: unknown, _t: string, path: string) =>
      path.startsWith("MC2") ? { ok: true, body: { effective_status: "ACTIVE" } } : { ok: false, error: "x" });
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.sends[0]).toMatchObject({ id: "S2", hasMetaCampaign: true, metaStatus: "ACTIVE", running: true });
    expect(room.sends[1]).toMatchObject({ id: "S3", hasMetaCampaign: false, hasAdset: false, metaStatus: null, running: false });
  });

  it("says which ads of a switched-on send were made after it was switched on", async () => {
    sends.listSends.mockResolvedValue([send({
      activatedAt: "2026-10-04T04:00:00.000Z",
      items: [
        { id: "I1", sendId: "S1", pieceId: "p1", imageHash: "h", creativeId: "c", adId: "AD1", error: null },
        { id: "I2", sendId: "S1", pieceId: "p2", imageHash: "h", creativeId: "c", adId: "AD2", error: null },
        { id: "I3", sendId: "S1", pieceId: "p3", imageHash: "h", creativeId: "c", adId: "AD3", error: null },
      ],
    })]);
    g.graph.mockImplementation(async (_f: unknown, _t: string, path: string) => {
      if (path.startsWith("AD1")) return { ok: true, body: { effective_status: "ACTIVE", created_time: "2026-10-04T03:30:00+0000" } };
      if (path.startsWith("AD2")) return { ok: true, body: { effective_status: "PAUSED", created_time: "2026-10-04T04:10:00+0000" } };
      return { ok: false, error: "x" };
    });
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.sends[0].madeAfterActivation).toBe(1);
    expect(room.sends[0].items.map((i) => i.madeAfterActivation)).toEqual([false, true, null]);
  });

  it("lists the ads launched one by one before sends, with the piece each is for", async () => {
    store.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === "p2"
      ? { id: "L1", pieceId: "p2", actId: ACT, pageId: PAGE, step: "ad", adId: "LAD", campaignId: "C1", adsetId: "S1", error: null, activatedAt: null, claimedAt: null, dailyBudgetMinor: 20000, link: "https://x.test/", superseded: false, createdAt: "2026-10-03T00:00:00.000Z" }
      : null));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.legacy).toEqual([expect.objectContaining({ id: "L1", pieceId: "p2", adId: "LAD", dailyBudgetBaht: 200, effectiveStatus: "PAUSED" })]);
    expect(room.pieces[1].tab).toBe("sent");
    expect(room.connection.thIdentity).toBe(true);
  });

  it("still opens when Meta will not say how a send is doing", async () => {
    sends.listSends.mockResolvedValue([send()]);
    g.graph.mockRejectedValue(new Error("meta down"));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.sends[0]).toMatchObject({ metaStatus: null, items: [{ effectiveStatus: null }, { effectiveStatus: null }] });
  });
});

describe("sending approved ads", () => {
  const go = (over: Record<string, unknown> = {}) =>
    sendApproved({ campaignId: CAMPAIGN, actId: ACT, link: "https://x.test/", dailyBudgetBaht: 150, pieceIds: ["p1", "p2"], ...over });

  it("hands runSend the campaign's Page, the account's currency, the asker and each piece's words, and records it", async () => {
    const res = await go();
    expect(res).toMatchObject({ ok: true, skipped: [] });
    expect(engine.runSend).toHaveBeenCalledTimes(1);
    const [arg] = engine.runSend.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(arg).toEqual({
      campaignId: CAMPAIGN, actId: ACT, currency: "THB", pageId: PAGE, link: "https://x.test/", dailyBudgetBaht: 150,
      pieces: [
        { id: "p1", headline: "หัวข้อ p1", primaryText: "ข้อความ p1", description: "คำอธิบาย p1" },
        { id: "p2", headline: "หัวข้อ p2", primaryText: "ข้อความ p2", description: "คำอธิบาย p2" },
      ],
      createdBy: OWNER_ID,
    });
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S1", expect.objectContaining({ ok: true, campaignId: CAMPAIGN, actId: ACT, pageId: PAGE }));
    expect(JSON.stringify(res)).not.toContain(SECRET);
  });

  it("leaves out pieces not approved, not in this campaign, already in a live send or launched before, with reasons", async () => {
    camps.listCampaignPieces.mockResolvedValue([
      piece("ok"), piece("draft", { status: "draft" }), piece("binned", { status: "trashed" }), piece("in-send"), piece("launched"),
    ]);
    sends.sentPieceIds.mockResolvedValue(new Set(["in-send"]));
    store.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === "launched" ? { id: "L1", pieceId } : null));
    engine.runSend.mockResolvedValueOnce({ ok: true, send: send(), items: [], skipped: [{ pieceId: "ok", reason: "ชิ้นนี้ยังไม่มีโปสเตอร์" }] });

    const res = await go({ pieceIds: ["ok", "draft", "binned", "elsewhere", "in-send", "launched", "ok"] });
    const arg = engine.runSend.mock.calls[0][0] as { pieces: { id: string }[] };
    expect(arg.pieces.map((p) => p.id)).toEqual(["ok"]);
    if (!res.ok) throw new Error("send refused");
    const reasons = Object.fromEntries(res.skipped.map((s) => [s.pieceId, s.reason]));
    expect(Object.keys(reasons).sort()).toEqual(["binned", "draft", "elsewhere", "in-send", "launched", "ok"]);
    expect(reasons.draft).toContain("อนุมัติ");
    expect(reasons.binned).toContain("อนุมัติ");
    expect(reasons.elsewhere).toContain("แคมเปญ");
    expect(reasons["in-send"]).toContain("ส่ง");
    expect(reasons.launched).toContain("ส่ง");
    expect(reasons.ok).toBe("ชิ้นนี้ยังไม่มีโปสเตอร์");
  });

  it("does not call runSend when no piece is left, and says why", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("draft", { status: "draft" })]);
    const res = await go({ pieceIds: ["draft"] });
    expect(res).toMatchObject({ ok: false, step: "check", skipped: [{ pieceId: "draft" }] });
    expect(engine.runSend).not.toHaveBeenCalled();
    expect(await go({ pieceIds: [] })).toMatchObject({ ok: false, step: "check" });
    expect(engine.runSend).not.toHaveBeenCalled();
  });

  it("refuses an account not connected, a campaign not there, or one whose Page was disconnected", async () => {
    expect(await go({ actId: "act_999" })).toMatchObject({ ok: false, step: "check" });
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await go()).toMatchObject({ ok: false, step: "check", error: "ไม่พบแคมเปญนี้" });
    camps.getCampaign.mockResolvedValueOnce(campaign({ pageId: "999" }));
    expect(await go()).toMatchObject({ ok: false, step: "check", error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
    expect(engine.runSend).not.toHaveBeenCalled();
  });

  it("refuses rather than sends when the sends or launches cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    sends.sentPieceIds.mockRejectedValueOnce(new Error("db down"));
    expect((await go()).ok).toBe(false);
    store.findLaunch.mockRejectedValueOnce(new Error("db down"));
    expect((await go()).ok).toBe(false);
    expect(engine.runSend).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("gives the engine square posters, none for a piece whose picture is not drawn yet, and none when drawing breaks", async () => {
    camps.listCampaignPieces.mockResolvedValue([
      piece("p1"),
      piece("bare", { output: { ...piece("bare").output, poster: { layout: "square", theme: "navy", blocks: [] } } }),
      piece("old", { output: { hooks: ["h"], body: "b", closing: "c", poster: { layout: "square", theme: "navy", blocks: [] }, ad: { angle: "a", tone: "t" } } }),
    ]);
    const res = await go({ pieceIds: ["p1", "bare", "old"] });
    if (!res.ok) throw new Error("send refused");
    expect(res.skipped).toEqual([{ pieceId: "bare", reason: expect.stringContaining("วาด") }]);
    expect((engine.runSend.mock.calls[0][0] as { pieces: { id: string }[] }).pieces.map((p) => p.id)).toEqual(["p1", "old"]);
    const deps = engine.runSend.mock.calls[0][1] as { poster: (id: string) => Promise<Buffer | null>; token: (a: string) => Promise<string | null> };
    expect(await deps.poster("p1")).toEqual(Buffer.from("png"));
    expect(draw.drawPoster).toHaveBeenLastCalledWith(expect.objectContaining({ background: "p1/bg.png" }), "square");
    expect(await deps.poster("bare")).toBeNull();
    // a piece written before the dimensions had no picture to wait for
    expect(await deps.poster("old")).toEqual(Buffer.from("png"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    draw.drawPoster.mockRejectedValueOnce(new Error("canvas"));
    expect(await deps.poster("p1")).toBeNull();
    log.mockRestore();
    expect(await deps.token(ACT)).toBe(SECRET);
  });

  it("gives the engine each piece's words for a resume", async () => {
    await go();
    const deps = engine.runSend.mock.calls[0][1] as { piece: (id: string) => Promise<unknown> };
    expect(await deps.piece("p2")).toEqual({ headline: "หัวข้อ p2", primaryText: "ข้อความ p2", description: "คำอธิบาย p2" });
    content.getContent.mockResolvedValueOnce(null);
    expect(await deps.piece("gone")).toBeNull();
  });

  it("audits a send that failed, and turns a throw into a Thai answer", async () => {
    engine.runSend.mockResolvedValueOnce({ ok: false, step: "adset", error: "Facebook ไม่รับ — x", send: send({ id: "S9" }) });
    expect(await go()).toMatchObject({ ok: false, step: "adset" });
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S9", expect.objectContaining({ ok: false, step: "adset" }));

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    engine.runSend.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await go();
    expect(res).toMatchObject({ ok: false, step: "check" });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    expect(who.audit).toHaveBeenLastCalledWith("ads-send", CAMPAIGN, expect.objectContaining({ ok: false }));
    log.mockRestore();
  });
});

describe("retrying, switching on and pausing a send", () => {
  it("retries through resumeSend with the same sources, and records it", async () => {
    expect(await retrySend("S1")).toMatchObject({ ok: true });
    const [id, deps] = engine.resumeSend.mock.calls[0] as unknown as [string, { piece: (id: string) => Promise<unknown>; poster: (id: string) => Promise<unknown> }];
    expect(id).toBe("S1");
    expect(await deps.piece("p1")).toEqual({ headline: "หัวข้อ p1", primaryText: "ข้อความ p1", description: "คำอธิบาย p1" });
    expect(await deps.poster("p1")).toEqual(Buffer.from("png"));
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S1", expect.objectContaining({ ok: true, retry: true }));
  });

  it("switches a whole send on, and records every press, a failed one too", async () => {
    expect(await activateSendAction("S1")).toEqual({ ok: true });
    expect(engine.activateSend).toHaveBeenCalledWith("S1", expect.objectContaining({ store: expect.anything(), token: expect.any(Function) }));
    expect(who.audit).toHaveBeenCalledWith("ads-send-activate", "S1", expect.objectContaining({ ok: true, actId: ACT, pageId: PAGE, dailyBudgetMinor: 15000 }));
    engine.activateSend.mockResolvedValueOnce({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" });
    expect(await activateSendAction("S1")).toEqual({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" });
    expect(who.audit).toHaveBeenLastCalledWith("ads-send-activate", "S1", expect.objectContaining({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" }));
  });

  it("pauses a whole send, and records it", async () => {
    expect(await pauseSendAction("S1")).toEqual({ ok: true });
    expect(engine.pauseSend).toHaveBeenCalledWith("S1", expect.objectContaining({ store: expect.anything() }));
    expect(who.audit).toHaveBeenCalledWith("ads-send-pause", "S1", expect.objectContaining({ ok: true }));
  });

  it("turns a throw into a Thai answer, and still records the press", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    engine.activateSend.mockRejectedValueOnce(new Error("boom secret"));
    engine.pauseSend.mockRejectedValueOnce(new Error("boom secret"));
    engine.resumeSend.mockRejectedValueOnce(new Error("boom secret"));
    for (const res of [await activateSendAction("S1"), await pauseSendAction("S1"), await retrySend("S1")]) {
      expect(res).toMatchObject({ ok: false });
      expect(JSON.stringify(res)).not.toContain("boom secret");
    }
    expect(who.audit).toHaveBeenCalledWith("ads-send-activate", "S1", expect.objectContaining({ ok: false }));
    expect(who.audit).toHaveBeenCalledWith("ads-send-pause", "S1", expect.objectContaining({ ok: false }));
    log.mockRestore();
  });
});
