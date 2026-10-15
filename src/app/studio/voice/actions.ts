"use server";
import { requireMember } from "@/lib/auth/viewer";
import { cloneVoice, deleteMyVoice, redoVoice, startVoice, submitVoice, VoiceError, type AgentVoice } from "@/lib/voice/mine";
import type { VoiceSex } from "@/lib/voice/mine-words";

/**
 * เสียงของฉัน's steps (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m):
 * begin with consent, clone from the four takes (the takes go up through /api/voice/take), keep
 * or record again, delete. Each answers with the voice as it now stands, or the words for what
 * is wrong.
 */

export type VoiceResult = { ok: true; voice: AgentVoice | null } | { ok: false; error: string };

async function run(step: () => Promise<AgentVoice | null>, failed: string): Promise<VoiceResult> {
  try {
    return { ok: true, voice: await step() };
  } catch (e) {
    if (e instanceof VoiceError) return { ok: false, error: e.message };
    console.error(`${failed}:`, e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error && /[ก-๙]/.test(e.message) ? e.message : "ทำไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

/** consent given, the voice's sex chosen: recording may begin */
export async function beginVoice(sex: VoiceSex, agreed: boolean): Promise<VoiceResult> {
  const viewer = await requireMember();
  if (agreed !== true) return { ok: false, error: "ติ๊กยืนยันทั้ง 3 ข้อก่อน" };
  if (sex !== "F" && sex !== "M") return { ok: false, error: "เลือกเสียงผู้หญิงหรือผู้ชาย" };
  if (!viewer.name.trim()) return { ok: false, error: "ใส่ชื่อในบัญชีของฉันก่อน ชื่อนี้อยู่ในประโยคยินยอม" };
  return run(() => startVoice(viewer, sex), "voice not started");
}

export async function makeClone(id: string): Promise<VoiceResult> {
  const viewer = await requireMember();
  return run(() => cloneVoice(viewer, String(id)), "voice not cloned");
}

export async function recordAgain(id: string): Promise<VoiceResult> {
  const viewer = await requireMember();
  return run(() => redoVoice(viewer, String(id)), "voice not reset");
}

export async function keepVoice(id: string): Promise<VoiceResult> {
  const viewer = await requireMember();
  return run(async () => { await submitVoice(viewer, String(id)); return null; }, "voice not submitted");
}

export async function removeMyVoice(id: string): Promise<VoiceResult> {
  const viewer = await requireMember();
  return run(async () => { await deleteMyVoice(viewer, String(id)); return null; }, "voice not deleted");
}
