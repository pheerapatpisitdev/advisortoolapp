import { describe, expect, it } from "vitest";
import { adTab, tabCounts } from "@/lib/ads/campaign-view";

/**
 * Which tab of a campaign's room an ad piece sits under: a piece sent to Facebook is under
 * ส่งแล้ว whatever its status; then the bin; then drafts, an ad approved before approval went (status used) included.
 */

describe("adTab", () => {
  it("puts a piece that was sent under ส่งแล้ว, whatever its status", () => {
    for (const status of ["draft", "used", "trashed"] as const) {
      expect(adTab({ status }, true)).toBe("sent");
    }
  });

  it("puts an unsent piece in the bin under ถังขยะ", () => {
    expect(adTab({ status: "trashed" }, false)).toBe("trash");
  });

  it("keeps a piece approved before this change (status used) in ร่าง", () => {
    expect(adTab({ status: "used" }, false)).toBe("draft");
  });

  it("leaves anything else a draft", () => {
    expect(adTab({ status: "draft" }, false)).toBe("draft");
  });
});

describe("tabCounts", () => {
  it("counts each tab, and ทั้งหมด without the bin", () => {
    expect(tabCounts(["draft", "draft", "sent", "trash"])).toEqual({ all: 3, draft: 2, sent: 1, trash: 1 });
    expect(tabCounts([])).toEqual({ all: 0, draft: 0, sent: 0, trash: 0 });
  });
});
