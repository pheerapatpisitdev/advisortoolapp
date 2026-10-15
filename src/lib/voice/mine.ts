import { providerKey } from "@/lib/ai/client";
import { can, type Viewer } from "@/lib/auth/access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adjustWallet, holdWallet, releaseWallet, settleWallet, walletPrices, walletSettings } from "@/lib/wallet/store";
import { addVoice, deleteVoice, pcmToWav, voiceSlots, wavInfo, type Slots } from "./clone";
import { ELEVENLABS, speakEleven, type ElevenChoice } from "./elevenlabs";
import { consentText, drawCode, PREVIEW_REDOS, previewLine, TAKE_MAX_SEC, TAKE_MIN_SEC, TAKES, YEARLY_REDOS, type VoiceSex } from "./mine-words";

/**
 * เสียงของฉัน (owner, 2026-10-15, mockup https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): an
 * agent's own cloned voice, from the first take to its deletion.
 *
 * recording → preview → review → active, or rejected; deleted when the agent removes it or a
 * newer voice of theirs is approved. ฿199 (the voiceClone price) is charged once the clone is
 * made and given back if the Super Admin turns it down; the owner pays nothing, nor does anyone
 * while the wallet is off. During the pilot only the agents the owner invited may clone.
 */

export type VoiceStatus = "recording" | "preview" | "review" | "active" | "rejected" | "deleted";
export interface AgentVoice {
  id: string;
  agentId: string;
  createdAt: string;
  status: VoiceStatus;
  sex: VoiceSex;
  code: string;
  consentText: string;
  redoUsed: number;
  redoOf: string | null;
  elevenVoiceId: string | null;
  consentPath: string | null;
  previewPath: string | null;
  paidBy: string | null;
  chargedSatang: number;
  reason: string | null;
}

const ROUND = "voice-clone";
const BUCKET = "agent-voice";
const table = () => supabaseAdmin().from("ins_agent_voices");
const bucket = () => supabaseAdmin().storage.from(BUCKET);
const takePath = (v: Pick<AgentVoice, "agentId" | "id">, n: number) => `${v.agentId}/${v.id}/take-${n}.wav`;

function row(r: Record<string, unknown>): AgentVoice {
  return {
    id: String(r.id), agentId: String(r.agent_id), createdAt: String(r.created_at), status: r.status as VoiceStatus,
    sex: r.sex === "M" ? "M" : "F", code: String(r.code), consentText: String(r.consent_text), redoUsed: Number(r.redo_used ?? 0),
    redoOf: (r.redo_of as string | null) ?? null, elevenVoiceId: (r.eleven_voice_id as string | null) ?? null,
    consentPath: (r.consent_path as string | null) ?? null, previewPath: (r.preview_path as string | null) ?? null,
    paidBy: (r.paid_by as string | null) ?? null, chargedSatang: Number(r.charged_satang ?? 0), reason: (r.reason as string | null) ?? null,
  };
}

async function update(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await table().update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`บันทึกเสียงไม่ได้: ${error.message}`);
}

async function elevenKey(): Promise<string> {
  const key = await providerKey(ELEVENLABS);
  if (!key) throw new VoiceError("ยังไม่ได้ตั้งค่าคีย์ ElevenLabs");
  return key;
}

/** a refusal the agent is shown as it is */
export class VoiceError extends Error {}

/** whether this agent may clone: invited to the pilot, or the owner */
export async function mayClone(viewer: Viewer): Promise<boolean> {
  if (can(viewer, "owner")) return true;
  const { data, error } = await supabaseAdmin().from("ins_agent_voice_invites").select("agent_id").eq("agent_id", viewer.agentId).maybeSingle();
  if (error) throw new Error(`อ่านรายชื่อผู้ได้รับเชิญไม่ได้: ${error.message}`);
  return Boolean(data);
}

