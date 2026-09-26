import { describe, expect, it } from "vitest";
import {
  bangkokAt, boardDay, canDropOnDay, countByPage, dayKey, dropRejection, dropTime, groupByDay, lastDropDay, monthGridDays, nextDayKey,
  parseMonth, repeats, shiftMonth, thaiDayLabel, thaiMonthYear, timeOfDay, unscheduled, type BoardItem,
} from "@/lib/content/calendar";

const item = (over: Partial<BoardItem>): BoardItem => ({
  id: "a", pageId: "p1", pageName: "เพจ", planHref: "/lifeprotect", planName: "Life Protect", hook: "h", body: "b",
  imageUrl: "/x.png", status: "waiting", day: null, time: "12:00", postId: null, unreviewed: false, blocked: null, ...over,
});

describe("Thailand's time", () => {
  it("files a moment under Thailand's day and clock, not UTC's", () => {
    const late = new Date("2026-09-25T23:30:00+07:00");
    expect(dayKey(late)).toBe("2026-09-25");
    expect(timeOfDay(late)).toBe("23:30");
  });

  it("turns a Thai day and time back into the moment", () => {
    expect(bangkokAt("2026-09-25", "12:00").toISOString()).toBe("2026-09-25T05:00:00.000Z");
    expect(nextDayKey("2026-09-30")).toBe("2026-10-01");
  });
});

describe("the month grid", () => {
  it("starts on Monday and borrows real days from the months either side", () => {
    const cells = monthGridDays(2026, 9); // 1 Sep 2026 is a Tuesday
    expect(cells[0]).toEqual({ day: "2026-08-31", inMonth: false });
    expect(cells[1]).toEqual({ day: "2026-09-01", inMonth: true });
    expect(cells.length % 7).toBe(0);
    expect(cells.at(-1)).toEqual({ day: "2026-10-04", inMonth: false });
  });

  it("steps across a year, and ignores a nonsense month from the URL", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(parseMonth("2026", "13", { year: 2026, month: 9 })).toEqual({ year: 2026, month: 9 });
    expect(parseMonth("2026", "10", { year: 2026, month: 9 })).toEqual({ year: 2026, month: 10 });
  });

  it("speaks Thai, in Buddhist years", () => {
    expect(thaiMonthYear(2026, 9)).toBe("กันยายน 2569");
    expect(thaiDayLabel("2026-09-25")).toBe("ศุกร์ที่ 25 ก.ย. 2569");
  });
});

describe("the board's rules", () => {
  it("lets a waiting or held piece onto today or later, never the past or a posted one", () => {
    expect(canDropOnDay(item({}), "2026-09-25", "2026-09-25")).toBe(true);
    expect(canDropOnDay(item({}), "2026-09-24", "2026-09-25")).toBe(false);
    expect(dropRejection(item({}), "2026-09-24", "2026-09-25")).toContain("ผ่านมาแล้ว");
    expect(canDropOnDay(item({ status: "published", day: "2026-09-20" }), "2026-09-26", "2026-09-25")).toBe(false);
    expect(canDropOnDay(item({ status: "scheduled", day: "2026-09-26" }), "2026-09-26", "2026-09-25")).toBe(false);
  });

  it("does not light up a day Facebook will not hold a post for", () => {
    expect(lastDropDay("2026-09-25")).toBe("2026-10-24");
    expect(canDropOnDay(item({}), "2026-10-24", "2026-09-25")).toBe(true);
    expect(canDropOnDay(item({}), "2026-10-25", "2026-09-25")).toBe(false);
    expect(dropRejection(item({}), "2026-10-25", "2026-09-25")).toContain("30 วัน");
  });

  it("refuses a piece that breaks Facebook's rules, and says why", () => {
    const bad = item({ blocked: "บอกใบ้ว่าคนอ่านมีหนี้" });
    expect(canDropOnDay(bad, "2026-09-26", "2026-09-25")).toBe(false);
    expect(dropRejection(bad, "2026-09-26", "2026-09-25")).toContain("มีหนี้");
  });

  it("orders a day by time and counts posts per Page", () => {
    const list = [
      item({ id: "b", day: "2026-09-26", time: "19:30", status: "scheduled" }),
      item({ id: "c", day: "2026-09-26", time: "12:00", status: "scheduled", pageId: "p2" }),
      item({ id: "d" }),
    ];
    expect(groupByDay(list).get("2026-09-26")!.map((i) => i.id)).toEqual(["c", "b"]);
    expect(countByPage(list)).toEqual(new Map([["p1", 1], ["p2", 1]]));
  });

  it("marks the same plan twice running on one Page, not across Pages", () => {
    const flagged = repeats([
      item({ id: "a", day: "2026-09-25", time: "12:00", status: "scheduled" }),
      item({ id: "b", day: "2026-09-26", time: "12:00", status: "scheduled" }),
      item({ id: "c", day: "2026-09-26", time: "13:00", status: "scheduled", pageId: "p2" }),
      item({ id: "d", day: "2026-09-27", time: "12:00", status: "scheduled", planHref: "/cancer" }),
    ]);
    expect([...flagged]).toEqual(["b"]);
  });
});

