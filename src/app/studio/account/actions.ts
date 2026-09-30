"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { clientIp } from "@/lib/assistant/rate-limit";
import { cleanName, hashPin, PHONE_FAILURES, pinProblem, verifyPin } from "@/lib/auth/member";
import { claimPinAttempt, markPinAttemptOk, memberByPhone, phoneFailures, releasePinAttempt, setName, setPin } from "@/lib/auth/member-store";
import { startSession } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";

export type Result = { ok: true } | { ok: false; error: string };

const WINDOW_MINUTES = 15;
const MEMBERS_ONLY: Result = { ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" };

/**
 * A member's own PIN (owner, 2026-10-01). Every other device is signed out by the change
 * (pin_changed_at); this one is signed in again straight after, so the member stays where
 * they are. A UnitOS agent has no PIN here — their code is UnitOS's.
 *
 * The old PIN is guessed against the same per-phone lock as the sign-in, claim first, so a
 * stolen session cookie is not a way round it to take the account over.
 */
export async function changePin(oldPin: string, pin: string, pinAgain: string): Promise<Result> {
  const viewer = await requireMember();
  if (viewer.kind !== "member") return MEMBERS_ONLY;
  let member: Awaited<ReturnType<typeof memberByPhone>>;
  let claim: string;
  try {
    member = await memberByPhone(viewer.code);
    if (!member || typeof oldPin !== "string") return { ok: false, error: "PIN เดิมไม่ถูกต้อง" };
    claim = await claimPinAttempt(clientIp(await headers()), member.phone);
    // the count includes the claim just written, exactly as in the sign-in
    const failures = await phoneFailures(member.phone, new Date(Date.now() - WINDOW_MINUTES * 60 * 1000));
    if (failures > PHONE_FAILURES) {
      await releasePinAttempt(claim);
      return { ok: false, error: `กรอก PIN ผิดหลายครั้ง กรุณารออีก ${WINDOW_MINUTES} นาที` };
    }
  } catch (e) {
    console.error("pin attempt check failed:", e);
    return { ok: false, error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" };
  }
  if (!(await verifyPin(oldPin, member.pin_hash))) return { ok: false, error: "PIN เดิมไม่ถูกต้อง" };
  try {
    await markPinAttemptOk(claim);
  } catch (e) {
    console.error("pin attempt not marked ok:", e);
  }
  const problem = pinProblem(pin, pinAgain);
  if (problem) return { ok: false, error: problem };
  try {
    await setPin(member.id, await hashPin(pin), new Date());
  } catch (e) {
    console.error("pin change failed:", e);
    return { ok: false, error: "เปลี่ยน PIN ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await startSession(member.id);
  return { ok: true };
}

export async function renameMe(name: string): Promise<Result> {
  const viewer = await requireMember();
  if (viewer.kind !== "member") return MEMBERS_ONLY;
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: "กรุณากรอกชื่อ (ไม่เกิน 60 ตัวอักษร)" };
  try {
    await setName(viewer.agentId, clean);
  } catch (e) {
    console.error("rename failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidatePath("/studio", "layout");
  return { ok: true };
}
