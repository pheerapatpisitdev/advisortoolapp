"use server";
import { requireMember } from "@/lib/auth/viewer";
import { cleanTicks } from "@/lib/content/finish-check";
import { aiTextState } from "@/lib/content/poster-text";
import { AI_TEXT_STALE } from "@/lib/content/publish-flow";
import { getContent, saveOutputIf, type ContentItem } from "@/lib/content/store";
import { forClient } from "@/lib/content/clip";

/**
 * สูตรอ่าน-ดูจนจบ: the checklist items the agent ticked (finish-check.ts), kept with the piece.
 * A tick changes no words, so the checks are not run again and a piece on the Page may still be
 * ticked. Written only over the piece as it was read, as an edit is (saveOutputIf); read again
 * if it moved — a picture landing, an edit saved — rather than written over.
 */

export type TicksResult = { ok: true; item: ContentItem } | { ok: false; error: string };

export async function saveFinishTicks(id: string, ticks: string[]): Promise<TicksResult> {
  await requireMember();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      // getContent keeps to the asker's scope: somebody else's piece is not found
      const item = await getContent(id);
      if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
      const output = { ...item.output, finishTicks: cleanTicks(ticks, item.format) };
      const saved = await saveOutputIf(id, output, undefined, item.output.rev ?? null);
      if (saved) return { ok: true, item: forClient(saved) };
    }
    return { ok: false, error: "ชิ้นนี้เพิ่งถูกแก้ระหว่างบันทึก ลองติ๊กอีกครั้งนะครับ" };
  } catch (e) {
    console.error("finish ticks save failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/**
 * The agent has read the words the image model drew and says they are right (poster-text.ts);
 * until then the piece may not go to a Page (publish-flow.ts). Only for words still the piece's
 * own: after an edit the picture must be drawn again, not ticked.
 */
export async function markPosterText(id: string): Promise<TicksResult> {
  await requireMember();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const item = await getContent(id);
      if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
      const poster = item.output.poster;
      const state = aiTextState(poster);
      if (state === "none" || !poster?.aiText) return { ok: false, error: "ภาพนี้ไม่มีตัวหนังสือที่ AI วาด" };
      if (state === "stale") return { ok: false, error: AI_TEXT_STALE };
      const output = { ...item.output, poster: { ...poster, aiText: { ...poster.aiText, checked: true } } };
      const saved = await saveOutputIf(id, output, undefined, item.output.rev ?? null);
      if (saved) return { ok: true, item: forClient(saved) };
    }
    return { ok: false, error: "ชิ้นนี้เพิ่งถูกแก้ระหว่างบันทึก ลองอีกครั้งนะครับ" };
  } catch (e) {
    console.error("poster words not marked:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
