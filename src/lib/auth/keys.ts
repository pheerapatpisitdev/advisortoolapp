import { createHmac } from "node:crypto";

/**
 * One key per job, derived from the deploy's secrets (review, 2026-10-01).
 *
 * ADMIN_SESSION_SECRET used to sign the session cookie, the free-questions cookie and the
 * Facebook login's state with the same raw bytes. Nothing could be forged across them today —
 * each signs text the others never sign — but one signature scheme that slipped would have
 * been a way into the others. Each job now signs with HMAC(base secret, its own label), so a
 * MAC made for one is worthless to the rest, and the session's key can be rotated (SESSION_SECRET,
 * src/lib/auth/session.ts) without touching the others.
 *
 * Not used for the stored Facebook and AI tokens: those are encrypted with ADMIN_SESSION_SECRET
 * itself as the passphrase, and a different key would leave every stored token unreadable.
 */
export type KeyPurpose = "session" | "free-asks" | "oauth-state" | "google-login" | "card-photo";

export function deriveKey(base: string, purpose: KeyPurpose): string {
  return createHmac("sha256", base).update(`advisortool:key:${purpose}`).digest("hex");
}

/** The deploy's one long-standing secret, and the base every derived key falls back to. */
export function adminSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}
