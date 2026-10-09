import { NextResponse } from "next/server";
import { clientIp } from "@/lib/assistant/rate-limit";
import { checkIdToken, exchangeCode, GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, loginWithError, readLogin } from "@/lib/auth/google";
import { memberFromGoogle } from "@/lib/auth/google-member";
import { startSession } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * Where Google sends the visitor back. The login is taken only from the cookie this browser
 * got on the way out, and the cookie is spent here whatever the outcome. Anything wrong goes
 * back to the sign-in on the front page with a code its page turns into words (GOOGLE_ERRORS).
 */
export async function GET(req: Request) {
  const res = await finish(req);
  res.cookies.set(GOOGLE_COOKIE, "", { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  return res;
}

/** The cookie as the browser sent it (base64url and a dot: never encoded). */
function cookieFrom(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

async function finish(req: Request): Promise<NextResponse> {
  const origin = requestOrigin(req);
  const params = new URL(req.url).searchParams;
  const login = readLogin(cookieFrom(req, GOOGLE_COOKIE));
  const next = login?.next ?? "/studio";
  const back = (error: Parameters<typeof loginWithError>[1]) => NextResponse.redirect(loginWithError(origin, error, next));

  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  if (!login || !code || params.get("state") !== login.state) return back("state");

  let id: string;
  // startSession and the redirect stay outside: a failure past this point is the system's
  try {
    const user = checkIdToken(await exchangeCode(code, login.verifier, origin), login.nonce);
    if (!user.ok) return back(user.error);
    const member = await memberFromGoogle(user, clientIp(req.headers));
    if (!member.ok) return back(member.error);
    id = member.id;
  } catch (e) {
    console.error("google sign-in failed:", e);
    return back("broken");
  }
  await startSession(id);
  return NextResponse.redirect(`${origin}${next}`);
}
