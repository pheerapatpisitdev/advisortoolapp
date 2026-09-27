import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

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
 * which is still the passphrase of the encrypted keys and tokens. Reusing it means Vercel
 * needs nothing new; it is never rotated, because that would lock the keys away.
 */
function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
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
  /** when it was issued, ms — UnitOS's key_epoch shuts out anything issued before it */
  issuedAt: number;
}

/** `<agentId>.<issuedAt>.<expires>.<mac>` — every part signed, so none can be swapped. */
export function encodeSession(agentId: string, issuedAt: number, expires: number, key: string): string {
  const body = `${agentId}.${issuedAt}.${expires}`;
  return `${body}.${mac(body, key)}`;
}

export function decodeSession(raw: string, key: string, now: number): Session | null {
  const parts = raw.split(".");
  if (parts.length !== 4) return null;
  const [agentId, issued, expires, signature] = parts;
  if (!/^[0-9a-f-]{36}$/.test(agentId) || !/^\d+$/.test(issued) || !/^\d+$/.test(expires)) return null;
  if (!safeEqual(signature, mac(`${agentId}.${issued}.${expires}`, key))) return null;
  if (Number(expires) <= now) return null;
  return { agentId, issuedAt: Number(issued) };
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw, secret(), Date.now()) : null;
}

/** Only from a server action or a route: a page cannot set a cookie. */
export async function startSession(agentId: string): Promise<void> {
  const now = Date.now();
  (await cookies()).set(SESSION_COOKIE, encodeSession(agentId, now, now + TTL_MS, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
