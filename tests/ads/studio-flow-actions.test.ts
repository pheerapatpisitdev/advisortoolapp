import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The doors of Ads Studio's flow: making a campaign, the room and its sends, and the batch send's
 * buttons. Owner only, and a send only of pieces in the campaign, out of the bin and not yet on
 * Facebook. Nothing here touches the
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

const store = vi.hoisted(() => ({ findLaunch: vi.fn() }));
vi.mock("@/lib/ads/launch-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/launch-store")>()), ...store }));
const launch = vi.hoisted(() => ({ adEffectiveStatus: vi.fn(), thVerifiedIdentity: vi.fn(() => "VID1" as string | null) }));
vi.mock("@/lib/ads/launch", () => launch);
const camps = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  listCampaignPieces: vi.fn(),
  deleteCampaign: vi.fn(),
}));
vi.mock("@/lib/ads/campaign-store", () => camps);
const sends = vi.hoisted(() => ({ sentPieceIds: vi.fn(), listSends: vi.fn(), getSend: vi.fn() }));
vi.mock("@/lib/ads/send-store", () => sends);
const engine = vi.hoisted(() => ({ runSend: vi.fn(), resumeSend: vi.fn(), activateSend: vi.fn(), pauseSend: vi.fn() }));
vi.mock("@/lib/ads/send", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/send")>()), ...engine }));
const g = vi.hoisted(() => ({ graph: vi.fn() }));
vi.mock("@/lib/ads/graph", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/graph")>()), ...g }));
const forms = vi.hoisted(() => ({ listLeadForms: vi.fn() }));
vi.mock("@/lib/ads/lead-forms", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/lead-forms")>()), ...forms }));
const studio = vi.hoisted(() => ({ saveContentEdits: vi.fn(), setContentStatus: vi.fn() }));
vi.mock("@/app/studio/actions", () => studio);

const {
  createAdCampaign, updateAdCampaign, adCampaignRoom,
  sendApproved, retrySend, activateSendAction, pauseSendAction, deleteAdCampaign, leadForms, tableRows,
} = await import("@/app/studio/ads/actions");

const campaign = (over: Record<string, unknown> = {}) => ({
  id: CAMPAIGN, createdAt: "2026-10-04T00:00:00.000Z", pageId: PAGE, planHref: "/lifeprotect", name: "แคมเปญทดสอบ",
  angles: 1, tones: 1, theme: null, hint: "เน้นครอบครัว", agentId: null, brandVoice: "อบอุ่น", ...over,
});

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
    ad: { angle: "ครอบครัว", tone: "อบอุ่น" },
  },
  ...over,
});

const send = (over: Record<string, unknown> = {}) => ({
  id: "S1", createdAt: "2026-10-04T03:00:00.000Z", campaignId: CAMPAIGN, actId: ACT, pageId: PAGE, link: "https://x.test/",
  currency: "THB", dailyBudgetMinor: 15000, objective: "traffic", leadFormId: null, cta: null, metaCampaignId: "MC1", adsetId: "AS1", step: "ads", error: null, claimedAt: null,
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
  camps.deleteCampaign.mockResolvedValue(undefined);
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
  forms.listLeadForms.mockResolvedValue({ ok: true, tosAccepted: true, forms: [{ id: "777", name: "ขอใบเสนอราคา" }] });
});

