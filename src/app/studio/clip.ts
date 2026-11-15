"use server";

import { forClient, MAX_CAPTION } from "@/lib/content/clip";
import { onPage } from "@/lib/content/publish-label";
import { getContent, listWords, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { requireMember } from "@/lib/auth/viewer";
import { captionFlags, clipYardstick } from "@/lib/content/clip-caption";
import { modeChecks } from "@/lib/content/mode-checks";

/**
 * A Reel piece's caption (owner, 2026-10-02). Filmed-clip uploads, ถอดเสียง and ตัดต่อคลิป
 * were removed on 2026-11-15 (owner chose ก + 1): a Reel piece now comes from วิดีโอนำเสนอ's
 * ลงปฏิทินเพจ (src/lib/quote-video/calendar.ts), and only its caption is edited here.
 */

export type ClipResult = { ok: true; item: ContentItem } | { ok: false; error: string };

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
      if (saved) return { ok: true, item: forClient(saved) };
    }
    return { ok: false, error: "มีการแก้ชิ้นนี้พร้อมกันอยู่ — โหลดหน้าใหม่แล้วบันทึกอีกครั้ง" };
  } catch (e) {
    console.error("clip caption not saved:", e);
    return { ok: false, error: "บันทึกแคปชันไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
