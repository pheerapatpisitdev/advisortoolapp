import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/facebook/origin";
import { cleanCode, REF_COOKIE, REF_COOKIE_DAYS } from "@/lib/referrals/referral";
import { inviterOf } from "@/lib/referrals/store";

export const dynamic = "force-dynamic";

/**
 * An invitation link, /r/CODE (เพื่อนชวนเพื่อน, owner 2026-10-14). The code is remembered for 30
 * days in a cookie the Google sign-up reads (src/app/auth/google/callback/route.ts), and the
 * visitor goes on to the front page, which greets them by the inviter's first name. A code
 * nobody owns, or one that cannot be read, still lands on the front page, with nothing kept.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const res = NextResponse.redirect(`${requestOrigin(req)}/`);
  const code = cleanCode((await params).code);
  if (!code) return res;
  const inviter = await inviterOf(code).catch((e) => {
    console.error("referral: invitation unreadable:", e);
    return null;
  });
  if (!inviter) return res;
  res.cookies.set(REF_COOKIE, code, {
    path: "/",
    maxAge: REF_COOKIE_DAYS * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
