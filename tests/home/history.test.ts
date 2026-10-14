import { describe, expect, it } from "vitest";
import {
  buildHistory, byDay, matches, monthOptions, monthRange, parseMonth, shiftMonth, summarize, whenShort, type HistSources,
} from "@/lib/home/history";

const now = new Date("2026-10-14T15:00:00+07:00");
const empty: HistSources = { pieces: [], posts: [], videos: [], customers: [], thumbnails: [], readings: [], sends: [], entries: [] };

describe("ประวัติการทำงาน lines", () => {
  it("names each kind of work and sorts newest first", () => {
    const h = buildHistory({
      ...empty,
      pieces: [{ id: "p1", createdAt: "2026-10-14T03:48:00Z", format: "post", planName: "Life Protect x 2", hook: "มรดก 5 ล้าน เริ่มวันละ 90 บาท", campaignId: null }],
      posts: [{ id: "9", at: "2026-10-14T04:05:00Z", action: "schedule", pieceId: "p1", pageName: "LuckyPlanner", hook: "มรดก 5 ล้าน", when: "2026-10-14T12:00:00Z" }],
      videos: [{ id: "v1", createdAt: "2026-10-14T07:32:00Z", product: "LIFEPROTECT", fhc: false, motion: true, customer: "คุณสมชาย", status: "done" }],
      customers: [{ id: "c1", createdAt: "2026-10-14T02:20:00Z", name: "คุณวรรณา", gaps: [] }],
      entries: [{ id: "e1", kind: "charge", amountSatang: -1000, round: "quote-video", note: null, createdAt: "2026-10-14T06:10:00Z" }],
      sends: [{ id: "s1", createdAt: "2026-10-13T11:40:00Z", campaignId: "k1", campaignName: "iShield", pageName: "LuckyPlanner", objective: "traffic", budgetMinor: 30000, currency: "THB", error: null }],
    });
    expect(h.map((x) => [x.word, x.title, x.note])).toEqual([
      ["คลิป", "วิดีโอนำเสนอ Life Protect · คุณสมชาย", "เสร็จแล้ว · Motion Graphic"],
      ["เงิน", "หักค่าวิดีโอนำเสนอ", "กระเป๋าเงิน"],
      ["โพสต์", "ตั้งเวลาโพสต์ “มรดก 5 ล้าน”", "LuckyPlanner · ขึ้น 14 ต.ค. 19:00"],
      ["Studio", "เขียนโพสต์ · Life Protect x 2", "“มรดก 5 ล้าน เริ่มวันละ 90 บาท”"],
      ["FHC", "เพิ่มลูกค้า คุณวรรณา", "ครบทุกด้านแล้ว"],
      ["แอด", "ยิงแอด Messenger · iShield", "LuckyPlanner · ฿300/วัน"],
    ]);
    expect(h.find((x) => x.kind === "studio" && x.word === "Studio")?.href).toBe("/studio/write?open=p1");
    expect(h.find((x) => x.kind === "money")?.satang).toBe(-1000);
  });

  it("sends an ad piece to its campaign, not the write page", () => {
    const [h] = buildHistory({ ...empty, pieces: [{ id: "p2", createdAt: "2026-10-01T00:00:00Z", format: "ad", planName: "iShield", hook: "", campaignId: "k9" }] });
    expect([h.title, h.note, h.href]).toEqual(["เขียนแอด · iShield", "", "/studio/ads/k9"]);
  });

  it("drops an audit action it does not know", () => {
    expect(buildHistory({ ...empty, posts: [{ id: "1", at: "2026-10-01T00:00:00Z", action: "connect-page", pieceId: null, pageName: null, hook: "", when: null }] })).toEqual([]);
  });
});

