import { NextResponse } from "next/server";
import { clientIp } from "@/lib/assistant/rate-limit";
import { backofficeWithError, checkIdToken, exchangeCode, GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, loginWithError, readLogin } from "@/lib/auth/google";
import { memberFromGoogle } from "@/lib/auth/google-member";
import { superFromGoogle } from "@/lib/auth/google-super";
import { startSession } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/facebook/origin";
import { REF_COOKIE } from "@/lib/referrals/referral";
import { attachReferral } from "@/lib/referrals/store";

export const dynamic = "force-dynamic";

/**
 * Where Google sends the visitor back. The login is taken only from the cookie this browser
 * got on the way out, and the cookie is spent here whatever the outcome. Anything wrong goes
 * back to the sign-in on the front page with a code its page turns into words (GOOGLE_ERRORS).
 */
export async function GET(req: Request) {
  const { res, created } = await finish(req);
  res.cookies.set(GOOGLE_COOKIE, "", { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  // an invitation is spent by the account it made; one that made none is kept for its 30 days
  if (created) res.cookies.set(REF_COOKIE, "", { path: "/", maxAge: 0 });
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

async function finish(req: Request): Promise<{ res: NextResponse; created: boolean }> {
  const origin = requestOrigin(req);
  const params = new URL(req.url).searchParams;
  const login = readLogin(cookieFrom(req, GOOGLE_COOKIE));
  const next = login?.next ?? "/studio";
  // the Super Admin's login goes back to /backoffice, never to the members' door (owner, 2026-10-15)
  const backoffice = login?.mode === "backoffice";
  const back = (error: Parameters<typeof loginWithError>[1]) => ({
    res: NextResponse.redirect(backoffice ? backofficeWithError(origin, error) : loginWithError(origin, error, next)),
    created: false,
  });

  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  if (!login || !code || params.get("state") !== login.state) return back("state");

  let id: string;
  let created: boolean;
  // startSession and the redirect stay outside: a failure past this point is the system's
  try {
    const user = checkIdToken(await exchangeCode(code, login.verifier, origin), login.nonce);
    if (!user.ok) return back(user.error);
    if (backoffice) {
      const admin = await superFromGoogle(user);
      if (!admin.ok) {
        console.warn(`backoffice sign-in refused for ${user.email}`);
        return back(admin.error);
      }
      await startSession(admin.id);
      return { res: NextResponse.redirect(`${origin}/admin`), created: false };
    }
    const member = await memberFromGoogle(user, clientIp(req.headers));
    if (!member.ok) return back(member.error);
    id = member.id;
    created = member.created;
  } catch (e) {
    console.error("google sign-in failed:", e);
    return back("broken");
  }
  // who invited a new account (เพื่อนชวนเพื่อน, owner 2026-10-14); failing to note it never stops the sign-in
  const invited = created ? cookieFrom(req, REF_COOKIE) : null;
  if (invited) await attachReferral(id, invited).catch((e) => console.error(`referral of new member ${id} not noted:`, e));
  await startSession(id);
  return { res: NextResponse.redirect(`${origin}${next}`), created };
}