/** an agent's voices still in play: the one in use, and a newer one on its way */
export async function myVoices(agentId: string): Promise<{ active: AgentVoice | null; pending: AgentVoice | null; last: AgentVoice | null }> {
  const { data, error } = await table().select("*").eq("agent_id", agentId).order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error(`อ่านเสียงของฉันไม่ได้: ${error.message}`);
  const rows = (data ?? []).map(row);
  return {
    active: rows.find((v) => v.status === "active") ?? null,
    pending: rows.find((v) => v.status === "recording" || v.status === "preview" || v.status === "review") ?? null,
    last: rows[0] ?? null,
  };
}

async function ownVoice(agentId: string, id: string): Promise<AgentVoice> {
  const { data, error } = await table().select("*").eq("id", id).eq("agent_id", agentId).maybeSingle();
  if (error) throw new Error(`อ่านเสียงไม่ได้: ${error.message}`);
  if (!data) throw new VoiceError("ไม่พบเสียงนี้");
  return row(data);
}

/** how many of the year's free re-recordings of an approved voice are left */
export async function yearlyRedosLeft(agentId: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 365 * 86_400_000).toISOString();
  const { count, error } = await table().select("id", { count: "exact", head: true }).eq("agent_id", agentId).not("redo_of", "is", null).gte("created_at", since);
  if (error) throw new Error(`อ่านจำนวนการอัดใหม่ไม่ได้: ${error.message}`);
  return Math.max(0, YEARLY_REDOS - (count ?? 0));
}

/**
 * Begin recording: the consent agreed to, the voice's sex (for ค่ะ or ครับ in every clip), a code
 * drawn for the consent take. An unfinished voice is picked up again rather than started anew.
 */
export async function startVoice(viewer: Viewer, sex: VoiceSex): Promise<AgentVoice> {
  if (!(await mayClone(viewer))) throw new VoiceError("ช่วงนำร่อง เปิดให้ตัวแทนที่ได้รับเชิญเท่านั้น");
  const mine = await myVoices(viewer.agentId);
  if (mine.pending?.status === "review") throw new VoiceError("เสียงของคุณรอแอดมินตรวจอยู่");
  if (mine.pending?.status === "preview") throw new VoiceError("มีเสียงที่โคลนแล้วรอคุณฟังอยู่ ฟังแล้วเลือกใช้หรืออัดใหม่");
  if (mine.pending) {
    // takes already up stay; the sex, and so the words, may have changed
    const code = drawCode();
    await update(mine.pending.id, { sex, code, consent_text: consentText(sex, viewer.name.trim(), code), consented_at: new Date().toISOString() });
    await bucket().remove(Array.from({ length: TAKES }, (_, i) => takePath(mine.pending!, i + 1))).catch(() => undefined);
    return ownVoice(viewer.agentId, mine.pending.id);
  }
  if (mine.active && (await yearlyRedosLeft(viewer.agentId)) <= 0) throw new VoiceError(`อัดใหม่ฟรีครบ ${YEARLY_REDOS} ครั้งในปีนี้แล้ว`);
  const code = drawCode();
  const { data, error } = await table().insert({
    agent_id: viewer.agentId, sex, code, consent_text: consentText(sex, viewer.name.trim(), code), redo_of: mine.active?.id ?? null,
  }).select("*").single();
  if (error) throw new Error(`เริ่มอัดเสียงไม่ได้: ${error.message}`);
  return row(data);
}

