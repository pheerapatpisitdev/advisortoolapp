import crypto from "crypto";
import { NextResponse } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";

/**
 * Whether the request carries the cron secret, compared in constant time.
 *
 * `!==` stops at the first differing character, so how long a refusal takes says how much of
 * a guess was right — slow to exploit over the internet, but the webhook check next door
 * (src/lib/facebook/verify.ts) already does this properly and a secret is a secret.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * The refusal for a request no scheduler of ours made, or null when one did: the database's own
 * (pg_cron, with the token it keeps in ins_cron_secret, src/lib/chat/cron-token.ts), which calls
 * the daily jobs since the Cloudflare move's step 2 (owner chose ก 2026-11-02) so that whichever
 * host advisortool.app points at is the one that runs them; or CRON_SECRET, Vercel's, still
 * taken for a call by hand.
 */
export async function refuseUnlessCron(req: Request): Promise<NextResponse | null> {
  const header = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && bearerMatches(header, secret)) return null;
  if (await cronCallerIsOurs(header).catch(() => false)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
