"use server";
import { isDemo } from "@/lib/auth/demo";
import { requireMember } from "@/lib/auth/viewer";
import { savePayPrefs } from "@/lib/pay-prefs-store";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14): which instalments this agent's own quotes show. Saved per
 * account, so it follows them to every phone and computer they sign in on. The trial account is
 * shared, so it cannot be set.
 */
export async function saveMyPayPrefs(monthly: boolean, semi: boolean): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองตั้งค่านี้ไม่ได้" };
  if (typeof monthly !== "boolean" || typeof semi !== "boolean") return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  try {
    await savePayPrefs(viewer.agentId, { monthly, semi });
  } catch (e) {
    console.error("prefs not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true };
}
