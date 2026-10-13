// The one answer to "may this viewer use the app right now?" for outside members.
// Pages and server actions call memberAccess; the store throwing is left to the caller,
// who shows PASS_UNREADABLE rather than letting anyone through or locking them out.
import type { Viewer } from "@/lib/auth/access";
import { passState, type PassSettings, type PassState } from "./pass";
import { ensureTrial, passRows, passSettings } from "./pass-store";

export type MemberAccess = { gated: false } | { gated: true; state: PassState; settings: PassSettings };

export const PASS_EXPIRED = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อใช้งานต่อได้ที่หน้า สมาชิก";
export const PASS_EXPIRED_CHAT = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อถามต่อได้เลย\n\n[ต่ออายุสมาชิก](/membership)";
export const PASS_UNREADABLE = "อ่านสถานะสมาชิกไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะครับ";

export async function memberAccess(viewer: Viewer, now: Date = new Date()): Promise<MemberAccess> {
  if (viewer.kind !== "member") return { gated: false };
  const settings = await passSettings();
  if (!settings.enabled) return { gated: false };

  let rows = await passRows(viewer.agentId);
  // Only a member with no rows at all gets a trial; all-revoked rows never earn a second one.
  if (rows.length === 0 && settings.trialDays > 0) {
    await ensureTrial(viewer.agentId, settings.trialDays);
    rows = await passRows(viewer.agentId);
  }
  return { gated: true, state: passState(rows, now), settings };
}

export function passOpen(a: MemberAccess): boolean {
  return !a.gated || a.state.status === "live";
}