describe("who may use the actions", () => {
  it("refuses everyone but the owner, before anything is read, held or sent", async () => {
    who.owner = false;
    await expect(sendApproved({ campaignId: CAMPAIGN, actId: ACT, link: "https://x.test/", dailyBudgetBaht: 150, pieceIds: ["p1"] })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(retrySend("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(activateSendAction("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(pauseSendAction("S1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(leadForms(CAMPAIGN, ACT)).rejects.toThrow("ไม่มีสิทธิ์");
    for (const spy of [
      forms.listLeadForms,
      ...Object.values(content), ...Object.values(camps), ...Object.values(sends), ...Object.values(engine),
      pages.myPages, conn.adManageAccounts, conn.adManageToken, store.findLaunch, g.graph, who.audit,
    ]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("making a campaign from the wizard", () => {
  const made = (over: Record<string, unknown> = {}) =>
    createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", ...over } as Parameters<typeof createAdCampaign>[0]);

  it("makes a campaign without dimensions, keeping the brand voice trimmed to 120", async () => {
    expect(await made({ brandVoice: ` ${"ว".repeat(130)} `, hint: "  " })).toEqual({ ok: true, id: CAMPAIGN });
    const arg = camps.createCampaign.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toMatchObject({ brandVoice: "ว".repeat(120), hint: null });
    expect(arg).not.toHaveProperty("dimensions");
  });

  it("keeps no brand voice when none is given", async () => {
    await made();
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ brandVoice: null }));
  });

  it("refuses a plan Studio does not know, or a Page that is not connected, and makes nothing", async () => {
    expect(await made({ planHref: "/nope" })).toMatchObject({ ok: false });
    expect(await made({ pageId: "999" })).toMatchObject({ ok: false });
    expect(camps.createCampaign).not.toHaveBeenCalled();
  });
});

describe("a campaign's ภาพและโมเดล", () => {
  const PERSON = { id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", pose: "arms" };

  it("keeps the picks made in the wizard, and only ids from the lists", async () => {
    await createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", writer: "cheap", painter: "gemini", person: PERSON, pictureBrief: "  สวน  " });
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ writer: "cheap", painter: "gemini", person: PERSON, pictureBrief: "สวน" }));
    await createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", writer: "claude-opus", painter: "none", person: { id: "x", pose: "arms" }, pictureBrief: "  " });
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ writer: null, painter: null, person: null, pictureBrief: null }));
  });

  it("saves changed picks from the settings, cleaned the same way", async () => {
    expect(await updateAdCampaign(CAMPAIGN, { writer: "best", painter: "auto", person: null, pictureBrief: " ทะเล " })).toEqual({ ok: true });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { writer: "best", painter: null, person: null, pictureBrief: "ทะเล" });
  });
});

describe("changing a campaign's voice", () => {
  it("saves a trimmed voice", async () => {
    expect(await updateAdCampaign(CAMPAIGN, { brandVoice: ` ${"ว".repeat(130)} ` })).toEqual({ ok: true });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { brandVoice: "ว".repeat(120) });
  });

  it("clears the voice when it is blanked", async () => {
    await updateAdCampaign(CAMPAIGN, { brandVoice: "   " });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { brandVoice: null });
  });
});

describe("the room's sends", () => {
  it("carries no queue, no legacy list and no dimensions, and no variant on a piece", async () => {
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room).not.toHaveProperty("queue");
    expect(room).not.toHaveProperty("legacy");
    expect(room.campaign).not.toHaveProperty("dimensions");
    expect(room.pieces[0]).not.toHaveProperty("variant");
    expect(room.campaign.brandVoice).toBe("อบอุ่น");
  });

  it("keeps a piece approved before this change (status used) in the draft tab", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("p1", { status: "used" }), piece("p2", { status: "draft" }), piece("p3", { status: "trashed" })]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pieces.map((p) => p.tab)).toEqual(["draft", "draft", "trash"]);
    expect(room.counts).toEqual({ all: 2, draft: 2, sent: 0, trash: 1 });
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
    expect(room.counts).toMatchObject({ sent: 2, draft: 0 });
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

  it("puts a piece with a launch from before sends in the sent tab", async () => {
    store.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === "p2"
      ? { id: "L1", pieceId: "p2", actId: ACT, pageId: PAGE, step: "ad", adId: "LAD", campaignId: "C1", adsetId: "S1", error: null, activatedAt: null, claimedAt: null, dailyBudgetMinor: 20000, link: "https://x.test/", superseded: false, createdAt: "2026-10-04T02:00:00Z" }
      : null));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pieces.map((p) => p.tab)).toEqual(["draft", "sent"]);
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

