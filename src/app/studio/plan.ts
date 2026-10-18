"use server";
import { requireMember } from "@/lib/auth/viewer";
import { said } from "@/lib/auth/said";
import { todayKey } from "@/lib/content/calendar";
import { mayPlanOn } from "@/lib/content/day-plan";
import { getContent, setPlan, setPlanDone, type ContentItem } from "@/lib/content/store";
import { forClient } from "@/lib/content/clip";

/**
 * The planning calendar's actions (owner, 2026-09-30): put a piece on a day, take it off, say it
 * went up. The piece must be the asker's (getContent keeps to their scope) and not in the bin,
 * and a day gone is refused here, not only on the screen.
 */

export type PlanResult = { ok: true; item: ContentItem } | { ok: false; error: string };

const NOT_FOUND = "ไม่พบชิ้นงานนี้";
const NOT_SAVED = "บันทึกแผนไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";

async function mine(id: string): Promise<ContentItem | null> {
  const item = await getContent(id).catch(() => null);
  return item && item.status !== "trashed" ? item : null;
}

async function saving(write: () => Promise<ContentItem>): Promise<PlanResult> {
  try {
    return { ok: true, item: forClient(await write()) };
  } catch (e) {
    console.error("plan not saved:", e);
    return { ok: false, error: NOT_SAVED };
  }
}

async function planPieceNow(input: { id: string; day: string }): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(input.id));
  if (!item) return { ok: false, error: NOT_FOUND };
  if (!mayPlanOn(String(input.day), todayKey())) return { ok: false, error: "เลือกวันนี้หรือวันถัดไป — วันที่ผ่านมาแล้ววางแผนไม่ได้" };
  return saving(() => setPlan(item.id, input.day));
}

async function unplanPieceNow(id: string): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(id));
  if (!item) return { ok: false, error: NOT_FOUND };
  return saving(() => setPlan(item.id, null));
}

async function markPlanDoneNow(input: { id: string; done: boolean }): Promise<PlanResult> {
  await requireMember();
  const item = await mine(String(input.id));
  if (!item) return { ok: false, error: NOT_FOUND };
  if (!item.plan) return { ok: false, error: "ชิ้นนี้ยังไม่ได้วางแผน" };
  return saving(() => setPlanDone(item.id, input.done === true));
}

/** each action answers its refusals instead of throwing them (said.ts, owner 2026-10-18) */
export async function planPiece(...args: Parameters<typeof planPieceNow>): Promise<PlanResult> {
  const refused = await requireMember().then(() => null, (e: unknown) => said(() => Promise.reject(e)));
  if (refused) return refused;
  return said(() => planPieceNow(...args));
}
export async function unplanPiece(...args: Parameters<typeof unplanPieceNow>): Promise<PlanResult> {
  const refused = await requireMember().then(() => null, (e: unknown) => said(() => Promise.reject(e)));
  if (refused) return refused;
  return said(() => unplanPieceNow(...args));
}
export async function markPlanDone(...args: Parameters<typeof markPlanDoneNow>): Promise<PlanResult> {
  const refused = await requireMember().then(() => null, (e: unknown) => said(() => Promise.reject(e)));
  if (refused) return refused;
  return said(() => markPlanDoneNow(...args));
}
