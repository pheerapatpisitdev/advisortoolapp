"use server";

import { clipOutput, clipPath, clipProblem, CLIP_HREF, isClipPath, MAX_CAPTION, MAX_CLIP_BRIEF, NO_FLAGS, type ClipFile, type ClipVideo } from "@/lib/content/clip";
import { clipReadUrl, clipSize, createClipUpload, removeClip } from "@/lib/content/clip-store";
import { onPage } from "@/lib/content/publish-label";
import { getContent, listWords, saveContent, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { projectPage } from "@/lib/auth/pages";
import { requireMember } from "@/lib/auth/viewer";
import { takeRound } from "@/lib/auth/quota";
import { limiter } from "@/lib/assistant/rate-limit";
import { ceilingBeforeRound } from "@/lib/content/ceiling";
import { runTranscribe } from "@/lib/content/clip-run";
import { captionFlags, clipYardstick } from "@/lib/content/clip-transcribe";
import { modeChecks } from "@/lib/content/mode-checks";
import { payRound } from "@/lib/wallet/round";

/**
 * A clip the agent filmed, onto a piece (owner, 2026-10-02). The file goes from the browser to
 * storage directly — these only hand out the token and then look at what arrived.
 */

export type ClipResult = { ok: true; item: ContentItem } | { ok: false; error: string };
type Started = { ok: true; pieceId: string; path: string; token: string; item?: ContentItem } | { ok: false; error: string };

const HELD = "ชิ้นนี้ลงเพจหรือตั้งเวลาไว้แล้ว — ยกเลิกคิวก่อนแนบคลิปใหม่";
const READ_FAILED = "อ่านชิ้นงานไม่ได้ ลองใหม่อีกครั้งนะครับ";

/** a piece a clip may go on: a script or a clip, the asker's to see, not on its way to the Page */
async function attachable(id: string): Promise<{ ok: true; item: ContentItem } | { ok: false; error: string }> {
  const item = await getContent(id).catch(() => undefined);
  if (item === undefined) return { ok: false, error: READ_FAILED };
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  if (item.format !== "script" && item.format !== "clip") return { ok: false, error: "แนบคลิปได้เฉพาะชิ้นสคริปต์หรือชิ้นคลิป" };
  if (onPage(item.publish)) return { ok: false, error: HELD };
  return { ok: true, item };
}

const cleanFile = (f: ClipFile): ClipFile => ({
  sizeBytes: Number(f?.sizeBytes), durationSec: Number(f?.durationSec), width: Number(f?.width), height: Number(f?.height), mime: String(f?.mime ?? ""),
});

export async function startClipUpload(input: { pieceId?: string; page?: string; file: ClipFile }): Promise<Started> {
  await requireMember();
  const file = cleanFile(input.file);
  const problem = clipProblem(file);
  if (problem) return { ok: false, error: problem };
  try {
    let pieceId: string;
    let made: ContentItem | undefined;
    if (input.pieceId) {
      const a = await attachable(input.pieceId);
      if (!a.ok) return a;
      pieceId = a.item.id;
    } else {
      const project = await projectPage(input.page);
      if (!project.ok) return project;
      made = await saveContent({
        planHref: CLIP_HREF, format: "clip", angle: "", length: null, output: clipOutput(""), flags: NO_FLAGS,
        rateVersion: null, model: "", costThb: 0, hookTemplateId: null, pageId: project.pageId,
      });
      pieceId = made.id;
    }
    const path = clipPath(pieceId, file.mime);
    const { token } = await createClipUpload(path);
    return { ok: true, pieceId, path, token, ...(made ? { item: made } : {}) };
  } catch (e) {
    console.error("clip upload not started:", e);
    return { ok: false, error: "เตรียมอัปโหลดไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

export async function finishClipUpload(input: { pieceId: string; path: string; file: ClipFile; brief?: string }): Promise<ClipResult> {
  await requireMember();
  const file = cleanFile(input.file);
  if (clipProblem(file) || !isClipPath(input.pieceId, input.path)) return { ok: false, error: "ข้อมูลคลิปไม่ถูกต้อง อัปโหลดใหม่อีกครั้งนะครับ" };
  try {
    const size = await clipSize(input.path);
    if (size === null || size !== file.sizeBytes) return { ok: false, error: "ไฟล์ไปไม่ครบ — อัปโหลดใหม่อีกครั้งนะครับ" };
    const brief = (typeof input.brief === "string" ? input.brief : "").trim().slice(0, MAX_CLIP_BRIEF);
    // a save can race another (a caption edit): read again and build on that, up to three times
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = await attachable(input.pieceId);
      if (!a.ok) return a;
      const before = a.item.output.video;
      const video: ClipVideo = {
        path: input.path, durationSec: file.durationSec, width: file.width, height: file.height,
        sizeBytes: file.sizeBytes, mime: file.mime, uploadedAt: new Date().toISOString(),
        ...(brief ? { brief } : before?.brief ? { brief: before.brief } : {}),
        // the agent's caption survives a new take; its checks are run again by the transcription
        caption: before?.caption ?? "", flags: before?.flags ?? NO_FLAGS,
      };
      const saved = await saveOutputIf(a.item.id, { ...a.item.output, video }, undefined, a.item.output.rev ?? null);
      if (!saved) continue;
      if (before?.path && before.path !== input.path) await removeClip(before.path);
      return { ok: true, item: saved };
    }
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วลองอีกครั้ง" };
  } catch (e) {
    console.error("clip upload not finished:", e);
    return { ok: false, error: "บันทึกคลิปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** A link the card's player plays the clip from, for an hour; null when there is none. */
export async function clipViewUrl(id: string): Promise<string | null> {
  await requireMember();
  const item = await getContent(id).catch(() => null);
  const v = item?.output.video;
  if (!v || v.expired) return null;
  return clipReadUrl(v.path, 60 * 60).catch(() => null);
}

const listensPerHour = limiter(20, 60 * 60_000);

/** ถอดเสียง: one paid round per press (owner, 2026-10-02); a round that fails is not charged. */
export async function transcribeClip(id: string): Promise<ClipResult> {
  const viewer = await requireMember();
  if (!listensPerHour(`clip:${viewer.agentId ?? "staff"}`)) return { ok: false, error: "ถอดเสียงครบ 20 ครั้งในชั่วโมงนี้แล้ว รอสักพักแล้วลองใหม่นะครับ" };
  const item = await getContent(id).catch(() => null);
  if (!item?.output.video) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
  // a listen would write an AI caption onto a Reel Facebook already holds with other words
  if (onPage(item.publish)) return { ok: false, error: "Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนถอดเสียงใหม่" };
  if (item.output.video.expired) return { ok: false, error: "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อน" };
  const ceiling = await ceilingBeforeRound(viewer);
  if (ceiling !== null) return { ok: false, error: `เดือนนี้ใช้งบสร้างคอนเทนต์ครบ ${ceiling} บาทแล้ว` };
  const pass = await takeRound(viewer, "ai-clip");
  if (!pass.ok) return { ok: false, error: pass.refusal };
  return payRound(pass, () => runTranscribe(item));
}

/**
 * The agent's caption, kept and checked again. Only before the Reel is held: changing a held
 * one means sending the whole file again — cancel the schedule first (owner, 2026-10-02).
 */
export async function saveClipCaption(id: string, caption: string): Promise<ClipResult> {
  await requireMember();
  const text = (typeof caption === "string" ? caption : "").trim().slice(0, MAX_CAPTION);
  try {
    const words = await listWords();
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      const v = item?.output.video;
      if (!item || !v) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
      if (onPage(item.publish)) return { ok: false, error: "Reel นี้ตั้งเวลาหรือลงเพจแล้ว — ยกเลิกคิวก่อนแก้แคปชัน" };
      const flags = captionFlags(text, clipYardstick(item), words, modeChecks(item.planHref, v.brief));
      const saved = await saveOutputIf(id, { ...item.output, video: { ...v, caption: text, flags } }, undefined, item.output.rev ?? null);
      if (saved) return { ok: true, item: saved };
    }
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วบันทึกอีกครั้ง" };
  } catch (e) {
    console.error("clip caption not saved:", e);
    return { ok: false, error: "บันทึกแคปชันไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
