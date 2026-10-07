import { createHmac, timingSafeEqual } from "node:crypto";
import { adminSecret, deriveKey } from "@/lib/auth/keys";

/**
 * The ask for a card with the customer's own photo on it.
 *
 * The card route is public and its drawings are shared through the CDN, so a customer's face
 * can neither be named in an ordinary card link nor be cached under one. This is the other
 * door: the bot signs "this Page's customer, for the next few minutes" and fetches the card
 * itself. The route verifies it, asks Meta for the picture there and then (a picture's address
 * from Meta expires, so none is kept), and draws it into a card nobody else is served.
 *
 * Carries the Page and the customer's id on it, not the picture's address: a forged token
 * cannot make the route fetch anything, and a stale one cannot show an old photo.
 */
const LIFE_MS = 10 * 60_000;

function mac(body: string): string {
  return createHmac("sha256", deriveKey(adminSecret(), "card-photo")).update(body).digest("base64url");
}

export function signCardPhoto(pageId: string, psid: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify([now + LIFE_MS, pageId, psid])).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyCardPhoto(token: string, now = Date.now()): { pageId: string; psid: string } | null {
  const [body, sig, ...rest] = token.split(".");
  if (!body || !sig || rest.length) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const [expires, pageId, psid] = JSON.parse(Buffer.from(body, "base64url").toString()) as [unknown, unknown, unknown];
    if (typeof expires !== "number" || expires < now) return null;
    if (typeof pageId !== "string" || typeof psid !== "string" || !pageId || !psid) return null;
    return { pageId, psid };
  } catch {
    return null;
  }
}

/** A card path asked for with the customer's photo: only the plain quote card draws one. */
export function withCustomerPhoto(cardPath: string, pageId: string, psid: string): string | null {
  if (!cardPath.startsWith("/api/card?")) return null;
  return `${cardPath}&ph=${signCardPhoto(pageId, psid)}`;
}
