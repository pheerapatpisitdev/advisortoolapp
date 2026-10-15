"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { agentByCodeOrEmail, approveVoice, inviteToVoice, rejectVoice, uninviteFromVoice } from "@/lib/voice/mine";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type Result = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failed = (e: unknown, what: string): Result => {
  console.error(`${what}:`, e instanceof Error ? e.message : e);
  return { ok: false, error: e instanceof Error && /[ก-๙]/.test(e.message) ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
};

/** เสียงของฉัน's pilot (owner, 2026-10-15): invite an agent by UnitOS code or a member by email */
export async function inviteVoice(codeOrEmail: string): Promise<Result> {
  const viewer = await requireStaff("backoffice");
  try {
    const id = await agentByCodeOrEmail(String(codeOrEmail ?? ""));
    if (!id) return { ok: false, error: "ไม่พบตัวแทนรหัสนี้ หรือสมาชิกอีเมลนี้" };
    await inviteToVoice(id, viewer.agentId);
    await audit("voice-invite", id, {});
  } catch (e) {
    return failed(e, "voice invite not saved");
  }
  revalidatePath("/admin/voices");
  return { ok: true };
}

export async function uninviteVoice(agentId: string): Promise<Result> {
  await requireStaff("backoffice");
  if (!UUID.test(String(agentId))) return { ok: false, error: "ไม่พบคนนี้" };
  try {
    await uninviteFromVoice(agentId);
    await audit("voice-uninvite", agentId, {});
  } catch (e) {
    return failed(e, "voice invite not removed");
  }
  revalidatePath("/admin/voices");
  return { ok: true };
}

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
