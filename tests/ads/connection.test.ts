import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ads Studio's ad-account connection (moved from launch-actions.test.ts, 2026-10-07): the strip the
 * settings show (connection.ts) and picking accounts after a Facebook login (connection-actions.ts).
 * Picking is the owner's alone. Nothing here touches the database or Meta.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

const SECRET = "SECRET-ADS-MANAGE-TOKEN";
const ACT = "act_111";

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
const launch = vi.hoisted(() => ({ thVerifiedIdentity: vi.fn(() => "VID1" as string | null) }));
vi.mock("@/lib/ads/launch", () => launch);

const { chooseAdManageAccounts } = await import("@/app/studio/ads/connection-actions");
const { connection } = await import("@/app/studio/ads/connection");
const strip = async () => (await connection()).connection;

beforeEach(() => {
  vi.clearAllMocks();
  who.owner = true;
  conn.adManageAccounts.mockResolvedValue([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB", connectedAt: "2026-10-01" }]);
  conn.adManageToken.mockResolvedValue(SECRET);
  conn.readPendingAdsManage.mockResolvedValue({ token: SECRET, scopes: ["ads_management"] });
  fb.listAdAccounts.mockResolvedValue([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB" }]);
  fb.tokenExpiry.mockResolvedValue({ valid: true, expiresAt: "2026-12-01T00:00:00.000Z", dataAccessExpiresAt: null });
});

describe("who may pick accounts", () => {
  it("refuses everyone but the owner before anything is read or written", async () => {
    who.owner = false;
    await expect(chooseAdManageAccounts([ACT])).rejects.toThrow("ไม่มีสิทธิ์");
    for (const spy of [conn.saveAdManageAccount, conn.readPendingAdsManage, who.audit]) expect(spy).not.toHaveBeenCalled();
  });
});

describe("the ad-account strip", () => {
  it("says which settings are missing by name, never their values", async () => {
    fb.adsManageMissingEnv.mockReturnValueOnce(["FB_APP_SECRET"]);
    fb.adsManageOauthIsConfigured.mockReturnValueOnce(false);
    const connection = await strip();
    expect(connection).toMatchObject({ configured: false, missing: ["FB_APP_SECRET"] });
  });

  it("survives Meta not answering about the login's expiry", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.tokenExpiry.mockRejectedValue(new Error("meta down"));
    const connection = await strip();
    expect(connection.accounts[0]).toMatchObject({ id: ACT, expiresAt: null, tokenValid: null });
    log.mockRestore();
  });

  it("does not ask Meta about expiry, or log an error, on a server without the app secret", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fb.adsManageMissingEnv.mockReturnValue(["FB_APP_SECRET"]);
    const connection = await strip();
    expect(fb.tokenExpiry).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(connection.accounts[0]).toMatchObject({ id: ACT, expiresAt: null, tokenValid: null });
    fb.adsManageMissingEnv.mockReturnValue([]);
    log.mockRestore();
  });

  it("reads the accounts a half-finished login is waiting to choose between", async () => {
    const connection = await strip();
    expect(connection.choices).toEqual([{ id: ACT, name: "บัญชีทดสอบ", currency: "THB" }]);
    expect(fb.listAdAccounts).toHaveBeenCalledWith(SECRET);
  });
});

describe("choosing accounts after the login", () => {
  const TWO = "act_2";
  beforeEach(() => {
    fb.listAdAccounts.mockResolvedValue([
      { id: ACT, name: "บัญชีทดสอบ", currency: "THB" },
      { id: TWO, name: "บัญชีสอง", currency: "USD" },
    ]);
  });

  it("keeps every picked account with the waiting token, clears the wait, and audits each", async () => {
    expect(await chooseAdManageAccounts([ACT, TWO])).toEqual({ ok: true });
    expect(conn.saveAdManageAccount).toHaveBeenCalledTimes(2);
    expect(conn.saveAdManageAccount).toHaveBeenCalledWith({
      id: ACT, name: "บัญชีทดสอบ", currency: "THB", token: SECRET, scopes: ["ads_management"],
    });
    expect(conn.saveAdManageAccount).toHaveBeenCalledWith({
      id: TWO, name: "บัญชีสอง", currency: "USD", token: SECRET, scopes: ["ads_management"],
    });
    expect(conn.clearPendingAdsManage).toHaveBeenCalledTimes(1);
    expect(who.audit).toHaveBeenCalledWith("connect-ads-manage", ACT, expect.anything());
    expect(who.audit).toHaveBeenCalledWith("connect-ads-manage", TWO, expect.anything());
  });

  it("takes each account once, however often it is sent", async () => {
    expect(await chooseAdManageAccounts([ACT, ACT])).toEqual({ ok: true });
    expect(conn.saveAdManageAccount).toHaveBeenCalledTimes(1);
  });

  it("refuses an empty pick without reading anything", async () => {
    expect(await chooseAdManageAccounts([])).toMatchObject({ ok: false, error: "ยังไม่ได้เลือกบัญชีโฆษณา" });
    expect(conn.readPendingAdsManage).not.toHaveBeenCalled();
    expect(conn.saveAdManageAccount).not.toHaveBeenCalled();
  });

  it("says so when the login has expired", async () => {
    conn.readPendingAdsManage.mockResolvedValueOnce(null);
    expect(await chooseAdManageAccounts([ACT])).toMatchObject({ ok: false });
    expect(conn.saveAdManageAccount).not.toHaveBeenCalled();
  });

  it("names an account that was not in the login, keeps the others, and leaves the wait for another try", async () => {
    const res = await chooseAdManageAccounts([ACT, "act_999"]);
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? "" : res.error).toContain("act_999");
    expect(conn.saveAdManageAccount).toHaveBeenCalledTimes(1);
    expect(conn.clearPendingAdsManage).not.toHaveBeenCalled();
  });

  it("names an account whose save failed and leaves the wait", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    conn.saveAdManageAccount.mockRejectedValueOnce(new Error("db down"));
    const res = await chooseAdManageAccounts([ACT, TWO]);
    expect(res).toMatchObject({ ok: false });
    expect(res.ok ? "" : res.error).toContain("บัญชีทดสอบ");
    expect(res.ok ? "" : res.error).not.toContain("db down");
    expect(conn.clearPendingAdsManage).not.toHaveBeenCalled();
    expect(who.audit).toHaveBeenCalledWith("connect-ads-manage", TWO, expect.anything());
    log.mockRestore();
  });
});

describe("the Thai advertiser identity flag", () => {
  it("tells the page when META_TH_VERIFIED_IDENTITY_ID is missing", async () => {
    launch.thVerifiedIdentity.mockReturnValueOnce(null);
    const connection = await strip();
    expect(connection.thIdentity).toBe(false);
  });
});
