import type { ContentStatus } from "@/lib/content/store";
import { switchedOn } from "./sent-view";

/**
 * The tabs of a campaign's room (Ads Studio): ร่าง, ส่งแล้ว, ถังขยะ. The counts also carry `all`,
 * every piece out of the bin, for the campaign list; it is a count, not a tab a piece sits in.
 * Pure, so the list page, the room and their tests count pieces the same way.
 */

export const AD_TABS = ["draft", "sent", "trash"] as const;
export type AdTab = (typeof AD_TABS)[number];

/** the keys of a campaign's counts: `all` (out of the bin) first, then the tabs a piece can sit in */
export const AD_TAB_KEYS = ["all", ...AD_TABS] as const;
export type AdTabKey = (typeof AD_TAB_KEYS)[number];

/**
 * Where one ad piece sits. A piece sent to Facebook (in a send, or with a live launch) wins over
 * every status; then the bin; anything else is a draft, a piece approved before approval
 * went (status used) included.
 */
export function adTab(piece: { status: ContentStatus }, sent: boolean): AdTab {
  if (sent) return "sent";
  if (piece.status === "trashed") return "trash";
  return "draft";
}

export function tabCounts(rows: AdTab[]): Record<AdTabKey, number> {
  const out: Record<AdTabKey, number> = { all: 0, draft: 0, sent: 0, trash: 0 };
  for (const t of rows) {
    out[t] += 1;
    if (t !== "trash") out.all += 1;
  }
  return out;
}

/**
 * How many of a campaign's ads may be running on Facebook, for the question before ลบแคมเปญ and
 * the delete's log: each send switched on by the app's record or that Meta says is ACTIVE (a
 * switch-on that broke half-way can be on at Meta with no record), plus each per-piece launch
 * from before sends that was switched on.
 */
export function liveCount(
  sends: { activatedAt: string | null; pausedAt: string | null; metaStatus?: string | null }[],
  launches: { activatedAt: string | null }[] = [],
): number {
  return sends.filter((s) => switchedOn(s) || s.metaStatus === "ACTIVE").length + launches.filter((l) => l.activatedAt).length;
}

/**
 * The question before ลบแคมเปญ, wherever it is pressed (ตั้งค่าแคมเปญ, the campaign table's row
 * menu). Facebook is never touched: a send switched on keeps spending, and only Ads Manager can
 * stop it after. Ads sent and not known to be on are not said to be paused: the app may not know.
 */
export function deleteQuestion(o: { title: string; live: number; sent: boolean }): string {
  return `ลบแคมเปญ "${o.title}" และแอดทั้งหมดในแคมเปญนี้ออกจาก Ads Studio?${o.live > 0
    ? `\n\n⚠️ มีแอดที่เปิดใช้อยู่ ${o.live} ชุด — จะยังวิ่งและใช้งบต่อบน Facebook หลังลบแล้วหยุดได้ที่ตัวจัดการโฆษณา (Ads Manager) เท่านั้น`
    : o.sent ? "\n\nแอดที่ส่งขึ้น Facebook แล้วยังอยู่ในตัวจัดการโฆษณา — ตรวจสถานะที่นั่น ถ้าไม่ใช้แล้วให้หยุดหรือลบที่นั่นด้วย" : ""}\n\nลบแล้วกู้คืนไม่ได้`;
}
