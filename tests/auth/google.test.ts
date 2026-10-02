import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  authorizeUrl, checkIdToken, exchangeCode, GOOGLE_COOKIE_PATH, googleIsConfigured, newLogin, readLogin, sealLogin,
} from "@/lib/auth/google";

const NOW = Date.parse("2026-10-02T12:00:00Z");

beforeEach(() => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret");
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("googleIsConfigured", () => {
  it("needs both the id and the secret", () => {
    expect(googleIsConfigured()).toBe(true);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(googleIsConfigured()).toBe(false);
  });
});

describe("the login cookie", () => {
  it("comes back as it went out, next included", () => {
    const login = newLogin("/studio?x=1.2", NOW);
    expect(readLogin(sealLogin(login), NOW + 1000)).toEqual(login);
  });

  it("makes fresh random state, verifier and nonce each time", () => {
    const a = newLogin("/", NOW);
    const b = newLogin("/", NOW);
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it("is refused once ten minutes are up", () => {
    const sealed = sealLogin(newLogin("/", NOW));
    expect(readLogin(sealed, NOW + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it("is refused when anything in it was changed", () => {
    const sealed = sealLogin(newLogin("/", NOW));
    const [body, mac] = sealed.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), next: "/admin" })).toString("base64url");
    expect(readLogin(`${forged}.${mac}`, NOW)).toBeNull();
    expect(readLogin(`${body}.${"0".repeat(mac.length)}`, NOW)).toBeNull();
    expect(readLogin("junk", NOW)).toBeNull();
    expect(readLogin(null, NOW)).toBeNull();
  });

  it("is refused when signed under another secret", () => {
    const sealed = sealLogin(newLogin("/", NOW));
    vi.stubEnv("ADMIN_SESSION_SECRET", "other");
    expect(readLogin(sealed, NOW)).toBeNull();
  });

  it("rides only to the callback", () => {
    expect(GOOGLE_COOKIE_PATH).toBe("/auth/google/callback");
  });
});

describe("authorizeUrl", () => {
  it("asks Google for the code with PKCE, a nonce and the account chooser", () => {
    const login = newLogin("/", NOW);
    const url = new URL(authorizeUrl("https://advisortool.example", login));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("client_id")).toBe("cid.apps.googleusercontent.com");
    expect(q.get("redirect_uri")).toBe("https://advisortool.example/auth/google/callback");
    expect(q.get("response_type")).toBe("code");
    expect(q.get("scope")).toBe("openid email profile");
    expect(q.get("state")).toBe(login.state);
    expect(q.get("nonce")).toBe(login.nonce);
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toBe(createHash("sha256").update(login.verifier).digest("base64url"));
    expect(q.get("prompt")).toBe("select_account");
  });
});

const claims = (over: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com", aud: "cid.apps.googleusercontent.com", exp: NOW / 1000 + 600,
  nonce: "n1", sub: "1234567890", email: "Somchai@Gmail.com", email_verified: true, name: "สมชาย ใจดี", ...over,
});

describe("checkIdToken", () => {
  it("takes Google's word for who this is", () => {
    expect(checkIdToken(claims(), "n1", NOW)).toEqual({ ok: true, sub: "1234567890", email: "somchai@gmail.com", name: "สมชาย ใจดี" });
  });

  it("takes the issuer without its scheme too, as Google sometimes writes it", () => {
    expect(checkIdToken(claims({ iss: "accounts.google.com" }), "n1", NOW).ok).toBe(true);
  });

  it("refuses a token for another app, another issuer, an old one, or another login", () => {
    expect(checkIdToken(claims({ aud: "someone-else" }), "n1", NOW)).toEqual({ ok: false, error: "state" });
    expect(checkIdToken(claims({ iss: "https://evil.example" }), "n1", NOW)).toEqual({ ok: false, error: "state" });
    expect(checkIdToken(claims({ exp: NOW / 1000 - 1 }), "n1", NOW)).toEqual({ ok: false, error: "state" });
    expect(checkIdToken(claims({ nonce: "n2" }), "n1", NOW)).toEqual({ ok: false, error: "state" });
    expect(checkIdToken(claims({ sub: "" }), "n1", NOW)).toEqual({ ok: false, error: "state" });
  });

  it("refuses an email Google has not verified", () => {
    expect(checkIdToken(claims({ email_verified: false }), "n1", NOW)).toEqual({ ok: false, error: "unverified" });
    expect(checkIdToken(claims({ email: undefined }), "n1", NOW)).toEqual({ ok: false, error: "unverified" });
  });

  it("leaves the name empty when Google gives none", () => {
    const r = checkIdToken(claims({ name: undefined }), "n1", NOW);
    expect(r).toMatchObject({ ok: true, name: "" });
  });
});

describe("exchangeCode", () => {
  const jwt = (payload: object) => `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

  it("trades the code and verifier for the ID token's claims", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id_token: jwt(claims()) }), { status: 200 }),
    );
    expect(await exchangeCode("the-code", "the-verifier", "https://advisortool.example")).toEqual(claims());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      code: "the-code", code_verifier: "the-verifier", client_id: "cid.apps.googleusercontent.com",
      client_secret: "csecret", redirect_uri: "https://advisortool.example/auth/google/callback", grant_type: "authorization_code",
    });
  });

  it("throws when Google refuses the code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(exchangeCode("x", "y", "https://a.example")).rejects.toThrow(/invalid_grant/);
  });
});
