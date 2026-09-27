import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes are case-sensitive, and the plans are not written the way their routes are.
 *
 * "iShield" is how the company spells it — on the proposal, in the adverts, in the page's
 * own title — so /iShield is what an agent types from memory and what a customer copies off
 * something printed. It answered 404, which is not a thing a landing page for an advert may
 * do. Anything with a capital in it is sent to the all-lowercase path instead.
 *
 * This is a redirect rather than a rule in next.config.ts because `redirects()` matches its
 * source without regard to case: a rule listing "/iShield" also catches "/ishield", and the
 * real page redirects to itself forever. Here the path is only rewritten when it actually
 * differs from its lowercase form, so a page that is already right is never touched.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lowered = pathname.toLowerCase();
  if (pathname === lowered) {
    // the address asked for, for a layout's sign-in gate to come back to (src/lib/auth/viewer.ts):
    // a layout is not told which of its pages is being opened
    const headers = new Headers(request.headers);
    headers.set("x-pathname", `${pathname}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = lowered;
  return NextResponse.redirect(url, 308);
}

export const config = {
  /**
   * Everything except Next's own assets and the files served straight off /public — a
   * capital in an image's filename is the filename, not a typo to correct.
   */
  matcher: ["/((?!_next/|api/|.*\\.).*)"],
};
