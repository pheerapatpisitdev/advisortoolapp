"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cleanName, cleanOffice } from "@/lib/auth/member";
import { memberProfile, setProfile } from "@/lib/auth/member-store";
import { safeNext } from "@/lib/auth/next";
import { requireMember } from "@/lib/auth/viewer";
import { alertNewMember } from "@/lib/line/owner-alert";
import { DAY_MS } from "@/lib/members/pass";

export type SignupResult = { ok: false; field?: "name" | "office"; error: string };

const NAME_ERROR = "กรอกชื่อ - นามสกุล (ไม่เกิน 60 ตัวอักษร)";
const OFFICE_ERROR = "กรอกชื่อสำนักงาน หรือบริษัทที่สังกัด";

/**
 * สมัครสมาชิก (owner, 2026-10-27): the name and สำนักงาน a member gives before using the app,
 * then on to the page they were going to. The owner's LINE hears of the member here rather than
 * at the Google sign-in, so the alert carries both — once, for an account opened in the last day:
 * a member who joined before the page existed fills it in too, and is not new.
 */
export async function saveSignup(name: string, office: string, next: string): Promise<SignupResult> {
  const viewer = await requireMember();
  if (viewer.kind !== "member") return { ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" };
  const n = cleanName(name);
  if (!n) return { ok: false, field: "name", error: NAME_ERROR };
  const o = cleanOffice(office);
  if (!o) return { ok: false, field: "office", error: OFFICE_ERROR };
  try {
    const before = await memberProfile(viewer.agentId);
    await setProfile(viewer.agentId, { name: n, office: o });
    if (before && before.office === null && Date.now() - Date.parse(before.createdAt) < DAY_MS) {
      after(() => alertNewMember(viewer.agentId));
    }
  } catch (e) {
    console.error("signup profile not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(next));
}
