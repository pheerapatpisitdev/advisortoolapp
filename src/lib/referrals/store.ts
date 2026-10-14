// Database side of เพื่อนชวนเพื่อน (server only). Rewards and their taking back are database
// functions (supabase/migrations/20261103_referrals.sql) that lock the inviter first; nothing here
// adds days or baht with a read and a write of its own.
import { monthStart } from "@/lib/ai/ledger";
import { displayNames } from "@/lib/auth/viewer";
import { passState } from "@/lib/members/pass";
import { passRowsOf } from "@/lib/members/pass-store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  cleanCode, DEFAULT_REFERRAL_SETTINGS, friendStatus, newCode, shortName,
  type FriendView, type ReferralSettings, type ReferrerKind,
} from "./referral";

const code = (e: { code?: string } | null) => e?.code;

export async function referralSettings(): Promise<ReferralSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("referral_enabled, referral_days, referral_days_cap, referral_satang, referral_satang_cap").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าชวนเพื่อนไม่ได้: ${error.message}`);
  if (!data) return DEFAULT_REFERRAL_SETTINGS;
  const d = DEFAULT_REFERRAL_SETTINGS;
  return {
    enabled: data.referral_enabled === true,
    days: data.referral_days ?? d.days,
    daysCap: data.referral_days_cap ?? d.daysCap,
    satang: data.referral_satang ?? d.satang,
    satangCap: data.referral_satang_cap ?? d.satangCap,
  };
}

export async function saveReferralSettings(s: ReferralSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    {
      id: true,
      referral_enabled: s.enabled,
      referral_days: s.days,
      referral_days_cap: s.daysCap,
      referral_satang: s.satang,
      referral_satang_cap: s.satangCap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าชวนเพื่อนไม่ได้: ${error.message}`);
}

/**
 * This person's code, made the first time they ask. Two first asks at once race on owner_id and
 * the loser reads the winner's; a code already taken by someone else is drawn again.
 */
export async function codeFor(ownerId: string, kind: ReferrerKind): Promise<string> {
  const db = supabaseAdmin();
  const read = async () => {
    const { data, error } = await db.from("ins_referral_codes").select("code").eq("owner_id", ownerId).maybeSingle();
    if (error) throw new Error(`อ่านลิงก์ชวนเพื่อนไม่ได้: ${error.message}`);
    return (data as { code: string } | null)?.code ?? null;
  };
  const known = await read();
  if (known) return known;
  for (let i = 0; i < 5; i++) {
    const fresh = newCode();
    const { error } = await db.from("ins_referral_codes").insert({ owner_id: ownerId, owner_kind: kind, code: fresh });
    if (!error) return fresh;
    if (code(error) !== "23505") throw new Error(`สร้างลิงก์ชวนเพื่อนไม่ได้: ${error.message}`);
    const winner = await read();
    if (winner) return winner;
  }
  throw new Error("สร้างลิงก์ชวนเพื่อนไม่ได้: สุ่มรหัสซ้ำหลายครั้ง");
}

export interface Inviter { id: string; kind: ReferrerKind; name: string }

/** Who a code belongs to, by the name the front page greets the friend with; null for no such code. */
export async function inviterOf(raw: unknown): Promise<Inviter | null> {
  const c = cleanCode(raw);
  if (!c) return null;
  const { data, error } = await supabaseAdmin().from("ins_referral_codes").select("owner_id, owner_kind").eq("code", c).maybeSingle();
  if (error) throw new Error(`อ่านลิงก์ชวนเพื่อนไม่ได้: ${error.message}`);
  if (!data) return null;
  const row = data as { owner_id: string; owner_kind: ReferrerKind };
  const names = await displayNames([row.owner_id]);
  // the first name only: the front page is seen by anyone holding the link
  const first = (names[row.owner_id] ?? "").trim().split(/\s+/)[0] || "เพื่อนของคุณ";
  return { id: row.owner_id, kind: row.owner_kind, name: first };
}

