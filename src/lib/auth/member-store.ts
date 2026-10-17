import { supabaseAdmin } from "@/lib/supabase/admin";
import { onTrial, passState, roundsFrom } from "@/lib/members/pass";
import { passRowsOf, passSettings } from "@/lib/members/pass-store";
import type { MemberRow } from "./access";
import { AI_ROUNDS, FREE_ROUNDS, FREE_ROUNDS_FROM } from "./quota";

/**
 * The reads and writes of ins_members (supabase/migrations/20261001_outside_members.sql, Google
 * accounts since 20261002_members_google.sql) and of the sign-up switch. The rules they are checked against are in ./member.ts.
 */

const MEMBER_COLUMNS = "id, google_sub, email, name, status, revoked_at";

export type MemberWithSub = MemberRow & { google_sub: string };

export async function memberByGoogleSub(sub: string): Promise<MemberWithSub | null> {
  const { data, error } = await supabaseAdmin().from("ins_members").select(MEMBER_COLUMNS).eq("google_sub", sub).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสมาชิกไม่ได้: ${error.message}`);
  return (data as MemberWithSub | null) ?? null;
}

/** `taken` when the Google account already has one — the unique index decides, so two at once cannot both win. */
export async function createMember(m: { googleSub: string; email: string; name: string; ip: string }): Promise<{ ok: true; id: string } | { ok: false; taken: true }> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .insert({ google_sub: m.googleSub, email: m.email, name: m.name, signup_ip: m.ip }).select("id").single();
  if (error?.code === "23505") return { ok: false, taken: true };
  if (error) throw new Error(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function setEmail(id: string, email: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").update({ email }).eq("id", id);
  if (error) throw new Error(`บันทึกอีเมลไม่สำเร็จ: ${error.message}`);
}

export async function setName(id: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").update({ name }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนชื่อไม่สำเร็จ: ${error.message}`);
}

/**
 * Suspending also stamps revoked_at, so every session issued before it is over for good:
 * without it, reinstating the member would bring their old cookies back to life. `at` is the
 * app's clock, the one sessions are stamped with.
 */
export async function setStatus(id: string, status: "active" | "suspended", at: Date = new Date()): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members")
    .update(status === "suspended" ? { status, revoked_at: at.toISOString() } : { status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
}

/** Takes back an account that was opened past the address's daily limit (./google-member.ts). */
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").delete().eq("id", id);
  if (error) throw new Error(`ลบบัญชีไม่สำเร็จ: ${error.message}`);
}

export interface MemberFiles {
  /** ins_content ids: each has a folder in content-media and content-video */
  pieces: string[];
  /** ins_people ids: each has a folder of photos in content-people */
  people: string[];
  /** ins_quote_videos ids: each has a folder in quote-video */
  videos: string[];
  /** content-media paths of the member's logos */
  logos: string[];
}

/**
 * ลบสมาชิก for good (owner, 2026-10-14): every row of theirs, in one transaction
 * (supabase/migrations/20261104_member_delete.sql). The database refuses one that is not
 * suspended. Returns the Storage files the rows pointed at, for the caller to clear.
 */
export async function purgeMember(id: string): Promise<{ ok: true; files: MemberFiles } | { ok: false; why: "not-found" | "not-suspended" }> {
  const { data, error } = await supabaseAdmin().rpc("ins_member_delete", { p_member: id });
  if (error?.message.includes("member-not-found")) return { ok: false, why: "not-found" };
  if (error?.message.includes("member-not-suspended")) return { ok: false, why: "not-suspended" };
  if (error) throw new Error(`ลบสมาชิกไม่สำเร็จ: ${error.message}`);
  const d = (data ?? {}) as Partial<Record<keyof MemberFiles, unknown>>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { ok: true, files: { pieces: list(d.pieces), people: list(d.people), videos: list(d.videos), logos: list(d.logos) } };
}

export async function signupsFromIp(ip: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin().from("ins_members").select("id", { count: "exact", head: true })
    .eq("signup_ip", ip).gte("created_at", since.toISOString());
  if (error) throw new Error(`นับการสมัครไม่ได้: ${error.message}`);
  return count ?? 0;
}

export interface MemberSettings {
  /** a Google account with no member yet is given one (owner's switch, /admin/members) */
  signupOpen: boolean;
}

export async function memberSettings(): Promise<MemberSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("member_signup_enabled").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
  return { signupOpen: data?.member_signup_enabled === true };
}

