"use server";
import { isDemo } from "@/lib/auth/demo";
import { requireMember } from "@/lib/auth/viewer";
import type { AgentPrefs } from "@/lib/pay-prefs";
import { saveAgentPrefs } from "@/lib/pay-prefs-store";

export type Result = { ok: true } | { ok: false; error: string };

/**
 * ตั้งค่าส่วนตัว (owner, 2026-11-14): which instalments this agent's own quotes show, and whether
 * their tables carry the pen notes. Saved per account, so it follows them to every phone and
 * computer they sign in on. The trial account is shared, so it cannot be set.
 */
export async function saveMyPrefs(p: AgentPrefs): Promise<Result> {
  const viewer = await requireMember();
  if (isDemo(viewer)) return { ok: false, error: "บัญชีทดลองตั้งค่านี้ไม่ได้" };
  if (!p || typeof p.monthly !== "boolean" || typeof p.semi !== "boolean" || typeof p.pen !== "boolean") {
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  try {
    await saveAgentPrefs(viewer.agentId, { monthly: p.monthly, semi: p.semi, pen: p.pen });
  } catch (e) {
    console.error("prefs not saved:", e);
    return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { ok: true };
}
