// What the invite card shows one viewer (server only): on /membership for a member, on /home
// for a UnitOS agent (owner, 2026-10-14).
import { can, type Viewer } from "@/lib/auth/access";
import { passSettings } from "@/lib/members/pass-store";
import { siteOrigin } from "@/lib/site-url";
import { referralLink, type FriendView, type ReferrerKind } from "./referral";
import { codeFor, friendsOf, referralSettings } from "./store";

export interface ReferralCardData {
  kind: ReferrerKind;
  link: string;
  /** what one friend who pays brings: days for a member, satang for an agent */
  per: number;
  /** the most a Thai month brings, in the same unit */
  cap: number;
  friends: FriendView[];
}

/**
 * null when there is no card to show: the switch is off, or the members' pass is (a friend then
 * never pays, so an invitation earns nothing), or the viewer is the owner, who has no wallet.
 * Throws when the database does; the pages leave the card off then.
 */
export async function referralCard(viewer: Viewer, now: Date = new Date()): Promise<ReferralCardData | null> {
  if (viewer.kind === "unitos" && can(viewer, "owner")) return null;
  const [settings, pass] = await Promise.all([referralSettings(), passSettings()]);
  if (!settings.enabled || !pass.enabled) return null;
  const kind: ReferrerKind = viewer.kind === "member" ? "member" : "unitos";
  const [code, friends] = await Promise.all([codeFor(viewer.agentId, kind), friendsOf(viewer.agentId, now)]);
  return {
    kind,
    link: referralLink(siteOrigin(), code),
    per: kind === "member" ? settings.days : settings.satang,
    cap: kind === "member" ? settings.daysCap : settings.satangCap,
    friends,
  };
}
