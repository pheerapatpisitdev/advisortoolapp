import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Facebook login is finished only in the browser that began it (review, 2026-10-01): the
 * connect route puts the state's nonce in a cookie scoped to the callback, and the callback
 * takes the state only with that cookie, then spends it whatever happens.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

// the viewer can be swapped per test; the audit is a spy so the new branch's record can be checked
const who = vi.hoisted(() => ({ viewer: undefined as unknown, audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/viewer", async () => {
  const { asOwner, OWNER } = await import("../helpers/signed-in");
  return { ...asOwner, getViewer: async () => who.viewer ?? OWNER, audit: who.audit };
});
const fb = vi.hoisted(() => ({
  tokenFromCode: vi.fn(async () => "user-token"),
  grantedScopes: vi.fn(async () => ["pages_show_list"]),
  listPages: vi.fn(async () => [{ id: "p1", name: "เพจ", accessToken: "pt" }]),
  subscribePage: vi.fn(async () => ["messages"]),
  listAdAccounts: vi.fn(async () => [{ id: "act_1", name: "บัญชี", currency: "THB" }]),
}));
vi.mock("@/lib/facebook/oauth", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/oauth")>()), ...fb }));
const store = vi.hoisted(() => ({ saveConnection: vi.fn(), savePending: vi.fn(), clearPending: vi.fn() }));
vi.mock("@/lib/facebook/connection", () => store);
const ads = vi.hoisted(() => ({ saveAdAccount: vi.fn(), savePendingAds: vi.fn(), clearPendingAds: vi.fn() }));
vi.mock("@/lib/facebook/ads-connection", () => ads);
const manage = vi.hoisted(() => ({ saveAdManageAccount: vi.fn(), savePendingAdsManage: vi.fn(), clearPendingAdsManage: vi.fn() }));
vi.mock("@/lib/facebook/ads-manage-connection", () => manage);

const { GET: connect } = await import("@/app/api/facebook/connect/route");
const { GET: callback } = await import("@/app/api/facebook/connect/callback/route");
const { STATE_COOKIE, STATE_COOKIE_PATH } = await import("@/lib/facebook/oauth");

const ORIGIN = "https://advisortool.test";

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = undefined;
});

/** Starts a login and returns the state Facebook would carry back, and the cookie the browser keeps. */
async function begin(purposeQuery = ""): Promise<{ state: string; nonce: string; setCookie: string }> {
  const res = await connect(new Request(`${ORIGIN}/api/facebook/connect${purposeQuery}`));
  const location = new URL(res.headers.get("location")!);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const nonce = res.cookies.get(STATE_COOKIE)?.value ?? "";
  return { state: location.searchParams.get("state")!, nonce, setCookie };
}

const back = (state: string, cookie?: string) =>
  callback(new Request(`${ORIGIN}/api/facebook/connect/callback?code=c1&state=${encodeURIComponent(state)}`, {
    headers: cookie === undefined ? {} : { cookie },
  }));

