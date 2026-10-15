"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { approveVoice, rejectVoice } from "@/lib/voice/mine";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failed = (e: unknown, what: string): Result => {
  console.error(`${what}:`, e instanceof Error ? e.message : e);
  return { ok: false, error: e instanceof Error && /[ก-๙]/.test(e.message) ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
};

export async function approveAgentVoice(id: string): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  if (!UUID.test(String(id))) return { ok: false, error: "ไม่พบเสียงนี้" };
  try {
    await approveVoice(id, viewer.agentId);
    await audit("voice-approve", id, {});
  } catch (e) {
    return failed(e, "voice not approved");
  }
  revalidatePath("/admin/voices");
  return { ok: true };
}

const REASONS = new Set(["เสียงไม่ตรงกับเจ้าของบัญชี", "ประโยคยินยอมไม่ครบหรือรหัสไม่ตรง", "เสียงไม่ชัด มีเสียงรบกวน", "อื่น ๆ"]);
export async function rejectAgentVoice(id: string, reason: string): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  if (!UUID.test(String(id))) return { ok: false, error: "ไม่พบเสียงนี้" };
  if (!REASONS.has(String(reason))) return { ok: false, error: "เลือกเหตุผล" };
  try {
    await rejectVoice(id, viewer.agentId, reason);
    await audit("voice-reject", id, { reason });
  } catch (e) {
    return failed(e, "voice not rejected");
  }
  revalidatePath("/admin/voices");
  return { ok: true };
}
