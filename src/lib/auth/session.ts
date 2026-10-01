import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminSecret, deriveKey } from "./keys";

export const SESSION_COOKIE = "ins_session";

/**
 * Seven days, the same as the key UnitOS hands an agent at its own sign-in: an agent who
 * comes here from UnitOS should not be asked again sooner than UnitOS itself asks.
 *
 * The cookie only says who signed in and when. Whether they may still come in is decided on
 * every request from UnitOS's own rows (src/lib/auth/viewer.ts), so a removed agent or a
 * suspended room is shut out at once rather than seven days later.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ADMIN_SESSION_SECRET, which the back office's PIN session signed with until 2026-09-22 and
 * which is still the passphrase of the encrypted keys and tokens — it is never rotated,
 * because that would lock the keys away.
 *
 * Nothing signs with it directly any more (2026-10-01): each cookie derives a key of its own
 * from it (src/lib/auth/keys.ts). Kept under this name for the callers that hand it to such a
 * derivation (the free questions' cookie, src/app/actions.ts).
 */
export function sessionSecret(): string {
  return adminSecret();
}

/**
 * The session's own secret, which can be rotated (review, 2026-10-01). SESSION_SECRET when it
 * is set, ADMIN_SESSION_SECRET when not — so a deploy without it needs nothing new.
 *
 * To rotate: move the current value to SESSION_SECRET_PREVIOUS and put a new one in
 * SESSION_SECRET. New cookies are signed with the new one; cookies signed with the previous
 * one are still read until they run out (seven days), then SESSION_SECRET_PREVIOUS can go.
 * After a leak, leave SESSION_SECRET_PREVIOUS unset instead: everybody signs in again.
 */
function sessionBase(): string {
  return process.env.SESSION_SECRET || adminSecret();
}

/** The key new cookies are signed with. */
function signingKey(): string {
  return deriveKey(sessionBase(), "session");
}

/** The keys a cookie may have been signed with: the current one, then the previous one if any. */
function verifyKeys(): string[] {
  const keys = [signingKey()];
  const previous = process.env.SESSION_SECRET_PREVIOUS;
  if (previous) keys.push(deriveKey(previous, "session"));
  return keys;
}

/**
 * Cookies signed before the keys were derived — with ADMIN_SESSION_SECRET itself — are still
 * read, so the deploy that brought the derived keys in signed nobody out (2026-10-01). Only
 * those issued before this date, and only for their own seven days: whoever holds the raw
 * secret could write any dates into a cookie, so an expiry further than seven days past its
 * issue is refused, and the whole allowance is over by 2026-10-22.
 */
export const LEGACY_SIGNED_BEFORE = Date.parse("2026-10-15T00:00:00+07:00");

/**
 * The legacy allowance stands only while ADMIN_SESSION_SECRET is still the session's secret.
 * Setting SESSION_SECRET is how a leaked secret is answered, and that has to end the cookies
 * the leaked secret could have made.
 */
function legacyKey(): { key: string; issuedBefore: number } | undefined {
  if (process.env.SESSION_SECRET) return undefined;
  return { key: adminSecret(), issuedBefore: LEGACY_SIGNED_BEFORE };
}

function mac(body: string, key: string): string {
  return createHmac("sha256", key).update(`session:${body}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface Session {
  agentId: string;
  /** when it was issued, ms — UnitOS's key_epoch and our own sign-out shut out anything issued before it */
  issuedAt: number;
}

/** `<agentId>.<issuedAt>.<expires>.<mac>` — every part signed, so none can be swapped. */
export function encodeSession(agentId: string, issuedAt: number, expires: number, key: string): string {
  const body = `${agentId}.${issuedAt}.${expires}`;
  return `${body}.${mac(body, key)}`;
}

/**
 * Reads a cookie signed with any of `keys`, or with `legacy.key` if it was issued before
 * `legacy.issuedBefore` and asks for no more than the usual seven days.
 */
export function decodeSession(
  raw: string,
  keys: string | string[],
  now: number,
  legacy?: { key: string; issuedBefore: number },
): Session | null {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [agentId, issued, expires, signature] = parts;
  if (!/^[0-9a-f-]{36}$/.test(agentId) || !/^\d+$/.test(issued) || !/^\d+$/.test(expires)) return null;
  const body = `${agentId}.${issued}.${expires}`;
  let ok = (Array.isArray(keys) ? keys : [keys]).some((key) => safeEqual(signature, mac(body, key)));
  if (!ok && legacy && Number(issued) < legacy.issuedBefore && Number(expires) - Number(issued) <= TTL_MS) {
    ok = safeEqual(signature, mac(body, legacy.key));
  }
  if (!ok) return null;
  if (Number(expires) <= now) return null;
  return { agentId, issuedAt: Number(issued) };
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw, verifyKeys(), Date.now(), legacyKey()) : null;
}

/** Only from a server action or a route: a page cannot set a cookie. */
export async function startSession(agentId: string): Promise<void> {
  const now = Date.now();
  (await cookies()).set(SESSION_COOKIE, encodeSession(agentId, now, now + TTL_MS, signingKey()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** Forgets the cookie in this browser. Ending the agent's other sessions is ./epoch.ts's. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
