// เพื่อนชวนเพื่อน (owner, 2026-10-14). Browser-safe: no server imports.
// The database side is store.ts; the rules for rewarding are in supabase/migrations/20261103_referrals.sql.

export type ReferrerKind = "member" | "unitos";

export interface ReferralSettings {
  enabled: boolean;
  /** free days a member is given per friend who pays, and at most this many a Thai month */
  days: number;
  daysCap: number;
  /** satang a UnitOS agent is given per friend who pays, and at most this many a Thai month */
  satang: number;
  satangCap: number;
}

// Off until the owner turns it on, so a deploy changes nothing by itself.
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: false,
  days: 3,
  daysCap: 30,
  satang: 1000,
  satangCap: 10000,
};

/** the cookie /r/CODE leaves, read when the visitor signs up with Google */
export const REF_COOKIE = "ref";
/** how long an invitation is remembered (owner, 2026-10-14) */
export const REF_COOKIE_DAYS = 30;
export const REF_PATH = "/r/";

// no 0/O or 1/I: the code is read out over the phone and typed off a screenshot
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /^[A-Z0-9]{6,12}$/;
export const CODE_LENGTH = 7;

/** A code as typed or as the address bar lowered it (src/middleware.ts); null when it cannot be one. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/** A new random code. `random` is for tests. */
export function newCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}${REF_PATH}${code}`;
}

/**
 * A friend's name as the inviter sees it: the first name and the first letter of the rest
 * ("มานี สุขใจ" → "มานี ส."), so a list of friends does not carry their full names around.
 */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "เพื่อน";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${Array.from(parts[1])[0]}.`;
}

/** Where a friend stands, as the inviter's card says it. */
export type FriendStatus = "rewarded" | "capped" | "revoked" | "trial" | "lapsed" | "waiting";

export interface FriendView {
  name: string;
  status: FriendStatus;
  /** when the reward came, for "rewarded" */
  rewardedAt: string | null;
  /** what it was: days for a member, satang for an agent */
  reward: number;
}

export interface FriendFacts {
  rewardedAt: string | null;
  revokedAt: string | null;
  rewardDays: number | null;
  rewardSatang: number | null;
  /** the friend's own pass right now, as passState says it; null when it could not be read */
  pass: "live" | "expired" | "none" | null;
}

export function friendStatus(f: FriendFacts): FriendStatus {
  if (f.revokedAt) return "revoked";
  if (f.rewardedAt) return (f.rewardDays ?? 0) > 0 || (f.rewardSatang ?? 0) > 0 ? "rewarded" : "capped";
  if (f.pass === "live") return "trial";
  if (f.pass === "expired") return "lapsed";
  return "waiting";
}

/** the tally at the top of the card */
export function tally(friends: FriendView[]): { joined: number; paid: number; reward: number } {
  const paid = friends.filter((f) => f.status === "rewarded" || f.status === "capped");
  return { joined: friends.length, paid: paid.length, reward: paid.reduce((s, f) => s + f.reward, 0) };
}

/** A reward this recent is marked ใหม่ on the card: there is no notification to tell them otherwise. */
export const NEW_REWARD_MS = 3 * 24 * 60 * 60 * 1000;
