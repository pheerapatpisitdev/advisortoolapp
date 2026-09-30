"use server";
import { revalidatePath } from "next/cache";
import { hashPin, pinProblem } from "@/lib/auth/member";
import { clearPinFailures, saveMemberSettings, setPin, setStatus } from "@/lib/auth/member-store";
import { audit, memberById, requireStaff } from "@/lib/auth/viewer";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND: Result = { ok: false, error: "ไม่พบสมาชิกนี้" };
const FAILED: Result = { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

/** The owner's switch for /signup, and where "ลืม PIN? ติดต่อแอดมิน" goes (owner, 2026-10-01). */
export async function saveSignupSettings(open: boolean, contactUrl: string): Promise<Result> {
  await requireStaff("admin");
  const url = typeof contactUrl === "string" ? contactUrl.trim() : "";
  if (url && !/^https:\/\/\S+$/.test(url)) return { ok: false, error: "ลิงก์ติดต่อต้องขึ้นต้นด้วย https://" };
  if (url.length > 300) return { ok: false, error: "ลิงก์ยาวเกินไป" };
  try {
    await saveMemberSettings({ signupOpen: open === true, contactUrl: url || null });
  } catch (e) {
    console.error("member settings not saved:", e);
    return FAILED;
  }
  await audit("member-signup-switch", null, { open: open === true });
  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * A forgotten PIN: the admin sets one and tells the member by LINE or phone — there is no OTP
 * (owner, 2026-10-01). The member's other sessions end with it, and the phone's failed
 * attempts are forgotten so the new PIN is not refused by the lock the forgotten one caused.
 */
export async function resetMemberPin(id: string, pin: string): Promise<Result> {
  await requireStaff("admin");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  const problem = pinProblem(pin);
  if (problem) return { ok: false, error: problem };
  try {
    // an id nobody holds must not look like a reset that worked, nor leave an audit row
    const member = await memberById(id);
    if (!member) return NOT_FOUND;
    await setPin(id, await hashPin(pin), new Date());
    await clearPinFailures(member.phone);
  } catch (e) {
    console.error("member pin reset failed:", e);
    return FAILED;
  }
  await audit("member-pin-reset", id);
  return { ok: true };
}

/** A suspended member is out on their next click (src/lib/auth/access.ts admitMember). */
export async function setMemberStatus(id: string, status: string): Promise<Result> {
  await requireStaff("admin");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  if (status !== "active" && status !== "suspended") return { ok: false, error: "สถานะไม่ถูกต้อง" };
  try {
    if (!(await memberById(id))) return NOT_FOUND;
    await setStatus(id, status);
  } catch (e) {
    console.error("member status not saved:", e);
    return FAILED;
  }
  await audit(status === "suspended" ? "member-suspend" : "member-reinstate", id);
  revalidatePath("/admin/members");
  return { ok: true };
}
