import type { ContentStatus } from "@/lib/content/store";

/**
 * The tabs of a campaign's room (Ads Studio, 2026-10-04): ร่าง, ยิงแล้ว, เปิดใช้, ถังขยะ.
 * Pure, so the list page, the room and their tests count pieces the same way.
 */

export const AD_TABS = ["draft", "launched", "live", "trash"] as const;
export type AdTab = (typeof AD_TABS)[number];

/**
 * Where one ad piece sits. The bin wins over everything; then a launch that was switched on;
 * then any live launch, finished or stopped part way (the card says which step broke); a piece
 * with no live launch is a draft.
 */
export function adTab(piece: { status: ContentStatus }, launch: { activatedAt: string | null } | null): AdTab {
  if (piece.status === "trashed") return "trash";
  if (launch?.activatedAt) return "live";
  if (launch) return "launched";
  return "draft";
}

export function tabCounts(rows: AdTab[]): Record<AdTab, number> {
  const out: Record<AdTab, number> = { draft: 0, launched: 0, live: 0, trash: 0 };
  for (const t of rows) out[t] += 1;
  return out;
}
