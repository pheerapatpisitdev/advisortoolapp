import { describe, expect, it } from "vitest";
import { adTab, tabCounts } from "@/lib/ads/campaign-view";

/**
 * Which tab of a campaign's room an ad piece sits under: the bin wins, then a launch that was
 * switched on, then any live launch, and a piece with none is a draft.
 */

describe("adTab", () => {
  it("puts a piece in the bin under ถังขยะ, whatever its launch", () => {
    expect(adTab({ status: "trashed" }, { activatedAt: "2026-10-04T00:00:00Z" })).toBe("trash");
    expect(adTab({ status: "trashed" }, null)).toBe("trash");
  });

  it("puts a switched-on launch under เปิดใช้", () => {
    expect(adTab({ status: "draft" }, { activatedAt: "2026-10-04T00:00:00Z" })).toBe("live");
  });

  it("puts a launch not yet switched on (or stopped part way) under ยิงแล้ว", () => {
    expect(adTab({ status: "draft" }, { activatedAt: null })).toBe("launched");
    expect(adTab({ status: "used" }, { activatedAt: null })).toBe("launched");
  });

  it("puts a piece with no launch under ร่าง", () => {
    expect(adTab({ status: "draft" }, null)).toBe("draft");
    expect(adTab({ status: "used" }, null)).toBe("draft");
  });
});

describe("tabCounts", () => {
  it("counts every tab, zero for the empty ones", () => {
    expect(tabCounts(["draft", "draft", "live", "trash"])).toEqual({ draft: 2, launched: 0, live: 1, trash: 1 });
    expect(tabCounts([])).toEqual({ draft: 0, launched: 0, live: 0, trash: 0 });
  });
});