/** one take, a WAV the browser made, kept until the clone is made */
export async function saveTake(agentId: string, id: string, n: number, wav: Buffer): Promise<void> {
  const v = await ownVoice(agentId, id);
  if (v.status !== "recording") throw new VoiceError("เสียงนี้อัดครบแล้ว");
  if (!Number.isInteger(n) || n < 1 || n > TAKES) throw new VoiceError("ท่อนไม่ถูกต้อง");
  const info = wavInfo(wav);
  if (!info) throw new VoiceError("ไฟล์เสียงไม่ถูกต้อง ลองอัดใหม่");
  if (info.seconds < TAKE_MIN_SEC) throw new VoiceError(`ท่อนนี้สั้นเกินไป อ่านให้ครบประโยค (อย่างน้อย ${TAKE_MIN_SEC} วินาที)`);
  if (info.seconds > TAKE_MAX_SEC + 1) throw new VoiceError(`ท่อนนี้ยาวเกิน ${TAKE_MAX_SEC} วินาที`);
  const { error } = await bucket().upload(takePath(v, n), wav, { contentType: "audio/wav", upsert: true });
  if (error) throw new Error(`เก็บเสียงไม่ได้: ${error.message}`);
}

/** what the clone costs this agent, and how it is paid */
async function payment(viewer: Viewer, v: AgentVoice): Promise<{ by: "staff" | "free" | "wallet" | "redo"; satang: number }> {
  if (can(viewer, "owner")) return { by: "staff", satang: 0 };
  // a re-recording, or a clone made again after "อัดใหม่", is already paid for
  if (v.paidBy) return { by: v.paidBy as "staff" | "free" | "wallet" | "redo", satang: 0 };
  if (v.redoOf) return { by: "redo", satang: 0 };
  if (!(await walletSettings()).enabled) return { by: "free", satang: 0 };
  return { by: "wallet", satang: (await walletPrices()).voiceClone };
}

