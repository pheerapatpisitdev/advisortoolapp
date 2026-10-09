import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ startSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);
const viewer = vi.hoisted(() => ({ getViewer: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
const members = vi.hoisted(() => ({ memberFromGoogle: vi.fn() }));
vi.mock("@/lib/auth/google-member", () => members);

const { GET: start } = await import("@/app/auth/google/route");
const { GET: callback } = await import("@/app/auth/google/callback/route");
const { newLogin, sealLogin } = await import("@/lib/auth/google");

const ORIGIN = "https://advisortool.example";
const get = (path: string, cookie?: string) =>
  new Request(`${ORIGIN}${path}`, { headers: { host: "advisortool.example", "x-real-ip": "1.2.3.4", ...(cookie ? { cookie } : {}) } });

const jwt = (payload: object) => `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const claims = (nonce: string, over: object = {}) => ({
  iss: "https://accounts.google.com", aud: "cid", exp: Date.now() / 1000 + 600, nonce,
  sub: "g-1", email: "somchai@gmail.com", email_verified: true, name: "สมชาย", ...over,
});
const googleSays = (body: object, status = 200) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret");
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
  viewer.getViewer.mockResolvedValue(null);
  members.memberFromGoogle.mockResolvedValue({ ok: true, id: "m1" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /auth/google", () => {
  it("sends the visitor to Google with the login kept in a cookie for the callback only", async () => {
    const res = await start(get("/auth/google?next=/studio/draft"));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.host).toBe("accounts.google.com");
    expect(to.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/google/callback`);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^ins_google=[\w-]+\.[\w-]+;/);
    expect(cookie).toContain("Path=/auth/google/callback");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("lets somebody already signed in go straight on", async () => {
    viewer.getViewer.mockResolvedValue({ agentId: "m1" });
    const res = await start(get("/auth/google?next=/studio/draft"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/studio/draft`);
  });

  it("never sends anybody off the site afterwards", async () => {
    const res = await start(get("/auth/google?next=//evil.example"));
    const cookie = res.headers.get("set-cookie")!.split(";")[0].split("=")[1];
    const body = JSON.parse(Buffer.from(cookie.split(".")[0], "base64url").toString());
    expect(body.next).toBe("/studio");
  });

  it("says so on /login when Google is not set up", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const res = await start(get("/auth/google?next=/"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/?error=unconfigured&next=%2F`);
  });
});

describe("GET /auth/google/callback", () => {
  const begun = (next = "/studio") => {
    const login = newLogin(next);
    return { login, cookie: `ins_google=${sealLogin(login)}` };
  };

  it("signs the member in and goes where they were headed, spending the cookie", async () => {
    const { login, cookie } = begun("/");
    const fetchMock = googleSays({ id_token: jwt(claims(login.nonce)) });
    const res = await callback(get(`/auth/google/callback?code=c1&state=${login.state}`, cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(members.memberFromGoogle).toHaveBeenCalledWith({ ok: true, sub: "g-1", email: "somchai@gmail.com", name: "สมชาย" }, "1.2.3.4");
    expect(session.startSession).toHaveBeenCalledWith("m1");
    expect(res.headers.get("set-cookie")).toMatch(/ins_google=;.*Max-Age=0/);
  });

  it("refuses a state that is not the one this browser began", async () => {
    const { cookie } = begun();
    const res = await callback(get("/auth/google/callback?code=c1&state=forged", cookie));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/?error=state&next=%2Fstudio`);
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("refuses a callback from a browser that began nothing", async () => {
    const { login } = begun();
    const res = await callback(get(`/auth/google/callback?code=c1&state=${login.state}`));
    expect(res.headers.get("location")).toContain("/?error=state");
  });

  it("comes back quietly when the visitor cancelled at Google", async () => {
    const { login, cookie } = begun();
    const res = await callback(get(`/auth/google/callback?error=access_denied&state=${login.state}`, cookie));
    expect(res.headers.get("location")).toContain("/?error=cancelled");
  });

  it("refuses an ID token minted for another login", async () => {
    const { login, cookie } = begun();
    googleSays({ id_token: jwt(claims("someone-elses-nonce")) });
    const res = await callback(get(`/auth/google/callback?code=c1&state=${login.state}`, cookie));
    expect(res.headers.get("location")).toContain("/?error=state");
    expect(members.memberFromGoogle).not.toHaveBeenCalled();
  });

  it("passes on why a Google account was not let in", async () => {
    const { login, cookie } = begun();
    googleSays({ id_token: jwt(claims(login.nonce)) });
    members.memberFromGoogle.mockResolvedValue({ ok: false, error: "closed" });
    const res = await callback(get(`/auth/google/callback?code=c1&state=${login.state}`, cookie));
    expect(res.headers.get("location")).toContain("/?error=closed");
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it("says the system failed when Google or the database does", async () => {
    const { login, cookie } = begun();
    googleSays({ error: "invalid_grant" }, 400);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await callback(get(`/auth/google/callback?code=c1&state=${login.state}`, cookie));
    expect(res.headers.get("location")).toContain("/?error=broken");
  });
});
