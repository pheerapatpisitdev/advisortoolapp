import { CLIP_BUCKET, CLIP_HREF, MAX_CAPTION, NO_FLAGS, clipOutput, clipPath, type ClipVideo } from "@/lib/content/clip";
import { saveContent, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clipSize, VIDEO_BUCKET, type VideoRow } from "./make";

/**
 * A finished วิดีโอนำเสนอ put on a Page's posting calendar (owner, 2026-10-11): a clip piece of
 * that Page, carrying its own copy of the file in content-video, so it waits in the calendar's
 * รอตั้งเวลา rail and goes up as a Reel the way every clip does. Deleting the video later does
 * not touch the copy. The caller checks who may do this and which Page.
 */

export const NAMED = "คลิปที่มีชื่อลูกค้า ลงเพจไม่ได้ — สร้างใหม่แบบไม่ใส่ชื่อลูกค้า";

export async function sendToCalendar(row: VideoRow, pageId: string, caption: string): Promise<ContentItem> {
  if (row.status !== "done" || !row.video_path) throw new Error("not a finished video");
  if (row.customer_name) throw new Error(NAMED);
  if (row.input.product === "FHC") throw new Error("an FHC summary is never put on a Page");
  if (clipSize(row.input) !== "portrait") throw new Error("only a portrait clip goes up as a Reel");
  const store = supabaseAdmin().storage;
  const { data: file, error } = await store.from(VIDEO_BUCKET).download(row.video_path);
  if (error || !file) throw new Error(`video not read: ${error?.message}`);
  const bytes = Buffer.from(await file.arrayBuffer());

  const piece = await saveContent({
    planHref: CLIP_HREF, format: "clip", angle: "", length: null, output: clipOutput(""), flags: NO_FLAGS,
    rateVersion: null, model: "", costThb: 0, hookTemplateId: null, pageId,
  });
  const path = clipPath(piece.id, "video/mp4");
  const up = await store.from(CLIP_BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: false });
  if (up.error) throw new Error(`clip not stored: ${up.error.message}`);
  const video: ClipVideo = {
    path, durationSec: Number(row.duration_sec ?? 0), width: 1080, height: 1920, sizeBytes: bytes.length,
    mime: "video/mp4", uploadedAt: new Date().toISOString(),
    brief: "วิดีโอนำเสนอ", caption: caption.trim().slice(0, MAX_CAPTION), flags: NO_FLAGS,
  };
  const saved = await saveOutputIf(piece.id, { ...piece.output, video }, undefined, piece.output.rev ?? null);
  if (!saved) throw new Error("clip piece not saved");
  return saved;
}