/** the account's voice slots, or null when they cannot be read */
export async function slotsNow(): Promise<Slots | null> {
  try {
    return await voiceSlots(await elevenKey());
  } catch (e) {
    console.error("voice slots unreadable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Make the clone from the four takes: a free slot checked, the price held, the voice added at
 * ElevenLabs, the price taken, the clone reading a line back. The takes go once the clone is
 * made, but for the consent take, kept as the record of consent.
 */
export async function cloneVoice(viewer: Viewer, id: string): Promise<AgentVoice> {
  const v = await ownVoice(viewer.agentId, id);
  if (v.status !== "recording") throw new VoiceError("เสียงนี้โคลนแล้ว");
  const takes = await Promise.all(Array.from({ length: TAKES }, async (_, i) => {
    const { data, error } = await bucket().download(takePath(v, i + 1));
    if (error || !data) throw new VoiceError(`ยังไม่ได้อัดท่อนที่ ${i + 1}`);
    return { name: `take-${i + 1}.wav`, wav: Buffer.from(await data.arrayBuffer()) };
  }));
  const key = await elevenKey();
  const slots = await voiceSlots(key).catch(() => null);
  if (slots && slots.limit > 0 && slots.used >= slots.limit) throw new VoiceError("ช่องเสียงเต็มชั่วคราว ลองใหม่ภายหลัง");
  const pay = await payment(viewer, v);
  let holdId: string | null = null;
  if (pay.by === "wallet" && pay.satang > 0) {
    holdId = await holdWallet(viewer.agentId, pay.satang, ROUND);
    if (!holdId) throw new VoiceError("ยอดในกระเป๋าไม่พอ เติมเงินก่อน");
  }
  let voiceId: string;
  try {
    voiceId = await addVoice(key, `advisortool-${viewer.agentId.slice(0, 8)}-${v.id.slice(0, 4)}`, takes, { agent_id: viewer.agentId, voice_row: v.id });
  } catch (e) {
    if (holdId) await releaseWallet(holdId).catch(() => undefined);
    console.error("voice clone failed:", e instanceof Error ? e.message : e);
    throw new VoiceError("โคลนเสียงไม่สำเร็จ ลองอัดใหม่ในที่เงียบกว่านี้");
  }
  const charged = holdId ? (await settleWallet(holdId, pay.satang, 0)) ?? 0 : 0;
  let previewPath: string | null = null;
  try {
    const spoken = await speakEleven(key, previewLine(v.sex, viewer.name.trim()), voiceId);
    previewPath = `${v.agentId}/${v.id}/preview.wav`;
    const { error } = await bucket().upload(previewPath, pcmToWav(spoken.pcm), { contentType: "audio/wav", upsert: true });
    if (error) throw new Error(error.message);
  } catch (e) {
    previewPath = null;
    console.error("voice preview not made:", e instanceof Error ? e.message : e);
  }
  const consentPath = takePath(v, TAKES);
  await update(v.id, {
    status: "preview", eleven_voice_id: voiceId, preview_path: previewPath, consent_path: consentPath,
    paid_by: v.paidBy ?? pay.by, charged_satang: v.chargedSatang + charged,
  });
  await bucket().remove(Array.from({ length: TAKES - 1 }, (_, i) => takePath(v, i + 1))).catch(() => undefined);
  return { ...v, status: "preview", elevenVoiceId: voiceId, previewPath, consentPath, paidBy: v.paidBy ?? pay.by, chargedSatang: v.chargedSatang + charged };
}

/** not like the agent: record again, free up to PREVIEW_REDOS times, with a new code */
export async function redoVoice(viewer: Viewer, id: string): Promise<AgentVoice> {
  const v = await ownVoice(viewer.agentId, id);
  if (v.status !== "preview") throw new VoiceError("อัดใหม่ได้ตอนฟังตัวอย่างเท่านั้น");
  if (v.redoUsed >= PREVIEW_REDOS) throw new VoiceError(`อัดใหม่ครบ ${PREVIEW_REDOS} ครั้งแล้ว`);
  if (v.elevenVoiceId) await deleteVoice(await elevenKey(), v.elevenVoiceId);
  await bucket().remove([takePath(v, TAKES), `${v.agentId}/${v.id}/preview.wav`]).catch(() => undefined);
  const code = drawCode();
  await update(v.id, {
    status: "recording", redo_used: v.redoUsed + 1, code, consent_text: consentText(v.sex, viewer.name.trim(), code),
    consented_at: new Date().toISOString(), eleven_voice_id: null, preview_path: null, consent_path: null,
  });
  return { ...(await ownVoice(viewer.agentId, id)) };
}

/** the agent keeps it: on to the Super Admin */
export async function submitVoice(viewer: Viewer, id: string): Promise<void> {
  const v = await ownVoice(viewer.agentId, id);
  if (v.status !== "preview") throw new VoiceError("ส่งตรวจได้หลังฟังตัวอย่างแล้ว");
  await update(v.id, { status: "review" });
}

/** a voice out of ElevenLabs and storage, its row marked deleted */
async function removeVoice(v: AgentVoice, status: "deleted" | "rejected" = "deleted", extra: Record<string, unknown> = {}): Promise<void> {
  if (v.elevenVoiceId) {
    try {
      await deleteVoice(await elevenKey(), v.elevenVoiceId);
    } catch (e) {
      console.error("voice not deleted at ElevenLabs:", e instanceof Error ? e.message : e);
      throw new Error("ลบเสียงที่ ElevenLabs ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }
  const { data } = await bucket().list(`${v.agentId}/${v.id}`);
  const files = (data ?? []).map((f) => `${v.agentId}/${v.id}/${f.name}`);
  if (files.length) await bucket().remove(files).catch(() => undefined);
  await update(v.id, { status, eleven_voice_id: null, preview_path: null, consent_path: null, ...extra });
}

/** the agent removes their voice: at once, from ElevenLabs too */
export async function deleteMyVoice(viewer: Viewer, id: string): Promise<void> {
  await removeVoice(await ownVoice(viewer.agentId, id));
}

/** a short-lived link to a voice's file, for the agent's or the reviewer's player */
export async function voiceFileUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await bucket().createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** the voices waiting for the Super Admin, oldest first */
export async function voicesToReview(): Promise<AgentVoice[]> {
  const { data, error } = await table().select("*").eq("status", "review").order("updated_at", { ascending: true }).limit(50);
  if (error) throw new Error(`อ่านเสียงรอตรวจไม่ได้: ${error.message}`);
  return (data ?? []).map(row);
}

/** approved: the voice is the agent's, and an older one of theirs goes */
export async function approveVoice(id: string, by: string): Promise<void> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("ไม่พบเสียงนี้");
  const v = row(data);
  if (v.status !== "review") throw new Error("เสียงนี้ไม่ได้รอตรวจ");
  const { active } = await myVoices(v.agentId);
  if (active && active.id !== v.id) await removeVoice(active);
  await update(v.id, { status: "active", reviewed_at: new Date().toISOString(), reviewed_by: by });
}

/** turned down: the voice deleted, the money given back */
export async function rejectVoice(id: string, by: string, reason: string): Promise<void> {
  const { data, error } = await table().select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("ไม่พบเสียงนี้");
  const v = row(data);
  if (v.status !== "review") throw new Error("เสียงนี้ไม่ได้รอตรวจ");
  await removeVoice(v, "rejected", { reviewed_at: new Date().toISOString(), reviewed_by: by, reason });
  if (v.chargedSatang > 0) await adjustWallet(v.agentId, v.chargedSatang, "คืนค่าเปิดใช้เสียงของฉัน (ไม่ผ่านการตรวจ)", by);
}

/** the agent's own voice as the clip forms list it, when they have one in use */
export async function myVoiceChoice(agentId: string): Promise<ElevenChoice | null> {
  const { active } = await myVoices(agentId).catch(() => ({ active: null }));
  if (!active?.elevenVoiceId) return null;
  return { id: active.elevenVoiceId, name: "เสียงของฉัน", sex: active.sex, tag: "เสียงโคลนของคุณ", sample: (await voiceFileUrl(active.previewPath)) ?? "", mine: true };
}

/** the agents invited to the pilot, newest first */
export async function voiceInvites(): Promise<{ agentId: string; invitedAt: string }[]> {
  const { data, error } = await supabaseAdmin().from("ins_agent_voice_invites").select("agent_id, invited_at").order("invited_at", { ascending: false });
  if (error) throw new Error(`อ่านรายชื่อผู้ได้รับเชิญไม่ได้: ${error.message}`);
  return (data ?? []).map((r) => ({ agentId: String(r.agent_id), invitedAt: String(r.invited_at) }));
}

/** an agent (by UnitOS code) or a member (by email), as an id; null when neither is found */
export async function agentByCodeOrEmail(codeOrEmail: string): Promise<string | null> {
  const q = codeOrEmail.trim();
  if (!q) return null;
  const db = supabaseAdmin();
  if (q.includes("@")) {
    const { data } = await db.from("ins_members").select("id").ilike("email", q).limit(1).maybeSingle();
    return data ? String(data.id) : null;
  }
  const { data } = await db.from("agents").select("id").eq("agent_code", q).limit(1).maybeSingle();
  return data ? String(data.id) : null;
}

export async function inviteToVoice(agentId: string, by: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_agent_voice_invites").upsert({ agent_id: agentId, invited_by: by }, { onConflict: "agent_id" });
  if (error) throw new Error(`เชิญไม่สำเร็จ: ${error.message}`);
}

/** no longer invited: a voice already made stays theirs */
export async function uninviteFromVoice(agentId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("ins_agent_voice_invites").delete().eq("agent_id", agentId);
  if (error) throw new Error(`ยกเลิกคำเชิญไม่สำเร็จ: ${error.message}`);
}

/** the voices in use, newest first */
export async function activeVoices(): Promise<AgentVoice[]> {
  const { data, error } = await table().select("*").eq("status", "active").order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(`อ่านเสียงที่ใช้งานไม่ได้: ${error.message}`);
  return (data ?? []).map(row);
}
