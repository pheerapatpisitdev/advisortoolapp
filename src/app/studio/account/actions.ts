"use server";
import { revalidatePath } from "next/cache";
import { cleanName } from "@/lib/auth/member";
import { setName } from "@/lib/auth/member-store";
import { requireMember } from "@/lib/auth/viewer";

export type Result = { ok: true } | { ok: false; error: string };

const MEMBERS_ONLY: Result = { ok: false, error: "หน้านี้สำหรับสมาชิกทั่วไปเท่านั้น" };

/** A member's name, as everybody here sees it. Their Google account is Google's to change. */
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
