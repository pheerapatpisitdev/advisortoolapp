"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/assistant/rate-limit";
import { admit } from "@/lib/auth/access";
import { normalizePhone, PHONE_FAILURES, verifyPin } from "@/lib/auth/member";
import { memberByPhone, phoneFailures } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { endSession, startSession } from "@/lib/auth/session";
import { agentsByCode, staffRow } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 5;

/** Failed sign-ins from one address in the window — the agent code's and the members' alike. */
async function ipFailures(ip: string, since: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("ins_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("created_at", since);
  return count ?? 0;
}

/**
 * Signing in with the agent's own 6-digit code — the same code UnitOS takes.
 *
 * A code is not a secret the way a password is: colleagues may know it. What keeps guessing
 * from working is the count below (five wrong codes from one address and it waits fifteen
 * minutes), the same counter the back office's PIN had, in the same table.
 */
export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const ip = clientIp(await headers());
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const count = await ipFailures(ip, since);
  if (count >= MAX_FAILURES) {
    return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  }
  if (!/^\d{6}$/.test(code)) return { error: "กรุณากรอกรหัสตัวแทน 6 หลัก" };

  const agents = await agentsByCode(code);
  if (agents.length > 1) {
    // UnitOS keeps codes apart only within a room; if two rooms ever hold the same one, the
    // code alone cannot say who this is, and guessing would sign somebody in as a stranger
    return { error: "รหัสนี้มีในมากกว่าหนึ่งห้อง กรุณาเข้าจากเมนูใน UnitOS" };
  }
  const agent = agents[0] ?? null;
  const viewer = agent ? admit(agent, await staffRow(agent.id), Date.now()) : null;
  await supabase.from("ins_login_attempts").insert({ ip, ok: Boolean(viewer) });

  if (!viewer) {
    const left = MAX_FAILURES - count - 1;
    // one answer for an unknown code and a closed room, so the page does not say which codes exist
    const why = "รหัสไม่ถูกต้อง หรือห้องใน UnitOS ยังไม่เปิดให้ใช้";
    return { error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
  }

  await startSession(viewer.agentId);
  redirect(next);
}

/**
 * Signing in as a member outside UnitOS: phone and the PIN they chose (owner, 2026-10-01).
 *
 * The attempt is written as a failure before anything is counted or checked, and only turned
 * into a success once the PIN is right. Counting first and recording after would let a burst of
 * parallel requests all see a count below the limit and each get a guess; written first, they
 * count each other, so the counts below include this attempt.
 *
 * The address's count is the agent code's, so switching tabs buys no more guesses. The phone
 * has a count of its own as well, so many addresses cannot share out the guessing of one
 * member's PIN. A phone that does not exist, a PIN that is wrong and a member who is suspended
 * get the same words — sign-up already says whether a phone is taken, but it need not be said
 * twice.
 */
export async function memberSignIn(formData: FormData): Promise<{ error: string } | undefined> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const pin = String(formData.get("pin") ?? "").trim();
  const next = safeNext(formData.get("next"));
  if (!phone || !/^\d{6}$/.test(pin)) return { error: "กรอกเบอร์มือถือ 10 หลัก และ PIN 6 หลัก" };

  const ip = clientIp(await headers());
  const supabase = supabaseAdmin();
  const sinceDate = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const { data: attempt, error: claimError } = await supabase
    .from("ins_login_attempts")
    .insert({ ip, ok: false, phone })
    .select("id")
    .single();
  if (claimError || !attempt) {
    console.error("memberSignIn: could not record the attempt", claimError);
    return { error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" };
  }
  // a refused attempt is taken back, so a locked address or phone does not extend its own lock
  const release = () => supabase.from("ins_login_attempts").delete().eq("id", attempt.id);

  const fromIp = await ipFailures(ip, sinceDate.toISOString());
  if (fromIp > MAX_FAILURES) {
    await release();
    return { error: `กรอกผิดเกิน ${MAX_FAILURES} ครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  }
  const fromPhone = await phoneFailures(phone, sinceDate);
  if (fromPhone > PHONE_FAILURES) {
    await release();
    return { error: `เบอร์นี้กรอก PIN ผิดหลายครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
  }

  const member = await memberByPhone(phone);
  const ok = Boolean(member && member.status === "active" && (await verifyPin(pin, member.pin_hash)));

  if (!ok || !member) {
    const left = Math.min(MAX_FAILURES - fromIp, PHONE_FAILURES - fromPhone);
    const why = "เบอร์หรือ PIN ไม่ถูกต้อง";
    return { error: left > 0 ? `${why} เหลืออีก ${left} ครั้ง` : `${why} ถูกระงับชั่วคราว` };
  }
  await supabase.from("ins_login_attempts").update({ ok: true }).eq("id", attempt.id);
  await startSession(member.id);
  redirect(next);
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}
