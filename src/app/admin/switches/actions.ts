"use server";
import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/auth/viewer";
import { cleanMessage, FEATURES, isFeature } from "@/lib/switches/features";
import { saveSwitch } from "@/lib/switches/store";
import { isFxMode, saveFxMode } from "@/lib/quote-video/fx-switch";

/** Returned rather than thrown: Next hides a thrown message in production (see src/app/admin/ai/actions.ts). */
export type SwitchResult = { ok: true } | { ok: false; error: string };

/** One tool switched off or back on, with the words its users are shown (เปิด-ปิดฟังก์ชัน). */
export async function setFeatureSwitch(key: string, off: boolean, message: string): Promise<SwitchResult> {
  await requireStaff("backoffice");
  if (!isFeature(key)) return { ok: false, error: "ไม่พบฟังก์ชันนี้ในรายการ" };
  try {
    await saveSwitch(key, off === true, message);
    await audit(off ? "feature-off" : "feature-on", key, { message: cleanMessage(message) });
    // the menus of every page carry the mark, so every layout reads it again
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("feature switch not saved:", key, e instanceof Error ? e.message : e);
    return { ok: false, error: `บันทึก${FEATURES.find((f) => f.key === key)?.label ?? ""}ไม่สำเร็จ ลองใหม่อีกครั้ง` };
  }
}

/** ลูกเล่นคลิปใหม่'s switch: the owner alone, everyone, or nobody (src/lib/quote-video/fx-switch.ts) */
export async function setFxSwitch(mode: string): Promise<SwitchResult> {
  await requireStaff("backoffice");
  if (!isFxMode(mode)) return { ok: false, error: "ไม่รู้จักตัวเลือกนี้" };
  try {
    await saveFxMode(mode);
    await audit("clip-fx", mode, {});
    return { ok: true };
  } catch (e) {
    console.error("clip fx switch not saved:", e instanceof Error ? e.message : e);
    return { ok: false, error: "บันทึกลูกเล่นคลิปใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}
