// The one answer to "may this viewer use the app right now?" for outside members.
// Pages and server actions call memberAccess; the store throwing is left to the caller,
// who shows PASS_UNREADABLE rather than letting anyone through or locking them out.
import { cache } from "react";
import type { Viewer } from "@/lib/auth/access";
import { passState, type PassRow, type PassSettings, type PassState } from "./pass";
import { syncCredits } from "./credit";
import { ensureTrial, passRows, passSettings } from "./pass-store";

export type MemberAccess = { gated: false } | { gated: true; state: PassState; settings: PassSettings };

export const PASS_EXPIRED = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อใช้งานต่อได้ที่หน้า สมาชิก";
export const PASS_EXPIRED_CHAT = "สมาชิกหมดอายุแล้ว ต่ออายุเพื่อถามต่อได้เลย\n\n[ต่ออายุสมาชิก](/membership)";
export const PASS_UNREADABLE = "อ่านสถานะสมาชิกไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะครับ";

/**
 * What one request knows of a member's pass: the layout, the page, the reminder bar and
 * allowanceOf all ask, and React's cache keeps the first answer for the rest of that request
 * only (review, 2026-10-13). rows is null while the switch is off. Outside a server request
 * (tests, scripts) cache reads every time.
 */
const passRead = cache(async (memberId: string): Promise<{ settings: PassSettings; rows: PassRow[] | null }> => {
  const settings = await passSettings();
  if (!settings.enabled) return { settings, rows: null };

  let rows = await passRows(memberId);
  // Only a member with no rows at all gets a trial; all-revoked rows never earn a second one.
  if (rows.length === 0 && settings.trialDays > 0) {
    await ensureTrial(memberId, settings.trialDays);
    rows = await passRows(memberId);
  }
  // the credit the ledger earns, written the first time it is seen (owner, 2026-10-17); a write
  // that fails leaves the member paying from their own money until the next visit, so it is
  // logged rather than locking them out
  await syncCredits(memberId, rows, settings).catch((e) => console.error("member credit not synced:", e));
  return { settings, rows };
});

export async function memberAccess(viewer: Viewer, now: Date = new Date()): Promise<MemberAccess> {
  if (viewer.kind !== "member") return { gated: false };
  const { settings, rows } = await passRead(viewer.agentId);
  if (!settings.enabled || rows === null) return { gated: false };
  return { gated: true, state: passState(rows, now), settings };
}

export function passOpen(a: MemberAccess): boolean {
  return !a.gated || a.state.status === "live";
}
