import { describe, expect, it } from "vitest";
import { openCampaign } from "@/lib/ads/room-view";
import { sentRows } from "@/lib/ads/sent-view";

describe("which campaign the page opens", () => {
  const list = [{ id: "new" }, { id: "old" }];
  it("opens the newest when none is asked for", () => {
    expect(openCampaign(list, { asked: null, fresh: false })).toBe("new");
  });
  it("opens the one asked for when the Page has it", () => {
    expect(openCampaign(list, { asked: "old", fresh: false })).toBe("old");
  });
  it("opens the newest for an id the Page does not have", () => {
    expect(openCampaign(list, { asked: "gone", fresh: false })).toBe("new");
  });
  it("opens none, so the tools make a campaign, when asked for a new one or there is none", () => {
    expect(openCampaign(list, { asked: "old", fresh: true })).toBeNull();
    expect(openCampaign([], { asked: null, fresh: false })).toBeNull();
  });
});

describe("the sent rail's rows", () => {
  const send = (items: { pieceId: string | null; adId: string | null; error: string | null; effectiveStatus: string | null }[]) => ({
    id: "s1", createdAt: "2026-10-03T07:20:00Z", dailyBudgetBaht: 300, items: items.map((i, n) => ({ id: `i${n}`, ...i })),
  });

  it("names each sent ad by what Meta says it is doing", () => {
    const rows = sentRows([send([
      { pieceId: "a", adId: "1", error: null, effectiveStatus: "ACTIVE" },
      { pieceId: "b", adId: "2", error: null, effectiveStatus: "PAUSED" },
      { pieceId: "c", adId: "3", error: null, effectiveStatus: "DISAPPROVED" },
      { pieceId: "d", adId: "4", error: null, effectiveStatus: null },
    ])]);
    expect(rows.map((r) => [r.pieceId, r.status, r.tone])).toEqual([
      ["a", "กำลังวิ่ง", "on"],
      ["b", "หยุดไว้", "off"],
      ["c", "Meta ไม่อนุมัติ", "bad"],
      ["d", "ส่งแล้ว", "off"],
    ]);
    expect(rows[0]).toMatchObject({ budgetBaht: 300, sentAt: "2026-10-03T07:20:00Z" });
  });

  it("says an ad that could not be made, and one still on its way", () => {
    const rows = sentRows([send([
      { pieceId: "a", adId: null, error: "Meta ปฏิเสธ", effectiveStatus: null },
      { pieceId: "b", adId: null, error: null, effectiveStatus: null },
    ])]);
    expect(rows.map((r) => [r.status, r.tone])).toEqual([["สร้างแอดไม่สำเร็จ", "bad"], ["กำลังส่ง…", "off"]]);
  });
});
