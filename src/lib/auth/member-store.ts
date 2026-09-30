import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MemberRow } from "./access";
import { AI_ROUNDS, FREE_ROUNDS, FREE_ROUNDS_FROM } from "./quota";

/**
 * The reads and writes of ins_members (supabase/migrations/20261001_outside_members.sql) and
 * of the two settings that go with it. The rules they are checked against are in ./member.ts.
 */

export type MemberWithPin = MemberRow & { pin_hash: string };

export async function memberByPhone(phone: string): Promise<MemberWithPin | null> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .select("id, phone, name, status, pin_changed_at, pin_hash").eq("phone", phone).maybeSingle();
  if (error) throw new Error(`อ่านข้อมูลสมาชิกไม่ได้: ${error.message}`);
  return (data as MemberWithPin | null) ?? null;
}

/** `taken` when the phone is already somebody's — the unique index decides, so two at once cannot both win. */
export async function createMember(m: { phone: string; name: string; pinHash: string; ip: string }): Promise<{ ok: true; id: string } | { ok: false; taken: true }> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .insert({ phone: m.phone, name: m.name, pin_hash: m.pinHash, signup_ip: m.ip }).select("id").single();
  if (error?.code === "23505") return { ok: false, taken: true };
  if (error) throw new Error(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`);
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * A new PIN, and every session issued before `at` ends (src/lib/auth/access.ts admitMember).
 * `at` is the app's clock, the one sessions are stamped with: the database's could run a few
 * milliseconds ahead and end the session the caller is about to start as well.
 */
export async function setPin(id: string, pinHash: string, at: Date): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members")
    .update({ pin_hash: pinHash, pin_changed_at: at.toISOString() }).eq("id", id);
  if (error) throw new Error(`เปลี่ยน PIN ไม่สำเร็จ: ${error.message}`);
}

export async function setName(id: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members").update({ name }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนชื่อไม่สำเร็จ: ${error.message}`);
}

/**
 * Suspending also stamps pin_changed_at, so every session issued before it is over for good:
 * without it, reinstating the member would bring their old cookies back to life.
 */
export async function setStatus(id: string, status: "active" | "suspended", at: Date = new Date()): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_members")
    .update(status === "suspended" ? { status, pin_changed_at: at.toISOString() } : { status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
}

/** Takes back an account that was opened past the address's daily limit (src/app/signup/actions.ts). */
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

export async function phoneFailures(phone: string, since: Date): Promise<number> {
  const { count, error } = await supabaseAdmin().from("ins_login_attempts").select("id", { count: "exact", head: true })
    .eq("phone", phone).eq("ok", false).gte("created_at", since.toISOString());
  if (error) throw new Error(`นับการเข้าสู่ระบบไม่ได้: ${error.message}`);
  return count ?? 0;
}

/**
 * Forgets a phone's failed attempts. A member who asks for a reset has usually just typed five
 * wrong PINs; without this the temporary PIN would be refused for the rest of the window.
 */
export async function clearPinFailures(phone: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_login_attempts").delete().eq("phone", phone).eq("ok", false);
  if (error) throw new Error(`ล้างการลองใส่ PIN ไม่ได้: ${error.message}`);
}

/**
 * Writes a failed attempt before the PIN is checked, so a burst of parallel guesses counts
 * itself (the same claim-first pattern as the sign-in). Returns the row's id.
 */
export async function claimPinAttempt(ip: string, phone: string): Promise<string> {
  const { data, error } = await supabaseAdmin().from("ins_login_attempts")
    .insert({ ip, ok: false, phone }).select("id").single();
  if (error || !data) throw new Error(`บันทึกการลองใส่ PIN ไม่ได้: ${error?.message ?? "no row"}`);
  return data.id as string;
}

/** The claimed attempt turned out right: it stops counting as a failure. */
export async function markPinAttemptOk(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_login_attempts").update({ ok: true }).eq("id", id);
  if (error) throw new Error(`บันทึกการลองใส่ PIN ไม่ได้: ${error.message}`);
}

/** A refused attempt is taken back, so a locked phone does not extend its own lock. */
export async function releasePinAttempt(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_login_attempts").delete().eq("id", id);
  if (error) throw new Error(`ถอนการลองใส่ PIN ไม่ได้: ${error.message}`);
}

export interface MemberSettings {
  /** /signup takes new members (owner's switch, off until they have tried it) */
  signupOpen: boolean;
  /** where "ลืม PIN? ติดต่อแอดมิน" goes; null shows the words alone */
  contactUrl: string | null;
}

export async function memberSettings(): Promise<MemberSettings> {
  const { data, error } = await supabaseAdmin().from("ins_ai_settings")
    .select("member_signup_enabled, member_contact_url").maybeSingle();
  if (error) throw new Error(`อ่านการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
  const url = typeof data?.member_contact_url === "string" && data.member_contact_url ? data.member_contact_url : null;
  return { signupOpen: data?.member_signup_enabled === true, contactUrl: url };
}

export async function saveMemberSettings(s: MemberSettings): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_ai_settings").upsert(
    { id: true, member_signup_enabled: s.signupOpen, member_contact_url: s.contactUrl, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`บันทึกการตั้งค่าสมาชิกไม่ได้: ${error.message}`);
}

export interface MemberSummary {
  id: string;
  name: string;
  phone: string;
  status: "active" | "suspended";
  createdAt: string;
  balanceSatang: number;
  /** free rounds used, at most FREE_ROUNDS */
  freeUsed: number;
}

/** The newest members for the owner's page, each with their wallet and their free rounds. */
export async function listMembers(limit = 200): Promise<MemberSummary[]> {
  const { data, error } = await supabaseAdmin().from("ins_members")
    .select("id, name, phone, status, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`อ่านรายชื่อสมาชิกไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { id: string; name: string; phone: string; status: "active" | "suspended"; created_at: string }[];
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
    id: r.id, name: r.name, phone: r.phone, status: r.status, createdAt: r.created_at,
    balanceSatang: balance.get(r.id) ?? 0, freeUsed: used[i],
  }));
}
