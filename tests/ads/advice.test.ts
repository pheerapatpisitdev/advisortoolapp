import { describe, expect, it } from "vitest";
import { advise, baselineCost, BASELINE_FALLBACK_THB } from "@/lib/ads/advice";

/** What ผลแอด suggests for a running ad, against the Page's 30-day cost per chat (spec 2026-10-07). */

describe("baselineCost", () => {
  it("is 60 baht with no chat", () => {
    expect(BASELINE_FALLBACK_THB).toBe(60);
    expect(baselineCost([])).toBe(60);
    expect(baselineCost([{ spend: 500, messaging_started: 0 }])).toBe(60);
  });
  it("is the Page's spend over its chats, in whole baht", () => {
    expect(baselineCost([{ spend: 3355, messaging_started: 65 }, { spend: 2394, messaging_started: 39 }])).toBe(55);
  });
});

describe("advise", () => {
  const at = (spend: number, chats: number, running = true) => advise({ spend, chats, baseline: 50, running });

  it("says nothing of an ad that is not running", () => {
    expect(at(1000, 0, false)).toBeNull();
  });
  it("waits while too little is spent to judge", () => {
    expect(at(40, 0)).toEqual({ kind: "wait", reason: "ใช้ไป ฿40 ยังน้อยกว่าค่าเฉลี่ยต่อแชท ฿50 รอดูต่อ" });
  });
  it("stops an ad with no chat after twice the average", () => {
    expect(at(100, 0)).toEqual({ kind: "stop", reason: "ใช้ไป ฿100 = 2 เท่าของค่าเฉลี่ย ยังไม่มีแชท" });
    expect(at(125, 0)).toEqual({ kind: "stop", reason: "ใช้ไป ฿125 = 2.5 เท่าของค่าเฉลี่ย ยังไม่มีแชท" });
  });
  it("stops an ad whose chats cost 1.5 times the average once it has spent 3 times it", () => {
    expect(at(150, 2)).toEqual({ kind: "stop", reason: "฿75/แชท แพงกว่าค่าเฉลี่ย ฿50 เกิน 1.5 เท่า" });
  });
  it("raises an ad with 3 chats or more at 0.7 of the average or less", () => {
    expect(at(100, 3)).toEqual({ kind: "raise", reason: "฿33/แชท ถูกกว่าค่าเฉลี่ย ฿50 ได้ 3 แชทแล้ว" });
  });
  it("waits on anything else", () => {
    expect(at(100, 2)).toEqual({ kind: "wait", reason: "฿50/แชท ใกล้ค่าเฉลี่ย ฿50 รอดูต่อ" });
    expect(at(75, 0)).toEqual({ kind: "wait", reason: "ใช้ไป ฿75 ยังไม่มีแชท รอดูต่อ" });
    // cheap but only 2 chats: not enough to raise
    expect(at(60, 2)).toEqual({ kind: "wait", reason: "฿30/แชท ถูกกว่าค่าเฉลี่ย ฿50 แต่ยังได้แค่ 2 แชท รอดูต่อ" });
    // dear, but not yet 3 times the average spent
    expect(at(120, 1)).toEqual({ kind: "wait", reason: "฿120/แชท แพงกว่าค่าเฉลี่ย ฿50 รอดูต่อ" });
  });
  it("writes thousands with a comma", () => {
    expect(advise({ spend: 1420, chats: 0, baseline: 800, running: true })).toEqual({
      kind: "wait", reason: "ใช้ไป ฿1,420 ยังไม่มีแชท รอดูต่อ",
    });
  });
});