describe("sending ticked ads", () => {
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
      objective: "traffic",
    });
    expect(forms.listLeadForms).not.toHaveBeenCalled();
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S1", expect.objectContaining({ ok: true, campaignId: CAMPAIGN, actId: ACT, pageId: PAGE }));
    expect(JSON.stringify(res)).not.toContain(SECRET);
  });

  it("sends a draft and a piece approved before this change (status used), alike", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("d", { status: "draft" }), piece("u", { status: "used" })]);
    const res = await go({ pieceIds: ["d", "u"] });
    expect(res).toMatchObject({ ok: true, skipped: [] });
    expect((engine.runSend.mock.calls[0][0] as { pieces: { id: string }[] }).pieces.map((p) => p.id)).toEqual(["d", "u"]);
  });

  it("leaves out pieces binned, not in this campaign, already in a live send or launched before, with reasons", async () => {
    camps.listCampaignPieces.mockResolvedValue([
      piece("ok"), piece("draft", { status: "draft" }), piece("binned", { status: "trashed" }), piece("in-send"), piece("launched"),
    ]);
    sends.sentPieceIds.mockResolvedValue(new Set(["in-send"]));
    store.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === "launched" ? { id: "L1", pieceId } : null));
    engine.runSend.mockResolvedValueOnce({ ok: true, send: send(), items: [], skipped: [{ pieceId: "ok", reason: "ชิ้นนี้ยังไม่มีโปสเตอร์" }] });

    const res = await go({ pieceIds: ["ok", "draft", "binned", "elsewhere", "in-send", "launched", "ok"] });
    const arg = engine.runSend.mock.calls[0][0] as { pieces: { id: string }[] };
    expect(arg.pieces.map((p) => p.id)).toEqual(["ok", "draft"]);
    if (!res.ok) throw new Error("send refused");
    const reasons = Object.fromEntries(res.skipped.map((s) => [s.pieceId, s.reason]));
    expect(Object.keys(reasons).sort()).toEqual(["binned", "elsewhere", "in-send", "launched", "ok"]);
    expect(reasons.binned).toContain("ถังขยะ");
    expect(reasons.elsewhere).toContain("แคมเปญ");
    expect(reasons["in-send"]).toContain("ส่ง");
    expect(reasons.launched).toContain("ส่ง");
    expect(reasons.ok).toBe("ชิ้นนี้ยังไม่มีโปสเตอร์");
  });

  it("leaves out a ticked piece that was binned or sent in another tab meanwhile, and sends nothing when only those were ticked", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("binned", { status: "trashed" }), piece("gone-live")]);
    sends.sentPieceIds.mockResolvedValue(new Set(["gone-live"]));
    const res = await go({ pieceIds: ["binned", "gone-live"] });
    expect(res).toMatchObject({ ok: false, step: "check" });
    expect(!res.ok && res.skipped?.map((s) => s.pieceId)).toEqual(["binned", "gone-live"]);
    expect(engine.runSend).not.toHaveBeenCalled();
  });

  it("does not call runSend when no piece is left, and says why", async () => {
    camps.listCampaignPieces.mockResolvedValue([piece("binned", { status: "trashed" })]);
    const res = await go({ pieceIds: ["binned"] });
    expect(res).toMatchObject({ ok: false, step: "check", skipped: [{ pieceId: "binned" }] });
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
    // the poster alone decides: a piece whose ad holds no style (a long ad) waits for its picture too
    expect(res.skipped).toEqual([
      { pieceId: "bare", reason: expect.stringContaining("วาด") },
      { pieceId: "old", reason: expect.stringContaining("วาด") },
    ]);
    expect((engine.runSend.mock.calls[0][0] as { pieces: { id: string }[] }).pieces.map((p) => p.id)).toEqual(["p1"]);
    const deps = engine.runSend.mock.calls[0][1] as { poster: (id: string) => Promise<Buffer | null>; token: (a: string) => Promise<string | null> };
    expect(await deps.poster("p1")).toEqual(Buffer.from("png"));
    expect(draw.drawPoster).toHaveBeenLastCalledWith(expect.objectContaining({ background: "p1/bg.png" }), "square");
    expect(await deps.poster("bare")).toBeNull();
    expect(await deps.poster("old")).toBeNull();
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

describe("sending ticked ads as messages", () => {
  it("hands runSend a messages send without a form or button, asking Meta for no forms", async () => {
    const res = await sendApproved({
      campaignId: CAMPAIGN, actId: ACT, link: "", dailyBudgetBaht: 150, pieceIds: ["p1"],
      objective: "messages", leadFormId: "777", cta: "GET_QUOTE",
    });
    expect(res.ok).toBe(true);
    expect(forms.listLeadForms).not.toHaveBeenCalled();
    const [arg] = engine.runSend.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(arg).toMatchObject({ objective: "messages", pageId: PAGE });
    expect(arg).not.toHaveProperty("leadFormId");
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S1", expect.objectContaining({ objective: "messages" }));
  });

  it("takes an objective it does not know as traffic", async () => {
    await sendApproved({ campaignId: CAMPAIGN, actId: ACT, link: "https://x.test/", dailyBudgetBaht: 150, pieceIds: ["p1"], objective: "bogus" as never });
    expect((engine.runSend.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ objective: "traffic" });
  });
});

describe("sending ticked ads as a lead form", () => {
  const go = (over: Record<string, unknown> = {}) => sendApproved({
    campaignId: CAMPAIGN, actId: ACT, link: "", dailyBudgetBaht: 150, pieceIds: ["p1"],
    objective: "leads", leadFormId: "777", cta: "GET_QUOTE", ...over,
  });

  it("checks the form on the campaign's Page with the account's token, then hands runSend the form and button", async () => {
    const res = await go();
    expect(res.ok).toBe(true);
    expect(forms.listLeadForms).toHaveBeenCalledWith(PAGE, SECRET);
    const [arg] = engine.runSend.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(arg).toMatchObject({ objective: "leads", leadFormId: "777", cta: "GET_QUOTE", pageId: PAGE });
    expect(who.audit).toHaveBeenCalledWith("ads-send", "S1", expect.objectContaining({ objective: "leads" }));
  });

  it("refuses a form that is not an active form of the Page, before Meta is asked to make anything", async () => {
    const res = await go({ leadFormId: "999" });
    expect(res).toMatchObject({ ok: false, step: "check" });
    expect(!res.ok && res.error).toContain("ฟอร์มนี้ไม่อยู่ในเพจหรือถูกปิดแล้ว");
    expect(engine.runSend).not.toHaveBeenCalled();
  });

  it("refuses when the Page has not accepted the lead-ads terms", async () => {
    forms.listLeadForms.mockResolvedValue({ ok: true, tosAccepted: false, forms: [] });
    const res = await go();
    expect(!res.ok && res.error).toContain("ยังไม่ได้ยอมรับเงื่อนไขแอดลีด");
    expect(engine.runSend).not.toHaveBeenCalled();
  });

  it("passes on Meta's refusal to list the forms", async () => {
    forms.listLeadForms.mockResolvedValue({ ok: false, error: "Facebook ไม่รับ — no permission" });
    const res = await go();
    expect(!res.ok && res.error).toContain("no permission");
    expect(engine.runSend).not.toHaveBeenCalled();
  });
});

describe("listing a campaign Page's lead forms", () => {
  it("answers what Meta lists for the campaign's Page, read with the chosen account's token", async () => {
    expect(await leadForms(CAMPAIGN, ACT)).toEqual({ ok: true, tosAccepted: true, forms: [{ id: "777", name: "ขอใบเสนอราคา" }] });
    expect(forms.listLeadForms).toHaveBeenCalledWith(PAGE, SECRET);
    expect(conn.adManageToken).toHaveBeenCalledWith(ACT);
  });

  it.each([
    ["an unknown campaign", () => camps.getCampaign.mockResolvedValue(null)],
    ["an account that is not connected", () => conn.adManageAccounts.mockResolvedValue([])],
    ["a Page no longer connected", () => pages.myPages.mockResolvedValue([])],
    ["no token for the account", () => conn.adManageToken.mockResolvedValue(null)],
  ])("refuses %s without asking Meta", async (_n, arrange) => {
    arrange();
    const out = await leadForms(CAMPAIGN, ACT);
    expect(out.ok).toBe(false);
    expect(forms.listLeadForms).not.toHaveBeenCalled();
  });

  it("names a lead send's objective in the room", async () => {
    sends.listSends.mockResolvedValue([send({ objective: "leads", leadFormId: "777", cta: "GET_QUOTE", link: "http://fb.me/" })]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.sends[0].objective).toBe("leads");
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

describe("deleting a campaign", () => {
  it("deletes a campaign with nothing switched on, and records it", async () => {
    expect(await deleteAdCampaign(CAMPAIGN)).toEqual({ ok: true });
    expect(camps.deleteCampaign).toHaveBeenCalledWith(CAMPAIGN);
    expect(who.audit).toHaveBeenCalledWith("ads-campaign-delete", CAMPAIGN, expect.objectContaining({ ok: true, pageId: PAGE }));
  });

  it("deletes one whose send was sent and never switched on, or paused since", async () => {
    sends.listSends.mockResolvedValueOnce([send(), send({ id: "S2", activatedAt: "2026-10-04T04:00:00.000Z", pausedAt: "2026-10-04T05:00:00.000Z" })]);
    expect(await deleteAdCampaign(CAMPAIGN)).toEqual({ ok: true });
  });

  it("deletes a campaign whose send is switched on, leaving the ads on Facebook, and logs it", async () => {
    // owner, 2026-10-05: what was sent runs on in Ads Manager; Studio only forgets the campaign
    sends.listSends.mockResolvedValueOnce([send({ activatedAt: "2026-10-04T06:00:00.000Z", pausedAt: "2026-10-04T05:00:00.000Z" })]);
    expect(await deleteAdCampaign(CAMPAIGN)).toEqual({ ok: true });
    expect(camps.deleteCampaign).toHaveBeenCalledWith(CAMPAIGN);
    expect(who.audit).toHaveBeenCalledWith("ads-campaign-delete", CAMPAIGN, expect.objectContaining({ live: 1 }));
  });

  it("counts a send paused after it was switched on as not live", async () => {
    sends.listSends.mockResolvedValueOnce([send({ activatedAt: "2026-10-04T05:00:00.000Z", pausedAt: "2026-10-04T06:00:00.000Z" })]);
    expect(await deleteAdCampaign(CAMPAIGN)).toEqual({ ok: true });
    expect(who.audit).toHaveBeenCalledWith("ads-campaign-delete", CAMPAIGN, expect.objectContaining({ live: 0 }));
  });

  it("says when there is no such campaign, and is the owner's alone", async () => {
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await deleteAdCampaign(CAMPAIGN)).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    who.owner = false;
    await expect(deleteAdCampaign(CAMPAIGN)).rejects.toThrow();
    expect(camps.deleteCampaign).not.toHaveBeenCalled();
  });

  it("refuses rather than deletes when the sends cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    sends.listSends.mockRejectedValueOnce(new Error("boom secret"));
    const res = await deleteAdCampaign(CAMPAIGN);
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("boom secret");
    expect(camps.deleteCampaign).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("the headline's rows on the writing form — the 2026-10-05 ad", () => {
  it("are the campaign's table rows at that age, by index", async () => {
    camps.getCampaign.mockResolvedValue(campaign());
    const res = await tableRows(CAMPAIGN, 35);
    expect(res).toEqual({
      ok: true,
      rows: [500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000].map((n, index) => ({ index, heading: `ประกันชีวิตคุ้มครอง ${n.toLocaleString("en-US")} บาท` })),
      middle: 2,
    });
  });

  it("refuse an age that is not a whole year from 0 to 80, and an age the plan cannot price", async () => {
    camps.getCampaign.mockResolvedValue(campaign({ planHref: "/ishield" }));
    for (const age of [-1, 81, 30.5, Number.NaN]) expect((await tableRows(CAMPAIGN, age)).ok, String(age)).toBe(false);
    expect(await tableRows(CAMPAIGN, 55)).toEqual({ ok: false, error: "อายุ 55 ปี แบบนี้คิดเบี้ยไม่ได้ ลองอายุอื่น" });
  });

  it("refuse a campaign whose Page is no longer connected, as the round does", async () => {
    camps.getCampaign.mockResolvedValue(campaign());
    pages.myPages.mockResolvedValue([]);
    expect(await tableRows(CAMPAIGN, 30)).toEqual({ ok: false, error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
  });

  it("are the owner's alone, and say when the campaign is gone", async () => {
    camps.getCampaign.mockResolvedValue(null);
    expect(await tableRows(CAMPAIGN, 30)).toEqual({ ok: false, error: "ไม่พบแคมเปญนี้" });
    who.owner = false;
    await expect(tableRows(CAMPAIGN, 30)).rejects.toThrow("ไม่มีสิทธิ์ใช้ส่วนนี้");
  });
});