describe("starting a Facebook login", () => {
  it("puts the state's nonce in a short-lived, httpOnly cookie only the callback sees", async () => {
    const { state, nonce, setCookie } = await begin();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(state.split(".")[1]).toBe(nonce);
    expect(setCookie).toContain(`Path=${STATE_COOKIE_PATH}`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toContain("Max-Age=600");
  });
});

describe("finishing a Facebook login", () => {
  it("connects with the cookie of the browser that began it, and spends the cookie", async () => {
    const { state, nonce } = await begin();
    const res = await back(state, `other=1; ${STATE_COOKIE}=${nonce}`);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/admin/messenger?fb=connected`);
    expect(store.saveConnection).toHaveBeenCalled();
    expect(res.cookies.get(STATE_COOKIE)?.value).toBe("");
    expect(res.headers.get("set-cookie")).toContain(`Path=${STATE_COOKIE_PATH}`);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("refuses a valid state in a browser without the cookie, or with another login's", async () => {
    const { state } = await begin();
    const other = await begin();
    for (const cookie of [undefined, `${STATE_COOKIE}=`, `${STATE_COOKIE}=${other.nonce}`]) {
      const res = await back(state, cookie);
      expect(res.headers.get("location")).toBe(`${ORIGIN}/admin/messenger?fb=state`);
      expect(res.cookies.get(STATE_COOKIE)?.value).toBe("");
    }
    expect(fb.tokenFromCode).not.toHaveBeenCalled();
    expect(store.saveConnection).not.toHaveBeenCalled();
  });
});

/**
 * The third login, for creating ads. It must stay out of the Page and ads_read logins: a login
 * through the wrong configuration has revoked Page permissions before, and the owner is the
 * only one who may spend money.
 */
describe("the ads-manage login", () => {
  const OLD = { ...process.env };
  const scopesOf = (...s: string[]) => fb.grantedScopes.mockResolvedValueOnce(s);
  const accounts = (n: number) =>
    fb.listAdAccounts.mockResolvedValueOnce(Array.from({ length: n }, (_, i) => ({ id: `act_${i + 1}`, name: `บัญชี ${i + 1}`, currency: "THB" })));

  beforeEach(() => {
    process.env.FB_ADS_MANAGE_CONFIG_ID = "manage-config";
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  /** Runs the whole round trip and returns the callback's response. */
  async function roundTrip() {
    const { state, nonce } = await begin("?for=ads-manage");
    return back(state, `${STATE_COOKIE}=${nonce}`);
  }

  it("sends only the owner, through its own configuration", async () => {
    const res = await connect(new Request(`${ORIGIN}/api/facebook/connect?for=ads-manage`));
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("config_id")).toBe("manage-config");
    expect(url.searchParams.get("state")!.split(".")[2]).toBe("ads-manage");
    expect(res.cookies.get(STATE_COOKIE)?.value).toMatch(/^[0-9a-f]{32}$/);
  });

  it("turns away a viewer who is not the owner", async () => {
    const { OWNER } = await import("../helpers/signed-in");
    who.viewer = { ...OWNER, staff: { owner: false, publish: true, connect: true, admin: true } };
    const res = await connect(new Request(`${ORIGIN}/api/facebook/connect?for=ads-manage`));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio`);
    expect(res.cookies.get(STATE_COOKIE)).toBeUndefined();
  });

  it("says unconfigured when its own configuration is not set, even if the others are", async () => {
    process.env.FB_LOGIN_CONFIG_ID = "page-config";
    process.env.FB_ADS_LOGIN_CONFIG_ID = "ads-config";
    delete process.env.FB_ADS_MANAGE_CONFIG_ID;
    const res = await connect(new Request(`${ORIGIN}/api/facebook/connect?for=ads-manage`));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=unconfigured`);
  });

  it("stops at noscope when ads_management was not granted", async () => {
    scopesOf("ads_read", "pages_show_list");
    accounts(1);
    const res = await roundTrip();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=noscope`);
    expect(manage.saveAdManageAccount).not.toHaveBeenCalled();
  });

  it("stops at noaccounts when there is no ad account to use", async () => {
    scopesOf("ads_management");
    accounts(0);
    const res = await roundTrip();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=noaccounts`);
    expect(manage.saveAdManageAccount).not.toHaveBeenCalled();
  });

  it("connects the one account, and touches neither the ads_read store nor the Page store", async () => {
    scopesOf("ads_management", "pages_show_list");
    accounts(1);
    const res = await roundTrip();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=connected`);
    expect(manage.saveAdManageAccount).toHaveBeenCalledTimes(1);
    expect(manage.saveAdManageAccount).toHaveBeenCalledWith({
      id: "act_1", name: "บัญชี 1", currency: "THB", token: "user-token", scopes: ["ads_management", "pages_show_list"],
    });
    expect(manage.clearPendingAdsManage).toHaveBeenCalledTimes(1);
    expect(ads.saveAdAccount).not.toHaveBeenCalled();
    expect(ads.savePendingAds).not.toHaveBeenCalled();
    expect(store.saveConnection).not.toHaveBeenCalled();
    expect(store.savePending).not.toHaveBeenCalled();
    expect(fb.listPages).not.toHaveBeenCalled();
    expect(fb.subscribePage).not.toHaveBeenCalled();
    expect(who.audit).toHaveBeenCalledWith("connect-ads-manage", "act_1", { name: "บัญชี 1" });
  });

  it("keeps the token and asks which account when there are several", async () => {
    scopesOf("ads_management");
    accounts(2);
    const res = await roundTrip();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=choose`);
    expect(manage.savePendingAdsManage).toHaveBeenCalledWith("user-token", ["ads_management"]);
    expect(manage.saveAdManageAccount).not.toHaveBeenCalled();
    expect(ads.savePendingAds).not.toHaveBeenCalled();
  });

  it("answers cancelled, state and failed on the Studio page too", async () => {
    const { state, nonce } = await begin("?for=ads-manage");
    const cancelled = await callback(new Request(`${ORIGIN}/api/facebook/connect/callback?error=access_denied&state=${encodeURIComponent(state)}`, {
      headers: { cookie: `${STATE_COOKIE}=${nonce}` },
    }));
    expect(cancelled.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=cancelled`);
    const stale = await back(state, undefined);
    expect(stale.headers.get("location")).toBe(`${ORIGIN}/admin/messenger?fb=state`);
    fb.tokenFromCode.mockRejectedValueOnce(new Error("boom"));
    const failed = await back(state, `${STATE_COOKIE}=${nonce}`);
    expect(failed.headers.get("location")).toBe(`${ORIGIN}/studio/ads?fb=failed&detail=boom`);
  });

  it("turns away a non-owner at the callback too, before any token is traded", async () => {
    const { state, nonce } = await begin("?for=ads-manage");
    const { OWNER } = await import("../helpers/signed-in");
    who.viewer = { ...OWNER, staff: { owner: false, publish: true, connect: true, admin: true } };
    const res = await back(state, `${STATE_COOKIE}=${nonce}`);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio`);
    expect(fb.tokenFromCode).not.toHaveBeenCalled();
  });
});
