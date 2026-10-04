import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The doors /studio/ads calls. Everything that spends or connects is the owner's alone, a piece
 * that cannot be launched never reaches runLaunch, and whatever breaks underneath comes back as
 * a Thai sentence rather than a 500. Nothing here touches the database or Meta.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

const SECRET = "SECRET-ADS-MANAGE-TOKEN";
const PIECE = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const ACT = "act_111";
const PAGE = "222";
const CAMPAIGN = "5a6b7c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d";

const who = vi.hoisted(() => ({ owner: true, audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return {
    ...asOwner,
    // the real one throws for anyone without the permission; the tests only need that much of it
    requireStaff: async () => {
      if (!who.owner) throw new Error("ไม่มีสิทธิ์ใช้ส่วนนี้");
      return OWNER;
    },
    audit: who.audit,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const content = vi.hoisted(() => ({ getContent: vi.fn() }));
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
const launch = vi.hoisted(() => ({ runLaunch: vi.fn(), activateLaunch: vi.fn(), adEffectiveStatus: vi.fn() }));
vi.mock("@/lib/ads/launch", () => launch);
const camps = vi.hoisted(() => ({
  listCampaigns: vi.fn(),
  getCampaign: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  listCampaignPieces: vi.fn(),
}));
vi.mock("@/lib/ads/campaign-store", () => camps);
// Organic Studio's save, which checks and keeps an edit; Ads Studio only decides who may call it
const studio = vi.hoisted(() => ({ saveContentEdits: vi.fn(), setContentStatus: vi.fn() }));
vi.mock("@/app/studio/actions", () => studio);

const {
  launchAd, chooseAdManageAccount, activateAd,
  adsStudioHome, createAdCampaign, adCampaignRoom, updateAdCampaign, saveAdCopy, setAdStatus,
} = await import("@/app/studio/ads/actions");

const piece = (over: Record<string, unknown> = {}) => ({
  id: PIECE,
  createdAt: "2026-10-04T01:00:00.000Z",
  status: "draft",
  format: "ad",
  campaignId: CAMPAIGN,
  flags: { numbers: [], words: [], fixes: null },
  output: { hooks: ["หัวข้อโฆษณา"], body: "ข้อความหลัก", closing: "คำอธิบาย", poster: { theme: "navy", blocks: [] } },
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: "L1", pieceId: PIECE, actId: ACT, pageId: PAGE, step: "ad", adId: "AD1", campaignId: "C1", adsetId: "S1",
  error: null, activatedAt: null, claimedAt: null, dailyBudgetMinor: 15000, link: "https://x.test/", superseded: false,
  ...over,
});

const campaign = (over: Record<string, unknown> = {}) => ({
  id: CAMPAIGN, createdAt: "2026-10-04T00:00:00.000Z", pageId: PAGE, planHref: "/lifeprotect", name: "แคมเปญทดสอบ",
  angles: 2, tones: 1, theme: null, hint: null, agentId: null, ...over,
});

const input = (over: Record<string, unknown> = {}) => ({
  pieceId: PIECE, actId: ACT, link: "https://x.test/", dailyBudgetBaht: 150,
  headline: "หัวข้อ", primaryText: "ข้อความ", description: "คำอธิบาย", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  content.getContent.mockResolvedValue(piece());
  pages.myPages.mockResolvedValue([{ pageId: PAGE, pageName: "เพจทดสอบ" }]);
  conn.adManageAccounts.mockResolvedValue([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB", connectedAt: "2026-10-01" }]);
  conn.adManageToken.mockResolvedValue(SECRET);
  conn.readPendingAdsManage.mockResolvedValue({ token: SECRET, scopes: ["ads_management"] });
  fb.listAdAccounts.mockResolvedValue([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB" }]);
  fb.tokenExpiry.mockResolvedValue({ valid: true, expiresAt: "2026-12-01T00:00:00.000Z", dataAccessExpiresAt: null });
  store.findLaunch.mockResolvedValue(null);
  store.getLaunch.mockResolvedValue(row());
  launch.runLaunch.mockResolvedValue({ ok: true, launch: row() });
  launch.activateLaunch.mockResolvedValue({ ok: true });
  launch.adEffectiveStatus.mockResolvedValue("PAUSED");
  camps.listCampaigns.mockResolvedValue([campaign()]);
  camps.getCampaign.mockResolvedValue(campaign());
  camps.createCampaign.mockImplementation(async (c: Record<string, unknown>) => campaign({ ...c, id: CAMPAIGN }));
  camps.updateCampaign.mockResolvedValue(undefined);
  camps.listCampaignPieces.mockResolvedValue([piece()]);
  studio.saveContentEdits.mockResolvedValue({ ok: true, item: piece() });
  studio.setContentStatus.mockResolvedValue({ ok: true });
});

describe("who may use the actions", () => {
  it("refuses everyone but the owner, on every action, before anything is read or written", async () => {
    who.owner = false;
    await expect(launchAd(input())).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(chooseAdManageAccount(ACT)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(activateAd("L1")).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(adsStudioHome(PAGE)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", angles: 1, tones: 1 })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(adCampaignRoom(CAMPAIGN)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(updateAdCampaign(CAMPAIGN, { name: "x" })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(saveAdCopy(PIECE, { hooks: ["h"], body: "b", closing: "c", hashtags: [] })).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(setAdStatus(PIECE, "trashed")).rejects.toThrow("ไม่มีสิทธิ์");
    for (const spy of [
      launch.runLaunch, launch.activateLaunch, conn.saveAdManageAccount, conn.adManageAccounts, content.getContent, who.audit,
      pages.myPages, ...Object.values(camps), studio.saveContentEdits, studio.setContentStatus, store.findLaunch,
    ]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("launching an ad", () => {
  it("does not call runLaunch for a piece that is gone, in the bin, a post, or without a poster", async () => {
    const cases = [
      null,
      piece({ status: "trashed" }),
      piece({ format: "post" }),
      piece({ output: { hooks: ["h"], body: "b", closing: "c" } }),
    ];
    for (const c of cases) {
      content.getContent.mockResolvedValueOnce(c);
      expect(await launchAd(input())).toMatchObject({ ok: false });
    }
    expect(launch.runLaunch).not.toHaveBeenCalled();
  });

  it("refuses an ad account the owner has not connected", async () => {
    expect(await launchAd(input({ actId: "act_999" }))).toMatchObject({ ok: false });
    expect(launch.runLaunch).not.toHaveBeenCalled();
  });

  it("builds on the campaign's Page, and refuses when that Page is no longer connected", async () => {
    camps.getCampaign.mockResolvedValueOnce(campaign({ pageId: "999" }));
    expect(await launchAd(input())).toEqual({ ok: false, step: "check", error: "เพจนี้ไม่ได้เชื่อมกับระบบแล้ว" });
    expect(launch.runLaunch).not.toHaveBeenCalled();
    expect(camps.getCampaign).toHaveBeenCalledWith(CAMPAIGN);
  });

  it("refuses a piece that is not filed in a campaign, or whose campaign is gone", async () => {
    content.getContent.mockResolvedValueOnce(piece({ campaignId: null }));
    expect(await launchAd(input())).toEqual({ ok: false, step: "check", error: "ชิ้นนี้ไม่ได้อยู่ในแคมเปญ" });
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await launchAd(input())).toMatchObject({ ok: false, step: "check" });
    expect(launch.runLaunch).not.toHaveBeenCalled();
  });

  it("does not take a Page from the form", async () => {
    await launchAd({ ...input(), pageId: "999" } as Parameters<typeof launchAd>[0]);
    expect(launch.runLaunch).toHaveBeenCalledTimes(1);
    expect(launch.runLaunch.mock.calls[0][0]).toMatchObject({ pageId: PAGE });
  });

  it("hands runLaunch the account's own currency, the asker's id and the edited words, and records it", async () => {
    const res = await launchAd(input({ headline: "แก้แล้ว" }));
    expect(res).toMatchObject({ ok: true });
    expect(launch.runLaunch).toHaveBeenCalledTimes(1);
    const [arg, deps] = launch.runLaunch.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(arg).toMatchObject({
      pieceId: PIECE, actId: ACT, pageId: PAGE, currency: "THB", headline: "แก้แล้ว",
      createdBy: "00000000-0000-4000-8000-000000000001",
    });
    // the deps carry the real token reader and the poster drawer, not values
    expect(await (deps.token as (a: string) => Promise<string>)(ACT)).toBe(SECRET);
    await (deps.poster as (id: string) => Promise<Buffer | null>)(PIECE);
    expect(draw.drawPoster).toHaveBeenCalledWith(expect.anything(), "square");
    expect(who.audit).toHaveBeenCalledWith("launch-ad", "AD1", expect.objectContaining({ pieceId: PIECE, actId: ACT, pageId: PAGE }));
  });

  it("audits against the piece when no ad was made", async () => {
    launch.runLaunch.mockResolvedValueOnce({ ok: false, step: "campaign", error: "Facebook ไม่รับ — x" });
    expect(await launchAd(input())).toMatchObject({ ok: false, step: "campaign" });
    expect(who.audit).toHaveBeenCalledWith("launch-ad", PIECE, expect.objectContaining({ ok: false, step: "campaign" }));
  });

  it("turns anything runLaunch or its deps throw into a short Thai answer, and logs the real error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    launch.runLaunch.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await launchAd(input());
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("refuses to recreate over a launch that is being run right now, but not an idle or a stale one", async () => {
    store.findLaunch.mockResolvedValueOnce(row({ claimedAt: new Date(Date.now() - 30_000).toISOString() }));
    expect(await launchAd(input({ recreate: true }))).toMatchObject({ ok: false, step: "check" });
    expect(launch.runLaunch).not.toHaveBeenCalled();

    // a run may hold its claim this long while Meta is slow; it is still running
    store.findLaunch.mockResolvedValueOnce(row({ claimedAt: new Date(Date.now() - 150_000).toISOString() }));
    expect(await launchAd(input({ recreate: true }))).toMatchObject({ ok: false, step: "check" });
    expect(launch.runLaunch).not.toHaveBeenCalled();

    store.findLaunch.mockResolvedValueOnce(row({ claimedAt: new Date(Date.now() - 300_000).toISOString() }));
    expect(await launchAd(input({ recreate: true }))).toMatchObject({ ok: true });
    store.findLaunch.mockResolvedValueOnce(row({ claimedAt: null }));
    expect(await launchAd(input({ recreate: true }))).toMatchObject({ ok: true });
    expect(launch.runLaunch).toHaveBeenCalledTimes(2);
    expect(launch.runLaunch.mock.calls[0][0]).toMatchObject({ recreate: true });
  });

  it("does not look at the claim when the owner is not recreating", async () => {
    store.findLaunch.mockResolvedValue(row({ claimedAt: new Date().toISOString() }));
    await launchAd(input());
    expect(launch.runLaunch).toHaveBeenCalled();
  });
});

describe("the ad-account strip", () => {
  it("says which settings are missing by name, never their values", async () => {
    fb.adsManageMissingEnv.mockReturnValueOnce(["FB_APP_SECRET"]);
    fb.adsManageOauthIsConfigured.mockReturnValueOnce(false);
    const { connection } = await adsStudioHome(PAGE);
    expect(connection).toMatchObject({ configured: false, missing: ["FB_APP_SECRET"] });
  });

  it("survives Meta not answering about the login's expiry", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.tokenExpiry.mockRejectedValue(new Error("meta down"));
    const { connection } = await adsStudioHome(PAGE);
    expect(connection.accounts[0]).toMatchObject({ id: ACT, expiresAt: null, tokenValid: null });
    log.mockRestore();
  });

  it("does not ask Meta about expiry, or log an error, on a server without the app secret", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.adsManageMissingEnv.mockReturnValue(["FB_APP_SECRET"]);
    const { connection } = await adsStudioHome(PAGE);
    expect(fb.tokenExpiry).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(connection.accounts[0]).toMatchObject({ id: ACT, expiresAt: null, tokenValid: null });
    fb.adsManageMissingEnv.mockReturnValue([]);
    log.mockRestore();
  });

  it("reads the accounts a half-finished login is waiting to choose between", async () => {
    const { connection } = await adsStudioHome(PAGE);
    expect(connection.choices).toEqual([{ id: ACT, name: "บัญชีทดสอบ" }]);
    expect(fb.listAdAccounts).toHaveBeenCalledWith(SECRET);
  });
});

describe("choosing an account after the login", () => {
  it("keeps the picked account with the waiting token, clears the wait, and audits", async () => {
    expect(await chooseAdManageAccount(ACT)).toEqual({ ok: true });
    expect(conn.saveAdManageAccount).toHaveBeenCalledWith({
      id: ACT, name: "บัญชีทดสอบ", currency: "THB", token: SECRET, scopes: ["ads_management"],
    });
    expect(conn.clearPendingAdsManage).toHaveBeenCalled();
    expect(who.audit).toHaveBeenCalledWith("connect-ads-manage", ACT, expect.anything());
  });

  it("says so when the login has expired, or the account was not in it", async () => {
    conn.readPendingAdsManage.mockResolvedValueOnce(null);
    expect(await chooseAdManageAccount(ACT)).toMatchObject({ ok: false });
    expect(await chooseAdManageAccount("act_999")).toMatchObject({ ok: false });
    expect(conn.saveAdManageAccount).not.toHaveBeenCalled();
  });
});

describe("switching an ad on", () => {
  it("audits a success against the launch", async () => {
    expect(await activateAd("L1")).toEqual({ ok: true });
    expect(launch.activateLaunch).toHaveBeenCalledWith("L1", expect.objectContaining({ store: expect.anything() }));
    expect(who.audit).toHaveBeenCalledWith("activate-ad", "L1", expect.objectContaining({ ok: true, adId: "AD1", actId: ACT, pageId: PAGE }));
  });

  it("audits a failure too, with the reason, since a press that did not go on is still an attempt to spend", async () => {
    launch.activateLaunch.mockResolvedValueOnce({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" });
    await activateAd("L1");
    expect(who.audit).toHaveBeenCalledWith("activate-ad", "L1", expect.objectContaining({
      ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้", adId: "AD1", actId: ACT, pageId: PAGE,
    }));
  });

  it("hands back why it did not go on, so the page can show it", async () => {
    launch.activateLaunch.mockResolvedValueOnce({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" });
    expect(await activateAd("L1")).toEqual({ ok: false, error: "Facebook ไม่ยืนยันการเปิดใช้" });
  });

  it("turns a throw into a Thai answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    launch.activateLaunch.mockRejectedValueOnce(new Error("boom"));
    const res = await activateAd("L1");
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("boom");
    log.mockRestore();
  });

  it("still audits the press when the switch-on throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    launch.activateLaunch.mockRejectedValueOnce(new Error("boom"));
    await activateAd("L1");
    expect(who.audit).toHaveBeenCalledWith("activate-ad", "L1", expect.objectContaining({ ok: false }));
    log.mockRestore();
  });
});

describe("Ads Studio's list of campaigns", () => {
  it("opens a Page it is asked for, and the first Page for one it does not know or none", async () => {
    pages.myPages.mockResolvedValue([{ pageId: PAGE, pageName: "เพจทดสอบ" }, { pageId: "333", pageName: "เพจสอง" }]);
    expect((await adsStudioHome("333")).pageId).toBe("333");
    expect(camps.listCampaigns).toHaveBeenLastCalledWith("333");
    expect((await adsStudioHome("ไม่มีเพจนี้")).pageId).toBe(PAGE);
    expect(camps.listCampaigns).toHaveBeenLastCalledWith(PAGE);
    expect((await adsStudioHome()).pageId).toBe(PAGE);
  });

  it("has no Page and no campaigns for an owner with no Page connected", async () => {
    pages.myPages.mockResolvedValue([]);
    const home = await adsStudioHome(PAGE);
    expect(home).toMatchObject({ pages: [], pageId: null, campaigns: [] });
    expect(camps.listCampaigns).not.toHaveBeenCalled();
  });

  it("names each campaign, falling back to the plan's name, with its newest poster and a count per tab", async () => {
    camps.listCampaigns.mockResolvedValue([campaign(), campaign({ id: "c2", name: null })]);
    camps.listCampaignPieces.mockImplementation(async (id: string) => id === CAMPAIGN
      ? [
        piece({ id: "new-no-poster", output: { hooks: ["h"], body: "b", closing: "c" } }),
        piece({ id: "binned", status: "trashed" }),
        piece({ id: "launched" }),
        piece({ id: "live" }),
      ]
      : []);
    store.findLaunch.mockImplementation(async (pieceId: string) =>
      pieceId === "launched" ? row({ pieceId }) : pieceId === "live" ? row({ pieceId, activatedAt: "2026-10-04T02:00:00Z" }) : null);
    const home = await adsStudioHome(PAGE);
    expect(home.campaigns).toEqual([
      {
        id: CAMPAIGN, name: "แคมเปญทดสอบ", planHref: "/lifeprotect", cover: "launched", coverPoster: { theme: "navy", blocks: [] },
        counts: { draft: 1, launched: 1, live: 1, trash: 1 },
      },
      {
        id: "c2", name: expect.stringContaining("Life Protect"), planHref: "/lifeprotect", cover: null, coverPoster: null,
        counts: { draft: 0, launched: 0, live: 0, trash: 0 },
      },
    ]);
    // the list does not ask Meta about every ad; the room does
    expect(launch.adEffectiveStatus).not.toHaveBeenCalled();
  });

  it("carries the ad-account strip and no token string", async () => {
    const home = await adsStudioHome(PAGE);
    expect(JSON.stringify(home)).not.toContain(SECRET);
    expect(home.connection).toMatchObject({
      configured: true,
      missing: [],
      accounts: [{ id: ACT, name: "บัญชีทดสอบ", currency: "THB", expiresAt: "2026-12-01T00:00:00.000Z", tokenValid: true }],
      choices: [{ id: ACT, name: "บัญชีทดสอบ" }],
      maxDailyBudgetThb: 500,
    });
  });

  it("still opens when one campaign's pieces cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    camps.listCampaignPieces.mockRejectedValue(new Error("db down"));
    const home = await adsStudioHome(PAGE);
    expect(home.campaigns[0]).toMatchObject({ id: CAMPAIGN, cover: null, coverPoster: null, counts: { draft: 0, launched: 0, live: 0, trash: 0 } });
    log.mockRestore();
  });

  it("says the list could not be read rather than showing an empty one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    camps.listCampaigns.mockRejectedValueOnce(new Error("db down: secret detail"));
    const home = await adsStudioHome(PAGE);
    expect(home.campaigns).toEqual([]);
    expect(home.error).toBeTruthy();
    expect(JSON.stringify(home)).not.toContain("secret detail");
    log.mockRestore();
  });
});

describe("making a campaign", () => {
  const made = (over: Record<string, unknown> = {}) =>
    createAdCampaign({ pageId: PAGE, planHref: "/lifeprotect", angles: 2, tones: 1, ...over } as Parameters<typeof createAdCampaign>[0]);

  it("files it under a connected Page and a plan Studio knows, by the owner", async () => {
    expect(await made({ theme: "navy" })).toEqual({ ok: true, id: CAMPAIGN });
    expect(camps.createCampaign).toHaveBeenCalledWith({
      pageId: PAGE, planHref: "/lifeprotect", name: null, angles: 2, tones: 1, theme: "navy", hint: null,
      agentId: "00000000-0000-4000-8000-000000000001",
    });
    expect(who.audit).toHaveBeenCalledWith("create-ad-campaign", CAMPAIGN, expect.objectContaining({ pageId: PAGE, planHref: "/lifeprotect" }));
  });

  it("refuses a Page that is not connected, or a plan Studio does not know", async () => {
    expect(await made({ pageId: "999" })).toMatchObject({ ok: false });
    expect(await made({ planHref: "/nothing-here" })).toMatchObject({ ok: false });
    expect(camps.createCampaign).not.toHaveBeenCalled();
  });

  it("trims the name to 60 and the hint to 120, keeps nothing blank, and drops a theme posters do not have", async () => {
    await made({ name: `  ${"ก".repeat(70)}  `, hint: ` ${"ข".repeat(130)} `, theme: "rainbow" });
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({
      name: "ก".repeat(60), hint: "ข".repeat(120), theme: null,
    }));
    await made({ name: "   ", hint: "  " });
    expect(camps.createCampaign).toHaveBeenLastCalledWith(expect.objectContaining({ name: null, hint: null }));
  });

  it("turns a throw into a Thai answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    camps.createCampaign.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await made();
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    log.mockRestore();
  });
});

describe("a campaign's room", () => {
  it("answers { ok: false } for an id that is not a uuid or not a campaign, without throwing", async () => {
    // the real store answers null for a non-uuid without asking the database
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await adCampaignRoom("not-a-uuid")).toEqual({ ok: false });
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await adCampaignRoom("9a6b7c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d")).toEqual({ ok: false });
    expect(camps.listCampaignPieces).not.toHaveBeenCalled();
  });

  it("says why when the campaign could not be read, rather than claiming it does not exist", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    camps.getCampaign.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await adCampaignRoom(CAMPAIGN);
    expect(res).toMatchObject({ ok: false, error: expect.any(String) });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    log.mockRestore();
  });

  it("names the campaign's Page and says it is connected", async () => {
    const room = await adCampaignRoom(CAMPAIGN);
    expect(room).toMatchObject({ ok: true, campaign: { id: CAMPAIGN, pageId: PAGE, pageName: "เพจทดสอบ", pageConnected: true } });
  });

  it("still opens for a campaign whose Page was disconnected, and says so", async () => {
    camps.getCampaign.mockResolvedValueOnce(campaign({ pageId: "999" }));
    const room = await adCampaignRoom(CAMPAIGN);
    expect(room).toMatchObject({ ok: true, campaign: { pageId: "999", pageName: null, pageConnected: false } });
  });

  it("names an unnamed campaign after its plan", async () => {
    camps.getCampaign.mockResolvedValueOnce(campaign({ name: null }));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.campaign.title).toEqual(expect.stringContaining("Life Protect"));
    // the owner's own name stays blank, so the settings form does not save the plan's as theirs
    expect(room.campaign.name).toBeNull();
  });

  it("lays out every piece with its words, poster, Facebook warnings, launches and tab", async () => {
    const policy = [{ code: "x", severity: "warn", message: "m", fix: "f", match: "w" }];
    camps.listCampaignPieces.mockResolvedValue([
      piece({ flags: { numbers: [], words: [], fixes: null, policy }, output: { hooks: ["หัวข้อโฆษณา"], body: "ข้อความหลัก", closing: "คำอธิบาย", poster: { theme: "navy", blocks: [] }, ad: { angle: "ครอบครัว", tone: "อบอุ่น" } } }),
      piece({ id: "binned", status: "trashed", output: { hooks: ["h"], body: "b", closing: "c" } }),
    ]);
    store.findLaunch.mockImplementation(async (pieceId: string) => (pieceId === PIECE ? row({ activatedAt: "2026-10-04T02:00:00Z" }) : null));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pieces).toHaveLength(2);
    expect(room.pieces[0]).toMatchObject({
      id: PIECE, headline: "หัวข้อโฆษณา", primaryText: "ข้อความหลัก", description: "คำอธิบาย", hasPoster: true,
      poster: { theme: "navy", blocks: [] }, flags: { policy }, ad: { angle: "ครอบครัว", tone: "อบอุ่น" },
      launch: { id: "L1", adId: "AD1", effectiveStatus: "PAUSED" }, tab: "live",
    });
    expect(room.pieces[1]).toMatchObject({ id: "binned", hasPoster: false, poster: null, flags: { policy: [] }, launch: null, tab: "trash" });
    expect(room.counts).toEqual({ draft: 0, launched: 0, live: 1, trash: 1 });
    expect(camps.listCampaignPieces).toHaveBeenCalledWith(CAMPAIGN);
  });

  it("carries no token string", async () => {
    store.findLaunch.mockResolvedValue(row());
    const room = await adCampaignRoom(CAMPAIGN);
    expect(room.ok).toBe(true);
    expect(JSON.stringify(room)).not.toContain(SECRET);
    expect(launch.adEffectiveStatus).toHaveBeenCalledWith("AD1", SECRET);
  });

  it("survives Meta or the launch table not answering", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.tokenExpiry.mockRejectedValue(new Error("meta down"));
    store.findLaunch.mockRejectedValue(new Error("no such table"));
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.connection.accounts[0].expiresAt).toBeNull();
    expect(room.pieces[0]).toMatchObject({ launch: null, tab: "draft" });
    log.mockRestore();
  });
});

describe("changing a campaign", () => {
  it("passes the settings on, trimmed like a new one", async () => {
    expect(await updateAdCampaign(CAMPAIGN, { name: ` ${"ก".repeat(70)} `, hint: "  ", angles: 3, tones: 2, theme: "sky" })).toEqual({ ok: true });
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { name: "ก".repeat(60), hint: null, angles: 3, tones: 2, theme: "sky" });
  });

  it("leaves out what was not sent, and never takes a Page or a plan", async () => {
    await updateAdCampaign(CAMPAIGN, { tones: 1, pageId: "999", planHref: "/ishield" } as Parameters<typeof updateAdCampaign>[1]);
    expect(camps.updateCampaign).toHaveBeenCalledWith(CAMPAIGN, { tones: 1 });
  });

  it("refuses a campaign that is not there", async () => {
    camps.getCampaign.mockResolvedValueOnce(null);
    expect(await updateAdCampaign("not-a-uuid", { name: "x" })).toMatchObject({ ok: false });
    expect(camps.updateCampaign).not.toHaveBeenCalled();
  });

  it("turns a throw into a Thai answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    camps.updateCampaign.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await updateAdCampaign(CAMPAIGN, { name: "x" });
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    log.mockRestore();
  });
});

describe("saving an ad's words", () => {
  const edits = { hooks: ["หัวข้อใหม่"], body: "ข้อความใหม่", closing: "คำอธิบายใหม่", hashtags: [] };

  it("hands an ad filed in a campaign to Studio's own save", async () => {
    expect(await saveAdCopy(PIECE, edits, { plain: true })).toMatchObject({ ok: true });
    expect(studio.saveContentEdits).toHaveBeenCalledWith(PIECE, edits, { plain: true });
  });

  it("refuses a piece that is not an ad in a campaign", async () => {
    for (const p of [null, piece({ campaignId: null }), piece({ format: "post" })]) {
      content.getContent.mockResolvedValueOnce(p);
      expect(await saveAdCopy(PIECE, edits)).toMatchObject({ ok: false });
    }
    expect(studio.saveContentEdits).not.toHaveBeenCalled();
  });

  it("turns a throw into a Thai answer", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    content.getContent.mockRejectedValueOnce(new Error("db down: secret detail"));
    const res = await saveAdCopy(PIECE, edits);
    expect(res).toMatchObject({ ok: false });
    expect(JSON.stringify(res)).not.toContain("secret detail");
    log.mockRestore();
  });
});

describe("the bin for an ad", () => {
  it("bins a draft, and a piece launched but still paused", async () => {
    expect(await setAdStatus(PIECE, "trashed")).toEqual({ ok: true });
    expect(studio.setContentStatus).toHaveBeenLastCalledWith(PIECE, "trashed");
    store.findLaunch.mockResolvedValue(row({ activatedAt: null }));
    expect(await setAdStatus(PIECE, "trashed")).toEqual({ ok: true });
    expect(studio.setContentStatus).toHaveBeenCalledTimes(2);
  });

  it("refuses to bin a piece whose ad is switched on, in any account", async () => {
    conn.adManageAccounts.mockResolvedValue([
      { id: ACT, name: "บัญชีทดสอบ", currency: "THB" }, { id: "act_222", name: "สอง", currency: "THB" },
    ]);
    store.findLaunch.mockImplementation(async (_p: string, act: string) => (act === "act_222" ? row({ actId: act, activatedAt: "2026-10-04T02:00:00Z" }) : null));
    expect(await setAdStatus(PIECE, "trashed")).toEqual({ ok: false, error: "ปิดแอดนี้ก่อนทิ้ง" });
    expect(studio.setContentStatus).not.toHaveBeenCalled();
  });

  it("refuses rather than bins when the launch table cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    store.findLaunch.mockRejectedValue(new Error("no such table"));
    const res = await setAdStatus(PIECE, "trashed");
    expect(res.ok).toBe(false);
    expect(studio.setContentStatus).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("restores from the bin whatever the launches", async () => {
    content.getContent.mockResolvedValue(piece({ status: "trashed" }));
    store.findLaunch.mockResolvedValue(row({ activatedAt: "2026-10-04T02:00:00Z" }));
    expect(await setAdStatus(PIECE, "draft")).toEqual({ ok: true });
    expect(studio.setContentStatus).toHaveBeenCalledWith(PIECE, "draft");
  });

  it("refuses a piece that is not an ad, or not in a campaign", async () => {
    content.getContent.mockResolvedValueOnce(piece({ format: "post" }));
    expect((await setAdStatus(PIECE, "trashed")).ok).toBe(false);
    content.getContent.mockResolvedValueOnce(piece({ campaignId: null }));
    expect(await setAdStatus(PIECE, "trashed")).toEqual({ ok: false, error: "ชิ้นนี้ไม่ได้อยู่ในแคมเปญ" });
    expect(studio.setContentStatus).not.toHaveBeenCalled();
  });

  it("refuses any status but the bin and back", async () => {
    expect((await setAdStatus(PIECE, "used" as "draft")).ok).toBe(false);
    expect(studio.setContentStatus).not.toHaveBeenCalled();
  });

  it("passes on what Studio's own status change says", async () => {
    studio.setContentStatus.mockResolvedValueOnce({ ok: false, error: "ชิ้นนี้ขึ้นเพจแล้ว" });
    expect(await setAdStatus(PIECE, "trashed")).toEqual({ ok: false, error: "ชิ้นนี้ขึ้นเพจแล้ว" });
  });
});

describe("the room names every Page", () => {
  it("carries the owner's Pages, for a launch made on another Page than the campaign's", async () => {
    pages.myPages.mockResolvedValue([{ pageId: PAGE, pageName: "เพจทดสอบ" }, { pageId: "333", pageName: "เพจสอง" }]);
    const room = await adCampaignRoom(CAMPAIGN);
    if (!room.ok) throw new Error("room did not open");
    expect(room.pages).toEqual([{ pageId: PAGE, pageName: "เพจทดสอบ" }, { pageId: "333", pageName: "เพจสอง" }]);
  });
});
