import { BudgetExceeded, chat, providerKey } from "@/lib/ai/client";
import { uploadToGemini } from "@/lib/ai/gemini-files";
import type { ClipResult } from "@/app/studio/clip";
import type { ClipVideo } from "./clip";
import { clipReadUrl } from "./clip-store";
import { captionFlags, clipMessages, clipYardstick, CLIP_MODEL, GEMINI_LINK_MAX_BYTES, parseClipReply, spokenFlagsOf } from "./clip-transcribe";
import { modeChecks } from "./mode-checks";
import { contentProduct } from "./products";
import { getContent, listWords, saveOutputIf, type ContentItem } from "./store";

/**
 * A clip's listening round, on the server (owner, 2026-10-02). Called by transcribeClip only,
 * which holds the limits and the wallet; a result that is not ok is not charged.
 */

const LISTEN_TIMEOUT_MS = 240_000;
const UNREAD = "ถอดเสียงไม่สำเร็จ — กด “ถอดเสียงอีกครั้ง” หรือเขียนแคปชันเองได้เลย";

async function videoUri(v: ClipVideo): Promise<string> {
  const link = await clipReadUrl(v.path, 60 * 60);
  if (v.sizeBytes <= GEMINI_LINK_MAX_BYTES) return link;
  const key = await providerKey("google");
  if (!key) throw new Error("no Gemini key");
  const file = await fetch(link, { signal: AbortSignal.timeout(300_000) });
  if (!file.ok || !file.body) throw new Error(`clip not read for Gemini: ${file.status}`);
  return uploadToGemini({ apiKey: key, body: file.body, sizeBytes: v.sizeBytes, mimeType: v.mime, displayName: v.path });
}

/** writes what the listening found onto the piece's clip, on the newest copy of the piece */
async function keep(id: string, path: string, change: (v: ClipVideo) => ClipVideo): Promise<ContentItem | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = await getContent(id);
    const v = now?.output.video;
    // the clip was swapped for another meanwhile: this one's findings are not that one's
    if (!now || !v || v.path !== path) return null;
    const saved = await saveOutputIf(id, { ...now.output, video: change(v) }, undefined, now.output.rev ?? null);
    if (saved) return saved;
  }
  return null;
}

export async function runTranscribe(item: ContentItem): Promise<ClipResult> {
  const v = item.output.video;
  if (!v) return { ok: false, error: "ชิ้นนี้ยังไม่มีคลิป" };
  if (v.expired) return { ok: false, error: "ไฟล์คลิปหมดอายุแล้ว — แนบคลิปใหม่ก่อน" };
  try {
    const uri = await videoUri(v);
    const messages = clipMessages({
      script: [item.output.hooks[0] ?? "", item.output.body, item.output.closing].filter(Boolean).join("\n"),
      brief: v.brief ?? "",
      product: contentProduct(item.planHref)?.name ?? "",
    });
    messages[messages.length - 1] = { ...messages[messages.length - 1], video: { uri, mimeType: v.mime } };
    const reply = await chat({
      tier: "large", task: "content-clip", messages, only: CLIP_MODEL, json: true,
      maxTokens: 6000, timeoutMs: LISTEN_TIMEOUT_MS, mediaResolution: "low",
    });
    const heard = parseClipReply(reply.text, v.durationSec);
    if (!heard) {
      console.error(`clip reply unreadable (${reply.model}, ${reply.outputTokens} tokens)`);
      await keep(item.id, v.path, (now) => ({ ...now, transcribeFailed: true }));
      return { ok: false, error: UNREAD };
    }
    const words = await listWords();
    const yardstick = clipYardstick(item);
    const checks = modeChecks(item.planHref, v.brief);
    const saved = await keep(item.id, v.path, (now) => {
      const caption = now.caption.trim() ? now.caption : heard.caption;
      const next: ClipVideo = {
        ...now, transcript: heard.segments, caption,
        flags: captionFlags(caption, yardstick, words, checks),
        spokenFlags: spokenFlagsOf(heard.segments, words, yardstick, checks),
      };
      delete next.transcribeFailed;
      return next;
    });
    if (!saved) return { ok: false, error: "คลิปถูกเปลี่ยนระหว่างถอดเสียง — ลองถอดเสียงอีกครั้ง" };
    return { ok: true, item: saved };
  } catch (e) {
    if (e instanceof BudgetExceeded) return { ok: false, error: "ถึงงบค่า AI ของเดือนนี้แล้ว" };
    console.error("clip transcription failed:", e);
    await keep(item.id, v.path, (now) => ({ ...now, transcribeFailed: true })).catch(() => null);
    return { ok: false, error: UNREAD };
  }
}
