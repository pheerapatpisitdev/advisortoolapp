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

const content = vi.hoisted(() => ({ getContent: vi.fn(), listContent: vi.fn() }));
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
}));
vi.mock("@/lib/facebook/oauth", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/oauth")>()), ...fb }));

const store = vi.hoisted(() => ({ findLaunch: vi.fn(), getLaunch: vi.fn() }));
vi.mock("@/lib/ads/launch-store", async (orig) => ({ ...(await orig<typeof import("@/lib/ads/launch-store")>()), ...store }));
const launch = vi.hoisted(() => ({ runLaunch: vi.fn(), activateLaunch: vi.fn(), adEffectiveStatus: vi.fn() }));
vi.mock("@/lib/ads/launch", () => launch);

const { adsLaunchSetup, launchAd, chooseAdManageAccount, activateAd } = await import("@/app/studio/ads/actions");

const piece = (over: Record<string, unknown> = {}) => ({
  id: PIECE,
  status: "draft",
  format: "ad",
  output: { hooks: ["หัวข้อโฆษณา"], body: "ข้อความหลัก", closing: "คำอธิบาย", poster: { theme: "navy", blocks: [] } },
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: "L1", pieceId: PIECE, actId: ACT, pageId: PAGE, step: "ad", adId: "AD1", campaignId: "C1", adsetId: "S1",
  error: null, activatedAt: null, claimedAt: null, dailyBudgetMinor: 15000, link: "https://x.test/", superseded: false,
  ...over,
});

const input = (over: Record<string, unknown> = {}) => ({
  pieceId: PIECE, actId: ACT, pageId: PAGE, link: "https://x.test/", dailyBudgetBaht: 150,
  headline: "หัวข้อ", primaryText: "ข้อความ", description: "คำอธิบาย", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  content.getContent.mockResolvedValue(piece());
  content.listContent.mockResolvedValue([piece()]);
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
});

describe("who may use the actions", () => {
  it("refuses everyone but the owner, on every action, before anything is read or written", async () => {
    who.owner = false;
    await expect(adsLaunchSetup()).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(launchAd(input())).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(chooseAdManageAccount(ACT)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(activateAd("L1")).rejects.toThrow("ไม่มีสิทธิ์");
    for (const spy of [launch.runLaunch, launch.activateLaunch, conn.saveAdManageAccount, conn.adManageAccounts, content.getContent, who.audit]) {
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

  it("refuses an ad account or a Page the owner has not connected", async () => {
    expect(await launchAd(input({ actId: "act_999" }))).toMatchObject({ ok: false });
    expect(await launchAd(input({ pageId: "999" }))).toMatchObject({ ok: false });
    expect(launch.runLaunch).not.toHaveBeenCalled();
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

describe("the page's setup", () => {
  it("carries no token string, whatever it asked Meta about", async () => {
    store.findLaunch.mockResolvedValue(row());
    const setup = await adsLaunchSetup();
    expect(JSON.stringify(setup)).not.toContain(SECRET);
    expect(setup).toMatchObject({
      configured: true,
      accounts: [{ id: ACT, name: "บัญชีทดสอบ", currency: "THB", expiresAt: "2026-12-01T00:00:00.000Z" }],
      pages: [{ pageId: PAGE, pageName: "เพจทดสอบ" }],
      maxDailyBudgetThb: 500,
    });
    expect(setup.pieces).toHaveLength(1);
    expect(setup.pieces[0]).toMatchObject({
      id: PIECE, headline: "หัวข้อโฆษณา", primaryText: "ข้อความหลัก", description: "คำอธิบาย", hasPoster: true,
      launch: { id: "L1", step: "ad", adId: "AD1", effectiveStatus: "PAUSED" },
    });
    expect(launch.adEffectiveStatus).toHaveBeenCalledWith("AD1", SECRET);
  });

  it("lists only ad pieces that are not in the bin, and says which have a poster", async () => {
    content.listContent.mockResolvedValue([
      piece(),
      piece({ id: "b", format: "post" }),
      piece({ id: "c", status: "trashed" }),
      piece({ id: "d", output: { hooks: ["h"], body: "b", closing: "c" } }),
    ]);
    const { pieces } = await adsLaunchSetup();
    expect(pieces.map((p) => [p.id, p.hasPoster])).toEqual([[PIECE, true], ["d", false]]);
  });

  it("survives Meta or the launch table not answering", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.tokenExpiry.mockRejectedValue(new Error("meta down"));
    store.findLaunch.mockRejectedValue(new Error("no such table"));
    const setup = await adsLaunchSetup();
    expect(setup.accounts[0].expiresAt).toBeNull();
    expect(setup.pieces[0].launch).toBeNull();
    log.mockRestore();
  });

  it("reads the accounts a half-finished login is waiting to choose between", async () => {
    const setup = await adsLaunchSetup();
    expect(setup.choices).toEqual([{ id: ACT, name: "บัญชีทดสอบ" }]);
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
