import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveKey } from "./keys";

/**
 * ถาม AI for somebody not signed in: three questions, then an invitation to sign up
 * (owner, 2026-10-01). Closing the site outright would turn away the customers the ads and
 * the bot send here; three answers show what it does, and every answer costs the owner a
 * model call.
 *
 * The count is kept in the visitor's own cookie, signed like the session, so it cannot be
 * edited — but clearing cookies starts it again. `key` below is the deploy's base secret; the
 * cookie is signed with a key derived from it for this cookie alone (./keys.ts, 2026-10-01). It is a nudge towards signing up, not a
 * wall; the burst limit in src/lib/assistant/rate-limit.ts and the monthly budget are what
 * stop spending.
 */

export const FREE_ASKS = 3;
export const ASKS_COOKIE = "ins_asks";
/** a month: long enough that coming back tomorrow does not hand out three more */
export const ASKS_MAX_AGE_S = 30 * 24 * 60 * 60;

/**
 * Cookies signed before the key was derived — with the base secret itself, from 2026-10-01 —
 * are still read until every one of them has run out (a month), so nobody who had asked one
 * question is told they have used all three.
 */
export const LEGACY_ASKS_UNTIL = Date.parse("2026-11-01T00:00:00+07:00");

function mac(n: number, key: string): string {
  return createHmac("sha256", key).update(`asks:${n}`).digest("hex");
}

function matches(signature: string, n: number, key: string): boolean {
  const want = Buffer.from(mac(n, key));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** `<count>.<mac>` */
export function encodeAsks(n: number, key: string): string {
  return `${n}.${mac(n, deriveKey(key, "free-asks"))}`;
}

/** Questions used: 0 with no cookie; all of them for one that does not verify. */
export function decodeAsks(raw: string | undefined, key: string, now = Date.now()): number {
  if (!raw) return 0;
  const [count, signature] = raw.split(".");
  if (!/^\d{1,3}$/.test(count ?? "") || !signature) return FREE_ASKS;
  const n = Number(count);
  if (matches(signature, n, deriveKey(key, "free-asks"))) return n;
  if (now < LEGACY_ASKS_UNTIL && matches(signature, n, key)) return n;
  return FREE_ASKS;
}

/** The home page's "ลอง Studio ฟรี" bar: for somebody not signed in, while sign-up is open. */
export function inviteToTry(signedIn: boolean, signupOpen: boolean): boolean {
  return !signedIn && signupOpen;
}