export async function saveMemberSettings(s: MemberSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, member_signup_enabled: s.signupOpen, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  createdAt: string;
  balanceSatang: number;
  /** free rounds used in the member's current window, at most freeLimit */
  freeUsed: number;
  /** the live pass's rounds (none since the credit), or the one-time FREE_ROUNDS (owner, 2026-10-13) */
  freeLimit: number;
  /** the pass's Studio credit left now (owner, 2026-10-17); 0 with no live lot */
  creditSatang: number;
  /** what a delete would take, counted for suspended members only (the only ones ลบ shows on) */
  footprint: { pieces: number; customers: number; people: number } | null;
  /** null while the owner has the pass switched off; `end` is the last period's end */
  pass: { status: "none" | "live" | "expired"; end: string | null; trial: boolean } | null;
}

/**
 * The newest members for the owner's page, each with their wallet, their pass and their free
 * rounds. The pass ledger is read once for the whole list; each member's rounds are counted from
 * their live period, or from FREE_ROUNDS_FROM like before the pass (owner, 2026-10-13).
 */
export async function listMembers(limit = 200): Promise<MemberSummary[]> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .select("id, name, email, status, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านรายชื่อสมาชิกไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { id: string; name: string; email: string; status: "active" | "suspended"; created_at: string }[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: wallets, error: walletError } = await supabaseAdmin().from("ins_wallets")
    .select("agent_id, balance_satang").in("agent_id", ids);
  if (walletError) throw new Error(`อ่านกระเป๋าสมาชิกไม่ได้: ${walletError.message}`);
  const balance = new Map(((wallets ?? []) as { agent_id: string; balance_satang: number }[]).map((w) => [w.agent_id, Number(w.balance_satang)]));
  const [settings, ledger] = await Promise.all([passSettings(), passRowsOf(ids)]);
  const now = new Date();
  const states = rows.map((r) => passState(ledger.get(r.id) ?? [], now));
  // one count per member: a select of the rounds themselves would stop at 1000 rows
  const windows = states.map((s) => roundsFrom(s, settings) ?? { limit: FREE_ROUNDS, from: FREE_ROUNDS_FROM });
  const used = await Promise.all(rows.map(async (r, i) => {
    const { count, error: e } = await supabaseAdmin().from("ins_audit").select("id", { count: "exact", head: true })
      .eq("agent_id", r.id).in("action", [...AI_ROUNDS]).gte("at", windows[i].from.toISOString());
    if (e) throw new Error(`อ่านรอบฟรีไม่ได้: ${e.message}`);
    return Math.min(count ?? 0, windows[i].limit);
  }));
  const footprints = await Promise.all(rows.map((r) => (r.status === "suspended" ? footprintOf(r.id) : null)));
  const credit = settings.enabled ? await creditLeftOf(ids, now) : new Map<string, number>();
  return rows.map((r, i) => {
    const s = states[i];
    return {
      id: r.id, name: r.name, email: r.email, status: r.status, createdAt: r.created_at,
      balanceSatang: balance.get(r.id) ?? 0, freeUsed: used[i], freeLimit: windows[i].limit,
      creditSatang: credit.get(r.id) ?? 0, footprint: footprints[i],
      pass: !settings.enabled ? null
        : s.status === "none" ? { status: "none", end: null, trial: false }
        : { status: s.status, end: s.end.toISOString(), trial: onTrial(s) },
    };
  });
}

/** each member's live Studio credit, in one query, as ins_wallet_hold counts it */
async function creditLeftOf(ids: string[], now: Date): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin().from("ins_member_credits").select("member_id, left_satang")
    .in("member_id", ids).is("voided_at", null).gt("left_satang", 0)
    .lte("starts_at", now.toISOString()).gt("expires_at", now.toISOString());
  if (error) throw new Error(`อ่านเครดิตสมาชิกไม่ได้: ${error.message}`);
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { member_id: string; left_satang: number }[]) {
    out.set(r.member_id, (out.get(r.member_id) ?? 0) + Number(r.left_satang));
  }
  return out;
}

async function footprintOf(id: string): Promise<NonNullable<MemberSummary["footprint"]>> {
  const count = async (table: "ins_content" | "ins_fhc_customers" | "ins_people") => {
    const { count: n, error } = await supabaseAdmin().from(table).select("id", { count: "exact", head: true }).eq("agent_id", id);
    if (error) throw new Error(`นับงานของสมาชิกไม่ได้: ${error.message}`);
    return n ?? 0;
  };
  const [pieces, customers, people] = await Promise.all([count("ins_content"), count("ins_fhc_customers"), count("ins_people")]);
  return { pieces, customers, people };
}
