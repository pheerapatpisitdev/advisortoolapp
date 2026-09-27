"use server";
import { pageConnections } from "@/lib/facebook/connection";
import { bangkokAt, dayKey, dropTime, lastDropDay, nextDayKey, nextOpenDay, timeOfDay, todayKey } from "@/lib/content/calendar";
import { move, PAST_DAY, POST_SCOPE, publish, withdraw, type PublishResult } from "@/lib/content/publish-flow";
import { getContent, listPublished } from "@/lib/content/store";

export type { PublishResult } from "@/lib/content/publish-flow";

/**
 * Posting a piece to a Facebook Page from the workbench, now or at a time Facebook holds.
 * The steps live in src/lib/content/publish-flow.ts; these are the doors the page calls.
 *
 * Two gates stand before Facebook is called: the piece's own checks (a Facebook-rule finding
 * marked block stops it; amounts not in the rate tables must be confirmed) and the Page's
 * permission to post. Only posts go up — a script is filmed and an ad goes through Ads Manager.
 *
 * There is no PIN. One was built and the owner took it out on 2026-09-25, as /admin has no
 * login by the owner's decision: whoever can open /content can post. Don't put one back
 * unasked.
 */

export interface PublishPage {
  pageId: string;
  pageName: string;
  /** the Page was connected with the permission to post */
  canPost: boolean;
}

export interface PublishSetup {
  pages: PublishPage[];
}

export async function publishSetup(): Promise<PublishSetup> {
  try {
    return { pages: (await pageConnections()).map((p) => ({ pageId: p.pageId, pageName: p.pageName, canPost: p.scopes.includes(POST_SCOPE) })) };
  } catch (e) {
    console.error("publish setup failed:", e);
    return { pages: [] };
  }
}

export async function publishPiece(input: {
  id: string;
  pageId: string;
  /** ISO time to hold it for; null posts now */
  at: string | null;
  /** which opening line, for older pieces that carry three */
  hook?: number;
  confirmNumbers?: boolean;
  /**
   * The owner has checked the Page and wants it sent again, though Facebook may already show
   * it (a refusal came back with confirmRepost). Without it such a piece is refused.
   */
  force?: boolean;
}): Promise<PublishResult> {
  return publish(input);
}

/**
 * A drop on the calendar. A waiting piece goes to the Page chosen on the board, at the first
 * of the day's slots that Page has free and that is still ahead (dropTime: noon, then the
 * evening, …); a held one keeps its Page and its time of day and moves to the new day, unless
 * that time has gone on the new day, when it takes a slot the same way.
 */
export async function scheduleOnDay(input: { id: string; day: string; pageId: string; confirmNumbers?: boolean; force?: boolean }): Promise<PublishResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { ok: false, error: "วันที่ไม่ถูกต้อง" };
  // Thailand's today, now — a board left open overnight still thinks it is yesterday
  if (input.day < todayKey()) return { ok: false, error: PAST_DAY };
  const item = await getContent(input.id).catch(() => null);
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  const held = item.publish?.state === "scheduled" && item.publish.at ? item.publish : null;
  const pageId = held?.pageId ?? input.pageId;
  const kept = held ? timeOfDay(new Date(held.at!)) : null;
  // a held post's own time stands while it is still well ahead on the new day
  const time = kept && bangkokAt(input.day, kept).getTime() - Date.now() >= 20 * 60_000
    ? kept
    : dropTime(input.day, await takenOn(input.day, pageId, item.id));
  if (!time) return { ok: false, error: DAY_GONE };
  if (held) return move(item.id, bangkokAt(input.day, time), input.confirmNumbers);
  return publish({ id: item.id, pageId: input.pageId, at: bangkokAt(input.day, time).toISOString(), confirmNumbers: input.confirmNumbers, force: input.force });
}

const DAY_GONE = "วันนี้เลยเวลาลงโพสต์แล้ว — วางวันพรุ่งนี้หรือวันถัดไปแทนนะครับ";

/** The times one Page already has posts at on a Thai day, the piece being moved left out. */
async function takenOn(day: string, pageId: string | null, except: string): Promise<string[]> {
  if (!pageId) return [];
  try {
    const rows = await listPublished(bangkokAt(day, "00:00"), bangkokAt(nextDayKey(day), "00:00"));
    return rows
      .filter((r) => r.id !== except && r.publish?.pageId === pageId && r.publish.at)
      .map((r) => timeOfDay(new Date(r.publish!.at!)));
  } catch {
    // not read: the first slot still ahead, as though the day were empty
    return [];
  }
}

/**
 * "วันว่างถัดไป": a piece held for the first day its Page has nothing on (nextOpenDay), at the
 * time a drop would give it — through the same checks as every other way up. Several are sent
 * one after another by the workbench, so each sees the ones before it as taken.
 */
export async function scheduleNextOpen(input: { id: string; pageId: string; confirmNumbers?: boolean; force?: boolean }): Promise<PublishResult> {
  const today = todayKey();
  let rows: Awaited<ReturnType<typeof listPublished>>;
  try {
    rows = await listPublished(bangkokAt(today, "00:00"), bangkokAt(nextDayKey(lastDropDay(today)), "00:00"));
  } catch {
    return { ok: false, error: "อ่านปฏิทินไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
  const taken = new Set(rows
    .filter((r) => r.id !== input.id && r.publish?.pageId === input.pageId && r.publish.at)
    .map((r) => dayKey(new Date(r.publish!.at!))));
  const open = nextOpenDay(taken);
  if (!open) return { ok: false, error: "เพจนี้มีโพสต์ทุกวันใน 30 วันข้างหน้าแล้ว — เลือกวันเวลาเองในหน้าแก้ไข" };
  return publish({ id: input.id, pageId: input.pageId, at: bangkokAt(open.day, open.time).toISOString(), confirmNumbers: input.confirmNumbers, force: input.force });
}

/** The day sheet's บันทึกเวลา: a Thai "YYYY-MM-DDTHH:MM", for a waiting piece or a held one. */
export async function scheduleAt(input: { id: string; local: string; pageId: string; confirmNumbers?: boolean; force?: boolean }): Promise<PublishResult> {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(input.local);
  if (!m) return { ok: false, error: "เลือกวันและเวลาก่อนนะครับ" };
  if (m[1] < todayKey()) return { ok: false, error: PAST_DAY };
  const at = bangkokAt(m[1], m[2]);
  const item = await getContent(input.id).catch(() => null);
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  if (item.publish?.state === "scheduled") return move(item.id, at, input.confirmNumbers);
  return publish({ id: item.id, pageId: input.pageId, at: at.toISOString(), confirmNumbers: input.confirmNumbers, force: input.force });
}

/** Takes back a post Facebook is holding, before its time. It can be scheduled again after. */
export async function cancelScheduled(id: string): Promise<PublishResult> {
  const item = await getContent(id).catch(() => null);
  const p = item?.publish;
  if (!item || !p || p.state !== "scheduled" || !p.postId || !p.pageId) return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  if (p.at && new Date(p.at).getTime() <= Date.now()) return { ok: false, error: "ถึงเวลาโพสต์ไปแล้ว ยกเลิกไม่ได้ — ลบโพสต์ในเพจแทน" };
  try {
    return await withdraw(item);
  } catch (e) {
    console.error("content cancel failed:", e);
    return { ok: false, error: "ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
