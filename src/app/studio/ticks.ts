"use server";
import { requireMember } from "@/lib/auth/viewer";
import { cleanTicks } from "@/lib/content/finish-check";
import { getContent, saveOutputIf, type ContentItem } from "@/lib/content/store";

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
      if (saved) return { ok: true, item: saved };
    }
    return { ok: false, error: "ชิ้นนี้เพิ่งถูกแก้ระหว่างบันทึก ลองติ๊กอีกครั้งนะครับ" };
  } catch (e) {
    console.error("finish ticks save failed:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
