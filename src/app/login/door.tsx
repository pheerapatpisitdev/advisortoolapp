import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleError } from "@/lib/auth/google";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { REF_COOKIE } from "@/lib/referrals/referral";
import { inviterOf } from "@/lib/referrals/store";
import { LoginForm } from "./LoginForm";

export type DoorParams = Promise<{ next?: string; error?: string }>;

/**
 * The door for UnitOS agents (their code) and for members outside UnitOS, who come in with
 * Google since 2026-10-02 (/auth/google). It stands on the front page (owner, 2026-10-10); /login
 * only passes people on to it. Somebody already signed in goes straight on to where they were
 * headed; when nothing says, the main system at /home (owner, 2026-10-10), whose menu reaches
 * the sales pages, Studio and — for staff — the back office. `error` is why Google's round trip
 * ended here; an unknown one says nothing.
 */
export async function LoginDoor({ searchParams }: { searchParams: DoorParams }) {
  const params = await searchParams;
  // "/" is this door now, so being sent back to it would go round forever: older links say
  // next=/ for the chat; they land on the main page, /home
  const asked = safeNext(params.next, "/home");
  const next = asked === "/" || asked.startsWith("/?") || asked.startsWith("/#") ? "/home" : asked;
  if (await getViewer()) redirect(next);
  // settings that cannot be read hide the sign-up link rather than the door
  const settings = await memberSettings().catch(() => ({ signupOpen: false }));
  // sent here from ถาม AI, which is for members only since 2026-10-12: say why the chat is not there
  const notice = next === "/ask" && params.next !== undefined ? "เข้าระบบก่อนเพื่อใช้ถาม AI" : null;
  // a friend who came through an invitation link (/r/CODE) is greeted by the inviter's first name;
  // an invitation that cannot be read greets nobody
  const ref = (await cookies()).get(REF_COOKIE)?.value;
  const inviter = ref ? await inviterOf(ref).catch(() => null) : null;
  return <LoginForm next={next} signupOpen={settings.signupOpen} error={googleError(params.error)} notice={notice} invitedBy={inviter?.name ?? null} />;
}