/**
 * Ties a member who has just signed up to whoever invited them. Called once, right after the
 * account is made; a second call, an unknown code or an invitation to oneself does nothing.
 */
export async function attachReferral(friendId: string, raw: unknown): Promise<"attached" | "skipped"> {
  const inviter = await inviterOf(raw);
  if (!inviter || inviter.id === friendId) return "skipped";
  const { error } = await supabaseAdmin().from("ins_referrals")
    .insert({ friend_id: friendId, referrer_id: inviter.id, referrer_kind: inviter.kind });
  if (!error) return "attached";
  if (code(error) === "23505") return "skipped";
  throw new Error(`บันทึกผู้ชวนไม่ได้: ${error.message}`);
}

export type RewardResult = "off" | "none" | "not-first" | "done" | "days" | "satang" | "capped";

/**
 * Rewards whoever invited the member whose pass session `sessionId` paid for. Safe to call again
 * for the same session: it rewards once. Throws when the database does, so the webhook answers
 * 500 and Stripe sends the payment again.
 */
export async function rewardReferral(sessionId: string, now: Date = new Date()): Promise<RewardResult> {
  const s = await referralSettings();
  if (!s.enabled) return "off";
  const { data, error } = await supabaseAdmin().rpc("ins_referral_reward", {
    p_session: sessionId,
    p_since: monthStart(now).toISOString(),
    p_days: s.days,
    p_days_cap: s.daysCap,
    p_satang: s.satang,
    p_satang_cap: s.satangCap,
  });
  if (error) throw new Error(`ให้รางวัลชวนเพื่อนไม่ได้: ${error.message}`);
  return data as RewardResult;
}

/** Takes back what a refunded or disputed pass payment earned its inviter. Runs whatever the switch says. */
export async function revokeReferral(paymentIntent: string, note: string): Promise<"none" | "duplicate" | "revoked"> {
  const { data, error } = await supabaseAdmin().rpc("ins_referral_revoke", { p_payment_intent: paymentIntent, p_note: note });
  if (error) throw new Error(`ยกเลิกรางวัลชวนเพื่อนไม่ได้: ${error.message}`);
  return data as "none" | "duplicate" | "revoked";
}

interface ReferralRow {
  friend_id: string;
  referrer_id: string;
  referrer_kind: ReferrerKind;
  created_at: string;
  rewarded_at: string | null;
  reward_days: number | null;
  reward_satang: number | null;
  revoked_at: string | null;
}
const REFERRAL_COLUMNS = "friend_id, referrer_id, referrer_kind, created_at, rewarded_at, reward_days, reward_satang, revoked_at";

/** The friends this person invited, newest first, as their card shows them. */
export async function friendsOf(referrerId: string, now: Date = new Date()): Promise<FriendView[]> {
  const { data, error } = await supabaseAdmin().from("ins_referrals").select(REFERRAL_COLUMNS)
    .eq("referrer_id", referrerId).order("created_at", { ascending: false });
  if (error) throw new Error(`อ่านรายชื่อเพื่อนที่ชวนไม่ได้: ${error.message}`);
  const rows = (data ?? []) as ReferralRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.friend_id);
  const [names, passes] = await Promise.all([
    supabaseAdmin().from("ins_members").select("id, name").in("id", ids),
    // a friend's pass only colours the waiting ones; unreadable, they show as waiting
    passRowsOf(ids).catch((e) => {
      console.error("referral: friends' passes unreadable:", e);
      return null;
    }),
  ]);
  if (names.error) console.error("referral: friends' names unreadable:", names.error.message);
  const nameOf = new Map(((names.data ?? []) as { id: string; name: string | null }[]).map((m) => [m.id, m.name]));
  return rows.map((r) => {
    const pass = passes === null ? null : passState(passes.get(r.friend_id) ?? [], now).status;
    return {
      name: shortName(nameOf.get(r.friend_id)),
      status: friendStatus({ rewardedAt: r.rewarded_at, revokedAt: r.revoked_at, rewardDays: r.reward_days, rewardSatang: r.reward_satang, pass }),
      rewardedAt: r.rewarded_at,
      reward: r.referrer_kind === "member" ? r.reward_days ?? 0 : r.reward_satang ?? 0,
    };
  });
}