describe("where a drop lands on its day", () => {
  const morning = new Date("2026-09-25T09:00:00+07:00");

  it("is noon, the owner's pick, when the Page has nothing then", () => {
    expect(dropTime("2026-09-26", [], morning)).toBe("12:00");
    expect(dropTime("2026-09-25", [], morning)).toBe("12:00");
  });

  it("is the evening when the Page already has a post at noon that day", () => {
    expect(dropTime("2026-09-26", ["12:00"], morning)).toBe("19:30");
    expect(dropTime("2026-09-26", ["12:00", "19:30"], morning)).toBe("08:30");
  });

  it("is the evening on today once noon is too near or gone, not a refusal", () => {
    expect(dropTime("2026-09-25", [], new Date("2026-09-25T11:50:00+07:00"))).toBe("19:30");
    expect(dropTime("2026-09-25", [], new Date("2026-09-25T14:00:00+07:00"))).toBe("19:30");
  });

  it("shares a time with another post rather than refuse, when every free one is gone", () => {
    expect(dropTime("2026-09-25", ["19:30", "21:00"], new Date("2026-09-25T18:00:00+07:00"))).toBe("19:30");
  });

  it("is nothing when the day has no time left ahead", () => {
    expect(dropTime("2026-09-25", [], new Date("2026-09-25T20:50:00+07:00"))).toBeNull();
  });
});

describe("a post that did not go up", () => {
  const from = new Date("2026-08-31T00:00:00+07:00");
  const to = new Date("2026-10-05T00:00:00+07:00");
  const at = new Date("2026-09-26T12:00:00+07:00");

  it("sits on the day it was meant for, as held and posted ones do", () => {
    expect(boardDay("failed", at, from, to)).toBe("2026-09-26");
    expect(boardDay("scheduled", at, from, to)).toBe("2026-09-26");
    expect(boardDay("published", at, from, to)).toBe("2026-09-26");
  });

  it("waits in the rail when its day is not on the month shown, or it never had a time", () => {
    expect(boardDay("failed", new Date("2026-07-01T12:00:00+07:00"), from, to)).toBeNull();
    expect(boardDay("failed", null, from, to)).toBeNull();
    expect(boardDay("none", at, from, to)).toBeNull();
    expect(boardDay("posting", at, from, to)).toBeNull();
  });

  it("comes first in the rail, ahead of pieces never sent", () => {
    const rail = unscheduled([item({ id: "new" }), item({ id: "missed", status: "failed" }), item({ id: "other" })]);
    expect(rail.map((i) => i.id)).toEqual(["missed", "new", "other"]);
  });
});
