import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { googleError } from "@/lib/auth/google";
import { memberSettings } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { getViewer } from "@/lib/auth/viewer";
import { REF_COOKIE } from "@/lib/referrals/referral";
import { inviterOf } from "@/lib/referrals/store";
import { PriceList } from "@/components/auth/PriceList";
import { isCalcPath } from "@/lib/auth/calc-paths";
import { passSettings } from "@/lib/members/pass-store";
import { frontPricesOf, SIGNUP_HINT, signupHint, type FrontPrices } from "@/lib/pricing/front";
import { referralSettings } from "@/lib/referrals/store";
import { agentStarterCredit, walletSettings } from "@/lib/wallet/store";
import { LoginForm } from "./LoginForm";

export type DoorParams = Promise<{ next?: string; error?: string; premium?: string }>;

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
  const prices = await loadPrices();
  // sent here from ถาม AI, which is for members only since 2026-10-12, or from a calculator,
  // members-only since 2026-10-20: say why the page is not there
  const notice = params.next === undefined ? null
    : next === "/ask" ? "เข้าระบบก่อนเพื่อใช้ถาม AI"
    : isCalcPath(next) ? calcNotice(prices)
    : null;
  // a friend who came through an invitation link (/r/CODE) is greeted by the inviter's first name;
  // an invitation that cannot be read greets nobody
  const ref = (await cookies()).get(REF_COOKIE)?.value;
  const inviter = ref ? await inviterOf(ref).catch(() => null) : null;
  // sent here from UnitOS's menu (/sso) or out of a session, as a basic agent of a room that
  // keeps advisortool for Premium (owner, 2026-10-16)
  const premium = params.premium === "1";
  return (
    <LoginForm
      next={next} signupOpen={settings.signupOpen} error={googleError(params.error)} notice={notice}
      invitedBy={inviter?.name ?? null} premium={premium}
      signupHint={prices ? signupHint(prices.member) : SIGNUP_HINT}
      prices={prices && <PriceList prices={prices} />}
    />
  );
}

/**
 * ค่าบริการ's figures, from the back office (owner, 2026-10-20). The pass settings decide what a
 * member is told; when they cannot be read the list is left out rather than guessed. The rest
 * only drop their own line.
 */
async function loadPrices(): Promise<FrontPrices | null> {
  try {
    const [pass, referral, agentStarterSatang, wallet] = await Promise.all([
      passSettings(),
      referralSettings().catch(() => null),
      agentStarterCredit(),
      walletSettings().catch(() => ({ enabled: false })),
    ]);
    return frontPricesOf({ pass, referral, agentStarterSatang, walletOn: wallet.enabled });
  } catch (e) {
    console.error("price list unreadable, left out:", e instanceof Error ? e.message : e);
    return null;
  }
}

function calcNotice(prices: FrontPrices | null): string {
  const trial = prices?.member.paid && prices.member.trialDays > 0 ? ` หรือสมัครทดลองฟรี ${prices.member.trialDays} วัน` : "";
  return `เครื่องคิดเบี้ยสำหรับสมาชิก เข้าระบบ${trial}`;
}
