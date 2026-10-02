import { supabaseAdmin } from "@/lib/supabase/admin";
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
  /** free rounds used, at most FREE_ROUNDS */
  freeUsed: number;
}

/** The newest members for the owner's page, each with their wallet and their free rounds. */
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
  // one count per member: a select of the rounds themselves would stop at 1000 rows
  const used = await Promise.all(rows.map(async (r) => {
    const { count, error: e } = await supabaseAdmin().from("ins_audit").select("id", { count: "exact", head: true })
      .eq("agent_id", r.id).in("action", [...AI_ROUNDS]).gte("at", FREE_ROUNDS_FROM.toISOString());
    if (e) throw new Error(`อ่านรอบฟรีไม่ได้: ${e.message}`);
    return Math.min(count ?? 0, FREE_ROUNDS);
  }));
  return rows.map((r, i) => ({
    id: r.id, name: r.name, email: r.email, status: r.status, createdAt: r.created_at,
    balanceSatang: balance.get(r.id) ?? 0, freeUsed: used[i],
  }));
}
