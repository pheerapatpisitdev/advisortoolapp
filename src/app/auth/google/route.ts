import { NextResponse } from "next/server";
import { authorizeUrl, GOOGLE_COOKIE, googleCookieOptions, googleIsConfigured, loginWithError, newLogin, sealLogin } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * The member tab's one button (owner, 2026-10-02): off to Google's account chooser. The login
 * waits in a cookie only the callback sees (src/lib/auth/google.ts); nothing is stored here.
 * A plain GET, so the button is a link that works before the page has hydrated.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  if (await getViewer()) return NextResponse.redirect(`${origin}${next}`);
  if (!googleIsConfigured()) return NextResponse.redirect(loginWithError(origin, "unconfigured", next));
  const login = newLogin(next);
  const res = NextResponse.redirect(authorizeUrl(origin, login));
  res.cookies.set(GOOGLE_COOKIE, sealLogin(login), googleCookieOptions());
  return res;
}
