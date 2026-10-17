import "../studio/theme.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { gatePage, type Viewer } from "@/lib/auth/viewer";
import { shellWho } from "@/lib/shell/who";
import { memberAccess } from "@/lib/members/access";
import { creditLeft } from "@/lib/members/credit";
import type { PassState } from "@/lib/members/pass";
import { passRows } from "@/lib/members/pass-store";
import { referralCard } from "@/lib/referrals/card";
import { balanceSatang } from "@/lib/wallet/store";
import { MembershipClient, type PassView } from "./MembershipClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "สมาชิก | AdvisorTool" };

const viewOf = (s: PassState): PassView =>
  s.status === "live" ? { status: "live", kind: s.period.kind, end: s.end.toISOString(), periodEnd: s.period.end.toISOString() }
    : s.status === "expired" ? { status: "expired", end: s.end.toISOString() }
    : { status: "none" };

/**
 * An outside member's 30-day pass (owner, 2026-10-13): until when, the Studio credit left this
 * period (2026-10-17), what every 30 days brings, renewing through Stripe, and what was added
 * or taken back. Not gated by the pass — gatePage asks only for a sign-in here — since this is
 * where an expired member is sent. The wallet's page in Studio wears the same palette, so this
 * one does too.
 */
export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const viewer = await gatePage("/membership");
  // the pass is a member's alone; UnitOS agents and staff have nothing to renew
  if (viewer.kind !== "member") redirect("/home");
  const { paid } = await searchParams;

  // the pass itself throws to the error page, as the gate does: a guess here would mislead
  const access = await memberAccess(viewer);
  if (!access.gated) {
    return (
      <Frame viewer={viewer}>
        <MembershipClient on={false} pass={{ status: "none" }} now={new Date().toISOString()} credit={null}
          passCredit={0} priceSatang={0} balanceSatang={null} rows={[]} paid={null} />
      </Frame>
    );
  }
  // read after memberAccess, which may have just started the member's trial
  const rows = await passRows(viewer.agentId);
  const { settings } = access;
  const live = access.state.status === "live";
  // the extras degrade: a count or a balance that cannot be read is left off the page
  const [credit, balance, referral] = await Promise.all([
    // the pass's Studio credit (owner, 2026-10-17), written by memberAccess above
    live ? creditLeft(viewer.agentId).catch((e) => { console.error("membership: credit unreadable:", e); return null; }) : null,
    !live ? balanceSatang(viewer.agentId).catch((e) => { console.error("membership: balance unreadable:", e); return null; }) : null,
    // ชวนเพื่อน (owner, 2026-10-14): left off when the switch is off or it cannot be read
    referralCard(viewer).catch((e) => { console.error("membership: referral card unreadable:", e); return null; }),
  ]);

  return (
    <Frame viewer={viewer}>
      <MembershipClient
        on
        pass={viewOf(access.state)}
        now={new Date().toISOString()}
        credit={credit}
        passCredit={settings.creditSatang}
        priceSatang={settings.satang}
        balanceSatang={balance}
        rows={rows}
        paid={typeof paid === "string" ? paid : null}
        referral={referral}
      />
    </Frame>
  );
}

async function Frame({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  return (
    <div className="content-page">
      <AppShell who={await shellWho(viewer)}>
        {/* pt-16 below lg: the phone's menu button is fixed at the top left */}
        <div className="px-4 pb-10 pt-16 lg:pt-6">{children}</div>
      </AppShell>
    </div>
  );
}
