import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ถาม AI for somebody not signed in: three questions, then an invitation to sign up
 * (owner, 2026-10-01). Closing the site outright would turn away the customers the ads and
 * the bot send here; three answers show what it does, and every answer costs the owner a
 * model call.
 *
 * The count is kept in the visitor's own cookie, signed like the session, so it cannot be
 * edited — but clearing cookies starts it again. It is a nudge towards signing up, not a
 * wall; the burst limit in src/lib/assistant/rate-limit.ts and the monthly budget are what
 * stop spending.
 */

export const FREE_ASKS = 3;
export const ASKS_COOKIE = "ins_asks";
/** a month: long enough that coming back tomorrow does not hand out three more */
export const ASKS_MAX_AGE_S = 30 * 24 * 60 * 60;

function mac(n: number, key: string): string {
  return createHmac("sha256", key).update(`asks:${n}`).digest("hex");
}

/** `<count>.<mac>` */
export function encodeAsks(n: number, key: string): string {
  return `${n}.${mac(n, key)}`;
}

/** Questions used: 0 with no cookie; all of them for one that does not verify. */
export function decodeAsks(raw: string | undefined, key: string): number {
  if (!raw) return 0;
  const [count, signature] = raw.split(".");
  if (!/^\d{1,3}$/.test(count ?? "") || !signature) return FREE_ASKS;
  const n = Number(count);
  const want = Buffer.from(mac(n, key));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got) ? n : FREE_ASKS;
}

/** The home page's "ลอง Studio ฟรี" bar: for somebody not signed in, while sign-up is open. */
export function inviteToTry(signedIn: boolean, signupOpen: boolean): boolean {
  return !signedIn && signupOpen;
}
