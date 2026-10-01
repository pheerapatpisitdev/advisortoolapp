import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Facebook login is finished only in the browser that began it (review, 2026-10-01): the
 * connect route puts the state's nonce in a cookie scoped to the callback, and the callback
 * takes the state only with that cookie, then spends it whatever happens.
 */

process.env.ADMIN_SESSION_SECRET = "test-secret";
process.env.FB_APP_ID = "1";
process.env.FB_APP_SECRET = "s";

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
const fb = vi.hoisted(() => ({
  tokenFromCode: vi.fn(async () => "user-token"),
  grantedScopes: vi.fn(async () => ["pages_show_list"]),
  listPages: vi.fn(async () => [{ id: "p1", name: "เพจ", accessToken: "pt" }]),
  subscribePage: vi.fn(async () => ["messages"]),
}));
vi.mock("@/lib/facebook/oauth", async (orig) => ({ ...(await orig<typeof import("@/lib/facebook/oauth")>()), ...fb }));
const store = vi.hoisted(() => ({ saveConnection: vi.fn(), savePending: vi.fn(), clearPending: vi.fn() }));
vi.mock("@/lib/facebook/connection", () => store);
vi.mock("@/lib/facebook/ads-connection", () => ({ saveAdAccount: vi.fn(), savePendingAds: vi.fn(), clearPendingAds: vi.fn() }));

const { GET: connect } = await import("@/app/api/facebook/connect/route");
const { GET: callback } = await import("@/app/api/facebook/connect/callback/route");
const { STATE_COOKIE, STATE_COOKIE_PATH } = await import("@/lib/facebook/oauth");

const ORIGIN = "https://advisortool.test";

beforeEach(() => vi.clearAllMocks());

/** Starts a login and returns the state Facebook would carry back, and the cookie the browser keeps. */
async function begin(): Promise<{ state: string; nonce: string; setCookie: string }> {
  const res = await connect(new Request(`${ORIGIN}/api/facebook/connect`));
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
