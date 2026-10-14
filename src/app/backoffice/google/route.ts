import { NextResponse } from "next/server";
import { authorizeUrl, backofficeWithError, GOOGLE_COOKIE, googleCookieOptions, googleIsConfigured, newLogin, sealLogin } from "@/lib/auth/google";
import { getViewer } from "@/lib/auth/viewer";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * The Super Admin's one button (owner, 2026-10-15): off to Google with the login marked
 * "backoffice", so the shared callback (src/app/auth/google/callback) checks the address against
 * ins_super_admins instead of making a member.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  if (await getViewer()) return NextResponse.redirect(`${origin}/admin`);
  if (!googleIsConfigured()) return NextResponse.redirect(backofficeWithError(origin, "unconfigured"));
  const login = newLogin("/admin", Date.now(), "backoffice");
  const res = NextResponse.redirect(authorizeUrl(origin, login));
  res.cookies.set(GOOGLE_COOKIE, sealLogin(login), googleCookieOptions());
  return res;
}
