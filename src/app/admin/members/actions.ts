"use server";
import { revalidatePath } from "next/cache";
import { purgeMember, saveMemberSettings, setStatus } from "@/lib/auth/member-store";
import { audit, memberById, requireStaff } from "@/lib/auth/viewer";
import { grantPass } from "@/lib/members/pass-store";
import { clearMemberFiles } from "@/lib/members/purge-files";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND: Result = { ok: false, error: "ไม่พบสมาชิกนี้" };
const FAILED: Result = { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

/** The owner's switch: whether a Google account with no member yet is given one (owner, 2026-10-01). */
export async function saveSignupSettings(open: boolean): Promise<Result> {
  await requireStaff("backoffice");
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
  await requireStaff("backoffice");
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

/**
 * Days given by hand (owner, 2026-10-13): a member who paid some other way, or a goodwill
 * extension. Always with a note, so the ledger says why. Stacks after whatever is live.
 */
export async function grantPassDays(id: string, days: string, note: string): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  const t = String(days ?? "").trim();
  const n = Number(t);
  if (!/^\d+$/.test(t) || n < 1 || n > 365) return { ok: false, error: "จำนวนวันต้องเป็นจำนวนเต็ม ตั้งแต่ 1 ถึง 365" };
  const reason = String(note ?? "").trim().slice(0, 200);
  if (!reason) return { ok: false, error: "ต้องใส่หมายเหตุทุกครั้ง" };
  try {
    if (!(await memberById(id))) return NOT_FOUND;
    await grantPass(id, n, reason, viewer.agentId);
  } catch (e) {
    console.error("member pass days not granted:", e);
    return FAILED;
  }
  await audit("member-pass-grant", id, { days: n, note: reason });
  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * ลบสมาชิก for good (owner, 2026-10-14): only a suspended member (2ข), and only once the admin has
 * typed their email. Everything of theirs goes, payment history included (1ข). The audit row of
 * the delete is the one trace left, with their name so the log still reads.
 */
export async function deleteMemberForGood(id: string, typedEmail: string): Promise<Result> {
  await requireStaff("backoffice");
  if (typeof id !== "string" || !UUID.test(id)) return NOT_FOUND;
  let name: string;
  try {
    const member = await memberById(id);
    if (!member) return NOT_FOUND;
    if (member.status !== "suspended") return { ok: false, error: "ต้องระงับสมาชิกก่อน จึงจะลบได้" };
    if (String(typedEmail ?? "").trim().toLowerCase() !== member.email.toLowerCase()) {
      return { ok: false, error: "อีเมลที่พิมพ์ไม่ตรงกับอีเมลของสมาชิก" };
    }
    name = member.name;
    const gone = await purgeMember(id);
    if (!gone.ok) return gone.why === "not-found" ? NOT_FOUND : { ok: false, error: "ต้องระงับสมาชิกก่อน จึงจะลบได้" };
    await clearMemberFiles(id, gone.files);
  } catch (e) {
    console.error("member not deleted:", e);
    return { ok: false, error: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await audit("member-delete", id, { name });
  revalidatePath("/admin/members");
  return { ok: true };
}
