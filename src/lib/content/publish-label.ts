import { bangkokAt, nextDayKey, todayKey } from "./calendar";
import type { Publish } from "./store";

/**
 * What a piece's trip to the Page looks like from here, in the owner's words.
 *
 * A held post has no event of its own when Facebook puts it up, so a schedule whose time has
 * passed is read as posted: Facebook does not miss its own schedule, and a post the owner
 * deleted by hand is theirs to know about.
 */

export type PublishView =
  | { kind: "none" }
  | { kind: "posting" }
  | { kind: "scheduled"; at: Date }
  | { kind: "published"; at: Date | null }
  | { kind: "failed"; error: string };

/**
 * How long a send may say "posting" before it is taken for dead. Drawing the poster and
 * Facebook's upload take well under a minute and the function is cut off at five; a claim
 * older than ten belongs to a request that is gone. Its row is written with the claim's time
 * in publish_at (see claimPublish).
 */
export const POSTING_STALE_MS = 10 * 60_000;

export const STUCK_MESSAGE = "ส่งไปเพจค้าง — เปิดเพจเช็กก่อนว่าขึ้นแล้วหรือยัง แล้วค่อยกดส่งใหม่";

/** a posting row whose request died; it may have reached Facebook, so a re-send needs `force` */
export function stalePosting(p: Publish | null, now: Date = new Date()): boolean {
  if (!p || p.state !== "posting") return false;
  const at = p.at ? new Date(p.at).getTime() : NaN;
  return Number.isNaN(at) || now.getTime() - at > POSTING_STALE_MS;
}

/** Facebook may already show it: a stuck send, or a refused one that came back with a post id. */
export function maybeOnPage(p: Publish | null, now: Date = new Date()): boolean {
  return stalePosting(p, now) || (p?.state === "failed" && Boolean(p.postId));
}

export function publishView(p: Publish | null, now: Date = new Date()): PublishView {
  if (!p || p.state === "cancelled") return { kind: "none" };
  if (p.state === "posting") return stalePosting(p, now) ? { kind: "failed", error: STUCK_MESSAGE } : { kind: "posting" };
  if (p.state === "failed") return { kind: "failed", error: p.error ?? "โพสต์ไม่สำเร็จ" };
  const at = p.at ? new Date(p.at) : null;
  if (p.state === "scheduled" && at && at.getTime() > now.getTime()) return { kind: "scheduled", at };
  return { kind: "published", at };
}

/** On the Page or on its way there. Such a piece lives on the calendar; the studio's
    รอตรวจ and ใช้จริง lists leave it out (the owner's call, 2026-09-24). It stays ใช้จริง
    underneath, so the hook formulas still learn from it. A stuck send (stalePosting) is
    shown as failed and comes back to the lists. */
export const ON_PAGE_STATES = ["posting", "scheduled", "published"] as const;

export function onPage(p: Publish | null, now: Date = new Date()): boolean {
  return p != null && (ON_PAGE_STATES as readonly string[]).includes(p.state) && !stalePosting(p, now);
}

/** "25 ก.ย. 19:30", in Thailand's time whatever the browser's clock says */
export function thaiWhen(d: Date): string {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The card's one line about it, or null when there is nothing to say. */
export function publishLabel(p: Publish | null, now: Date = new Date()): string | null {
  const v = publishView(p, now);
  switch (v.kind) {
    case "posting": return "กำลังส่งไปเพจ…";
    case "scheduled": return `⏰ ตั้งเวลาโพสต์ ${thaiWhen(v.at)}`;
    case "published": return v.at ? `✓ ลงเพจแล้ว ${thaiWhen(v.at)}` : "✓ ลงเพจแล้ว";
    case "failed": return "โพสต์ลงเพจไม่สำเร็จ — เปิดแก้ไขเพื่อลองใหม่";
    default: return null;
  }
}

/**
 * The quick times offered for a schedule: this evening while it is still ahead, then tomorrow
 * noon and evening — Thailand's, whatever the device's clock is set to. They were built with
 * the device's setHours, so a laptop on UTC or abroad held "วันนี้ 19:30" for 02:30 in Bangkok.
 */
export function quickTimes(now: Date = new Date(), minAheadMs = 15 * 60_000): { label: string; at: Date }[] {
  const today = todayKey(now);
  const tomorrow = nextDayKey(today);
  return [
    { label: "วันนี้ 19:30", at: bangkokAt(today, "19:30") },
    { label: "พรุ่งนี้ 12:00", at: bangkokAt(tomorrow, "12:00") },
    { label: "พรุ่งนี้ 19:30", at: bangkokAt(tomorrow, "19:30") },
  ].filter((t) => t.at.getTime() - now.getTime() >= minAheadMs);
}
