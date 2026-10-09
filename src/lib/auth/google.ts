import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminSecret, deriveKey } from "./keys";

/**
 * สมาชิกทั่วไป sign in with Google (owner, 2026-10-02), in place of the phone and PIN of
 * 2026-10-01. Plain OpenID Connect against Google — the authorization code with PKCE — rather
 * than Supabase Auth, whose project is UnitOS's too, or a library with sessions of its own:
 * Google only says who this is, and the session is ours (./session.ts).
 *
 * The routes are src/app/auth/google; who is let in is ./google-member.ts.
 */

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export function googleIsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID");
  return id;
}

function clientSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_SECRET");
  return s;
}

/** Google compares it with the OAuth client's list character for character. */
export function redirectUri(origin: string): string {
  return `${origin}${GOOGLE_COOKIE_PATH}`;
}

/**
 * One login on its way to Google and back. It waits in a cookie of this browser rather than in
 * the database: the callback takes it only from the browser that began the login, so a
 * callback URL pushed at somebody else finishes nothing (the same reasoning as the Facebook
 * login's, src/lib/facebook/oauth.ts).
 */
export interface PendingLogin {
  /** must come back from Google unchanged */
  state: string;
  /** PKCE: only its hash goes to Google, so a code caught on the way back is useless alone */
  verifier: string;
  /** must be inside the ID token, so a token from another login cannot be replayed into this one */
  nonce: string;
  /** where to go once signed in, already passed through safeNext */
  next: string;
  /** ms */
  expires: number;
}

const LOGIN_TTL_MS = 10 * 60 * 1000;
export const GOOGLE_COOKIE = "ins_google";
export const GOOGLE_COOKIE_PATH = "/auth/google/callback";

/** sameSite=lax: Google's redirect back is a top-level navigation from another site, which strict cookies miss. */
export function googleCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_COOKIE_PATH,
    maxAge: LOGIN_TTL_MS / 1000,
  };
}

const token = (bytes: number) => randomBytes(bytes).toString("base64url");

export function newLogin(next: string, now: number = Date.now()): PendingLogin {
  return { state: token(16), verifier: token(32), nonce: token(16), next, expires: now + LOGIN_TTL_MS };
}

function mac(body: string): string {
  return createHmac("sha256", deriveKey(adminSecret(), "google-login")).update(body).digest("base64url");
}

/** `<base64url JSON>.<mac>` — every field signed, so `next` cannot be swapped on the way. */
export function sealLogin(login: PendingLogin): string {
  const body = Buffer.from(JSON.stringify(login)).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function readLogin(raw: string | null | undefined, now: number = Date.now()): PendingLogin | null {
  if (!raw) return null;
  const [body, signature, extra] = raw.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let login: PendingLogin;
  try {
    login = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PendingLogin;
  } catch {
    return null;
  }
  if (typeof login.expires !== "number" || login.expires <= now) return null;
  if (![login.state, login.verifier, login.nonce, login.next].every((s) => typeof s === "string" && s)) return null;
  return login;
}

export function authorizeUrl(origin: string, login: PendingLogin): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state: login.state,
    nonce: login.nonce,
    code_challenge: createHash("sha256").update(login.verifier).digest("base64url"),
    code_challenge_method: "S256",
    // somebody with two Google accounts picks one, rather than being signed in as whichever was last
    prompt: "select_account",
  });
  return `${AUTHORIZE}?${params}`;
}

export type IdClaims = Record<string, unknown>;

/**
 * The code and the verifier for the ID token's claims. The token comes straight from Google's
 * token endpoint over TLS, so its signature need not be checked (OpenID Connect Core 3.1.3.7);
 * its claims still are, by checkIdToken.
 */
export async function exchangeCode(code: string, verifier: string, origin: string): Promise<IdClaims> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri(origin), grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.id_token) throw new Error(`google token ${res.status}: ${body.error ?? "no id_token"} ${body.error_description ?? ""}`.trim());
  const payload = body.id_token.split(".")[1];
  if (!payload) throw new Error("google token: malformed id_token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdClaims;
}

/** What a login can come back as, besides a member: each has its words on the sign-in page (GOOGLE_ERRORS). */
export type GoogleError = "cancelled" | "state" | "unverified" | "suspended" | "closed" | "limit" | "broken" | "unconfigured";

export const GOOGLE_ERRORS: Record<GoogleError, string> = {
  cancelled: "ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว",
  state: "การเข้าสู่ระบบหมดเวลาหรือไม่ถูกต้อง กรุณาลองใหม่",
  unverified: "บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล",
  suspended: "บัญชีนี้ถูกระงับ กรุณาติดต่อแอดมิน",
  closed: "ยังไม่เปิดรับสมัคร",
  limit: "สมัครจากเครือข่ายนี้ครบแล้ว กรุณาลองใหม่พรุ่งนี้",
  broken: "ระบบขัดข้อง ลองใหม่อีกครั้ง",
  unconfigured: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google",
};

/** The sign-in on the front page with the reason in words, keeping where the visitor was headed. */
export function loginWithError(origin: string, error: GoogleError, next: string): string {
  return `${origin}/?${new URLSearchParams({ error, next })}`;
}

export function googleError(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(GOOGLE_ERRORS, code) ? GOOGLE_ERRORS[code as GoogleError] : null;
}

export type GoogleUser = { ok: true; sub: string; email: string; name: string } | { ok: false; error: GoogleError };

/** Whether the ID token is Google's, for this app and this login, and names a verified email. */
export function checkIdToken(c: IdClaims, nonce: string, now: number = Date.now()): GoogleUser {
  const fresh = typeof c.exp === "number" && c.exp * 1000 > now;
  if (!ISSUERS.includes(c.iss as string) || c.aud !== clientId() || !fresh || c.nonce !== nonce) return { ok: false, error: "state" };
  if (typeof c.sub !== "string" || !c.sub) return { ok: false, error: "state" };
  if (c.email_verified !== true || typeof c.email !== "string" || !c.email) return { ok: false, error: "unverified" };
  return { ok: true, sub: c.sub, email: c.email.toLowerCase(), name: typeof c.name === "string" ? c.name : "" };
}
