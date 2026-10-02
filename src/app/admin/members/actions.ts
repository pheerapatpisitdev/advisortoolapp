"use server";
import { revalidatePath } from "next/cache";
import { saveMemberSettings, setStatus } from "@/lib/auth/member-store";
import { audit, memberById, requireStaff } from "@/lib/auth/viewer";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND: Result = { ok: false, error: "ไม่พบสมาชิกนี้" };
const FAILED: Result = { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

/** The owner's switch: whether a Google account with no member yet is given one (owner, 2026-10-01). */
export async function saveSignupSettings(open: boolean): Promise<Result> {
  await requireStaff("admin");
  try {
    await saveMemberSettings({ signupOpen: open === true });
  } catch (e) {
    console.error("member settings not saved:", e);
    return FAILED;
  }
  await audit("member-signup-switch", null, { open: open === true });
  revalidatePath("/admin/members");
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
