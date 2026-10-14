"use server";
import { revalidatePath } from "next/cache";
import { cleanName } from "@/lib/auth/member";
import { setName } from "@/lib/auth/member-store";
import { requireMember } from "@/lib/auth/viewer";
import { cleanLine, cleanMore, cleanPhone, MORE_MAX, photoUrl, saveContact, savePhoto } from "@/lib/quote-video/contact";

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

/**
 * The phone, LINE and photo a วิดีโอนำเสนอ closes on (owner, 2026-10-11) — every agent's, UnitOS
 * or member — and the รายละเอียดเพิ่มเติม under the card (2026-10-14). The name shown beside
 * them is the display name above (or UnitOS's).
 */
export async function saveMyContact(phone: string, line: string, more: string): Promise<Result> {
  const viewer = await requireMember();
  const p = cleanPhone(phone);
  if (p === null || !p) return { ok: false, error: "เบอร์โทรไม่ถูกต้อง (ตัวเลข 9–15 หลัก)" };
  const l = cleanLine(line);
  if (l === null) return { ok: false, error: "LINE ID ใช้ได้แค่ตัวอักษรอังกฤษ ตัวเลข . _ - และ @ ข้างหน้า" };
  const m = cleanMore(more);
  if (m === null) return { ok: false, error: `รายละเอียดเพิ่มเติมได้ไม่เกิน 2 บรรทัด ${MORE_MAX} ตัวอักษร` };
  try {
    await saveContact(viewer.agentId, p, l, m);
  } catch (e) {
    console.error("contact not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true };
}

/** A photo the browser has already made square and small (a JPEG of at most 600 KB). */
export async function saveMyPhoto(form: FormData): Promise<Result & { url?: string }> {
  const viewer = await requireMember();
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.type !== "image/jpeg" || file.size === 0 || file.size > 600_000) {
    return { ok: false, error: "รูปไม่ถูกต้อง ลองเลือกใหม่" };
  }
  try {
    const path = await savePhoto(viewer.agentId, Buffer.from(await file.arrayBuffer()));
    return { ok: true, url: (await photoUrl(path)) ?? undefined };
  } catch (e) {
    console.error("photo not saved:", e);
    return { ok: false, error: "บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
