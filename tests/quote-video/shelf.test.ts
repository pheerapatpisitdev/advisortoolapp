import { describe, expect, it } from "vitest";
import { daysFrom, firstTab, growShelf, matches, SHELF_STEP, shelfRows, shelfSize, TABS, tabOf } from "@/app/studio/quote-video/shelf";

// owner 2026-11-27, chose 1ก ข: three tabs, open on กำลังสร้าง only while a clip is being made
describe("clip shelf tabs", () => {
  it("has no ทั้งหมด tab", () => {
    expect(TABS.map((t) => t.label)).toEqual(["กำลังสร้าง", "เสร็จ", "ไม่สำเร็จ"]);
  });
  it("puts both making states under กำลังสร้าง", () => {
    expect(tabOf("drawing")).toBe("making");
    expect(tabOf("rendering")).toBe("making");
    expect(tabOf("done")).toBe("done");
    expect(tabOf("failed")).toBe("failed");
  });
  it("opens on กำลังสร้าง while a clip is made, else on เสร็จ", () => {
    expect(firstTab([{ status: "done" }, { status: "rendering" }])).toBe("making");
    expect(firstTab([{ status: "done" }, { status: "failed" }])).toBe("done");
    expect(firstTab([])).toBe("done");
    expect(firstTab(null)).toBe("done");
  });
});

describe("day buttons", () => {
  // 2026-11-27 01:30 in Bangkok = 2026-11-26 18:30 UTC
  const now = Date.UTC(2026, 10, 26, 18, 30);
  it("วันนี้ starts at Bangkok's midnight, not UTC's", () => {
    expect(new Date(daysFrom("today", now)).toISOString()).toBe("2026-11-26T17:00:00.000Z");
  });
  it("7 and 30 วัน count back from now; ทุกวัน keeps everything", () => {
    expect(now - daysFrom("7", now)).toBe(7 * 86400_000);
    expect(now - daysFrom("30", now)).toBe(30 * 86400_000);
    expect(daysFrom("all", now)).toBe(-Infinity);
  });
});

describe("what the tabs count", () => {
  const day = (id: string, status: "done" | "failed" | "rendering", createdAt = "2026-11-01T00:00:00Z") => ({ id, status, createdAt });
  it("counts every clip, the list's state winning, new ones added, deleted ones out", () => {
    const days = [day("a", "rendering"), day("b", "done"), day("c", "done")];
    const items = [{ ...day("a", "done"), title: "x" }, { ...day("n", "rendering"), title: "new" }];
    const rows = shelfRows(days, items, new Set(["c"]));
    expect(rows.map((r) => [r.id, r.status])).toEqual([["a", "done"], ["n", "rendering"], ["b", "done"]]);
  });
  it("works before the day list has come", () => {
    expect(shelfRows(null, [{ ...day("a", "done"), title: "x" }], new Set()).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("search", () => {
  it("finds every word, any case, in any order", () => {
    const t = "คุณสมชาย · Life Protect · ชาย 35 · แนวตั้ง";
    expect(matches(t, "")).toBe(true);
    expect(matches(t, "สมชาย")).toBe(true);
    expect(matches(t, "life  สมชาย")).toBe(true);
    expect(matches(t, "iHealthy")).toBe(false);
  });
});

describe("แสดงเพิ่ม", () => {
  it("grows one board by 30 at a time and leaves the others", () => {
    expect(shelfSize("story")).toBe(SHELF_STEP);
    expect(growShelf("story")).toBe(60);
    expect(growShelf("story")).toBe(90);
    expect(shelfSize("story")).toBe(90);
    expect(shelfSize("quote")).toBe(SHELF_STEP);
  });
});
