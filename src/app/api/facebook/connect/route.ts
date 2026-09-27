import { NextResponse } from "next/server";
import { adsOauthIsConfigured, authorizeUrl, makeState, oauthIsConfigured, type LoginPurpose } from "@/lib/facebook/oauth";
import { requestOrigin } from "@/lib/facebook/origin";
import { can } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

/**
 * Sends the owner to Facebook's own login screen. Nothing is stored until they come back.
 *
 * `?for=ads` is the same screen for the advertising account; where the person lands on the
 * way back depends on it, so the purpose is signed into the state rather than trusted from
 * the callback's query string.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const purpose: LoginPurpose = new URL(req.url).searchParams.get("for") === "ads" ? "ads" : "pages";
  const home = purpose === "ads" ? "/admin/ads" : "/admin/messenger";
  // Pages are the staff's with can_connect; the ad account is the back office's (2026-09-27)
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(home)}`);
  if (!can(viewer, purpose === "ads" ? "admin" : "connect")) return NextResponse.redirect(`${origin}/studio`);
  const ready = purpose === "ads" ? adsOauthIsConfigured() : oauthIsConfigured();
  if (!ready) {
    return NextResponse.redirect(`${origin}${home}?fb=unconfigured`);
  }
  return NextResponse.redirect(authorizeUrl(origin, makeState(purpose), purpose));
}