export interface ReferrerRow {
  referrerId: string;
  name: string;
  kind: ReferrerKind;
  joined: number;
  paid: number;
  /** given this month, less what was taken back: days for a member, satang for an agent */
  monthReward: number;
}

export interface ReferralReport {
  rows: ReferrerRow[];
  monthDays: number;
  monthSatang: number;
  /** friends who paid for their first pass this month */
  monthPaid: number;
  /** what the friends invited paid for passes this month, refunds left out */
  monthRevenueSatang: number;
}

/** The owner's table: everyone who invited somebody, most friends first. */
export async function referralReport(now: Date = new Date()): Promise<ReferralReport> {
  const since = monthStart(now);
  const { data, error } = await supabaseAdmin().from("ins_referrals").select(REFERRAL_COLUMNS);
  if (error) throw new Error(`อ่านรายงานชวนเพื่อนไม่ได้: ${error.message}`);
  const all = (data ?? []) as ReferralRow[];
  const by = new Map<string, ReferrerRow>();
  let monthDays = 0;
  let monthSatang = 0;
  let monthPaid = 0;
  for (const r of all) {
    const row = by.get(r.referrer_id) ?? { referrerId: r.referrer_id, name: "", kind: r.referrer_kind, joined: 0, paid: 0, monthReward: 0 };
    row.joined++;
    if (r.rewarded_at) row.paid++;
    const thisMonth = r.rewarded_at !== null && new Date(r.rewarded_at) >= since && r.revoked_at === null;
    if (thisMonth) {
      monthPaid++;
      const reward = r.referrer_kind === "member" ? r.reward_days ?? 0 : r.reward_satang ?? 0;
      row.monthReward += reward;
      if (r.referrer_kind === "member") monthDays += reward;
      else monthSatang += reward;
    }
    by.set(r.referrer_id, row);
  }
  const rows = [...by.values()];
  const [names, revenue] = await Promise.all([
    displayNames(rows.map((r) => r.referrerId)),
    friendsRevenueSatang(all.map((r) => r.friend_id), since),
  ]);
  for (const r of rows) r.name = names[r.referrerId] ?? "(ไม่พบชื่อ)";
  rows.sort((a, b) => b.joined - a.joined || b.paid - a.paid || a.name.localeCompare(b.name, "th"));
  return { rows, monthDays, monthSatang, monthPaid, monthRevenueSatang: revenue };
}

/** Pass payments these members made since `since`, less those a revoked row cancels. */
async function friendsRevenueSatang(friendIds: string[], since: Date): Promise<number> {
  if (friendIds.length === 0) return 0;
  const db = supabaseAdmin();
  const paid = await db.from("ins_member_passes").select("id, amount_satang")
    .eq("kind", "paid").in("member_id", friendIds).gte("created_at", since.toISOString());
  if (paid.error) throw new Error(`อ่านรายได้จากเพื่อนที่ชวนไม่ได้: ${paid.error.message}`);
  const rows = (paid.data ?? []) as Array<{ id: number; amount_satang: number | null }>;
  if (rows.length === 0) return 0;
  const gone = await db.from("ins_member_passes").select("revokes").eq("kind", "revoked").in("revokes", rows.map((r) => r.id));
  if (gone.error) throw new Error(`อ่านรายได้จากเพื่อนที่ชวนไม่ได้: ${gone.error.message}`);
  const cancelled = new Set((gone.data ?? []).map((r: { revokes: number }) => r.revokes));
  return rows.filter((r) => !cancelled.has(r.id)).reduce((s, r) => s + (r.amount_satang ?? 0), 0);
}
