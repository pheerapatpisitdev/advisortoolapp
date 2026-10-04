import type { ContentStatus } from "@/lib/content/store";

/**
 * The tabs of a campaign's room (Ads Studio, 2026-10-04): ทั้งหมด, ร่าง, อนุมัติแล้ว, ส่งแล้ว,
 * ถังขยะ. ทั้งหมด is every piece out of the bin, not a tab a piece sits in.
 * Pure, so the list page, the room and their tests count pieces the same way.
 */

export const AD_TABS = ["draft", "approved", "sent", "trash"] as const;
export type AdTab = (typeof AD_TABS)[number];

/** the room's tab strip: ทั้งหมด first, then where a piece can sit */
export const AD_TAB_KEYS = ["all", ...AD_TABS] as const;
export type AdTabKey = (typeof AD_TAB_KEYS)[number];

/**
 * Where one ad piece sits. A piece sent to Facebook (in a send, or with a live launch) wins over
 * every status; then the bin; then approved (status used); anything else is a draft.
 */
export function adTab(piece: { status: ContentStatus }, sent: boolean): AdTab {
  if (sent) return "sent";
  if (piece.status === "trashed") return "trash";
  if (piece.status === "used") return "approved";
  return "draft";
}

export function tabCounts(rows: AdTab[]): Record<AdTabKey, number> {
  const out: Record<AdTabKey, number> = { all: 0, draft: 0, approved: 0, sent: 0, trash: 0 };
  for (const t of rows) {
    out[t] += 1;
    if (t !== "trash") out.all += 1;
  }
  return out;
}