describe("days, months and the summary", () => {
  const items = buildHistory({
    ...empty,
    videos: [
      { id: "v1", createdAt: "2026-10-14T07:32:00Z", product: "PENSION", fhc: false, motion: false, customer: "", status: "done" },
      { id: "v2", createdAt: "2026-10-13T07:32:00Z", product: null, fhc: true, motion: false, customer: "คุณธนพล", status: "failed" },
    ],
    thumbnails: [{ id: "t1", createdAt: "2026-10-12T03:00:00Z" }],
    entries: [
      { id: "e1", kind: "topup", amountSatang: 50000, round: null, note: null, createdAt: "2026-10-13T09:02:00Z" },
      { id: "e2", kind: "charge", amountSatang: -500, round: "ai-write", note: null, createdAt: "2026-10-12T09:02:00Z" },
    ],
  });

  it("groups by Bangkok day with วันนี้ and เมื่อวาน", () => {
    expect(byDay(items, now).map((d) => [d.label, d.items.map((i) => i.time)])).toEqual([
      ["วันนี้ · พุธที่ 14 ต.ค.", ["14:32"]],
      ["เมื่อวาน · อังคารที่ 13 ต.ค.", ["16:02", "14:32"]],
      ["จันทร์ที่ 12 ต.ค.", ["16:02", "10:00"]],
    ]);
  });

  it("says the hour today, เมื่อวาน, else the date on the card", () => {
    expect(["2026-10-14T07:32:00Z", "2026-10-13T07:32:00Z", "2026-10-11T07:32:00Z"].map((t) => whenShort(t, now)))
      .toEqual(["14:32", "เมื่อวาน", "11 ต.ค."]);
  });

  it("counts finished clips and money spent, not top-ups", () => {
    expect(summarize(items)).toEqual({ studio: 1, clips: 1, customers: 0, spentSatang: 500 });
  });

  it("searches title and note, every word", () => {
    const fhc = items.find((i) => i.key === "clip-v2")!;
    expect([matches(fhc, "ธนพล"), matches(fhc, "fhc ไม่สำเร็จ"), matches(fhc, "ธนพล iShield")]).toEqual([true, true, false]);
  });

  it("reads ?m= safely and walks months", () => {
    expect([parseMonth("2026-09", now), parseMonth("2026-13", now), parseMonth("2027-01", now), parseMonth(undefined, now)])
      .toEqual(["2026-09", "2026-10", "2026-10", "2026-10"]);
    expect([shiftMonth("2026-01", -1), shiftMonth("2026-12", 1)]).toEqual(["2025-12", "2027-01"]);
    expect(monthRange("2026-12").map((d) => d.toISOString())).toEqual(["2026-11-30T17:00:00.000Z", "2026-12-31T17:00:00.000Z"]);
    expect(monthOptions(now)).toEqual(["2026-10", "2026-09"]);
  });
});

describe("posts", () => {
  const move = (id: string, at: string, when: string) =>
    ({ id, at, action: "reschedule", pieceId: "p1", pageName: "LuckyPlanner", hook: "“วันธรรมดาที่ผ่านไปเงียบๆ”", when });

  it("shows a post moved many times in one day once, at its last time, with one pair of quotes", () => {
    const h = buildHistory({ ...empty, posts: [
      move("1", "2026-10-14T07:39:00Z", "2026-10-14T10:00:00Z"),
      move("2", "2026-10-14T07:40:00Z", "2026-10-21T12:30:00Z"),
      move("3", "2026-10-13T07:40:00Z", "2026-10-20T12:30:00Z"),
    ] });
    expect(h.map((x) => [x.key, x.title, x.note])).toEqual([
      ["post-2", "เลื่อนเวลาโพสต์ “วันธรรมดาที่ผ่านไปเงียบๆ”", "LuckyPlanner · ขึ้น 21 ต.ค. 19:30"],
      ["post-3", "เลื่อนเวลาโพสต์ “วันธรรมดาที่ผ่านไปเงียบๆ”", "LuckyPlanner · ขึ้น 20 ต.ค. 19:30"],
    ]);
  });
});
