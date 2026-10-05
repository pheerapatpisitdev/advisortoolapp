import { describe, expect, it } from "vitest";
import { adTab, deleteQuestion, liveCount, tabCounts } from "@/lib/ads/campaign-view";

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

describe("liveCount — what the delete question and its log call running", () => {
  const on = { activatedAt: "2026-10-04T01:00:00Z", pausedAt: null };
  const off = { activatedAt: "2026-10-04T01:00:00Z", pausedAt: "2026-10-04T02:00:00Z" };
  const never = { activatedAt: null, pausedAt: null };
  it("counts sends switched on by the app's record", () => expect(liveCount([on, off, never])).toBe(1));
  it("counts a send Meta says is ACTIVE though the app has no switch-on record", () => {
    expect(liveCount([{ ...never, metaStatus: "ACTIVE" }, { ...off, metaStatus: "PAUSED" }])).toBe(1);
  });
  it("counts pre-send launches that were switched on", () => {
    expect(liveCount([never], [{ activatedAt: "2026-09-01T00:00:00Z" }, { activatedAt: null }])).toBe(1);
  });
});

describe("deleteQuestion", () => {
  it("warns of the ads still running", () => {
    expect(deleteQuestion({ title: "ก", live: 2, sent: true })).toContain("มีแอดที่เปิดใช้อยู่ 2 ชุด");
  });
  it("does not claim sent ads are paused when none is known to be on", () => {
    const q = deleteQuestion({ title: "ก", live: 0, sent: true });
    expect(q).not.toContain("หยุดไว้");
    expect(q).toContain("ตรวจสถานะที่นั่น");
  });
  it("says nothing of Facebook when nothing was sent", () => {
    expect(deleteQuestion({ title: "ก", live: 0, sent: false })).not.toContain("Facebook");
  });
});
