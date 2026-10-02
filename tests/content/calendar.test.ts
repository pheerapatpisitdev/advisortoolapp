import { describe, expect, it } from "vitest";
import {
  bangkokAt, boardDay, canDropOnDay, fillable, nextOpenDay, weekOf, weekSummary, dayKey, dropRejection, dropTime, groupByDay, lastDropDay, monthGridDays, nextDayKey,
  parseMonth, repeats, shiftMonth, thaiDayLabel, thaiMonthYear, timeOfDay, unscheduled, type BoardItem,
} from "@/lib/content/calendar";

const item = (over: Partial<BoardItem>): BoardItem => ({
  id: "a", pageId: "p1", pageName: "เพจ", planHref: "/lifeprotect", planName: "Life Protect", hook: "h", body: "b",
  imageUrl: "/x.png", reel: false, status: "waiting", day: null, time: "12:00", postId: null, unreviewed: false, blocked: null, ...over,
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

  it("orders a day by time", () => {
    const list = [
      item({ id: "b", day: "2026-09-26", time: "19:30", status: "scheduled" }),
      item({ id: "c", day: "2026-09-26", time: "12:00", status: "scheduled", pageId: "p2" }),
      item({ id: "d" }),
    ];
    expect(groupByDay(list).get("2026-09-26")!.map((i) => i.id)).toEqual(["c", "b"]);
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
    // a send in flight too: it was in neither the grid nor the rail for up to ten minutes
    expect(boardDay("posting", at, from, to)).toBe("2026-09-26");
    expect(boardDay("scheduled", at, from, to)).toBe("2026-09-26");
    expect(boardDay("published", at, from, to)).toBe("2026-09-26");
  });

  it("waits in the rail when its day is not on the month shown, or it never had a time", () => {
    expect(boardDay("failed", new Date("2026-07-01T12:00:00+07:00"), from, to)).toBeNull();
    expect(boardDay("failed", null, from, to)).toBeNull();
    expect(boardDay("none", at, from, to)).toBeNull();
  });

  it("comes first in the rail, ahead of pieces never sent", () => {
    const rail = unscheduled([item({ id: "new" }), item({ id: "missed", status: "failed" }), item({ id: "other" })]);
    expect(rail.map((i) => i.id)).toEqual(["missed", "new", "other"]);
  });
});

describe("this week at a glance", () => {
  it("runs Monday to Sunday around the day, across a month's end", () => {
    expect(weekOf("2026-09-27")).toEqual(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
    expect(weekOf("2026-09-30")[6]).toBe("2026-10-04");
    expect(weekOf("2026-09-28")[0]).toBe("2026-09-28");
  });

  it("counts what went up, what is held and what failed, and names the empty days still to come", () => {
    const today = "2026-09-24"; // a Thursday
    const w = weekSummary([
      item({ id: "a", day: "2026-09-22", status: "published" }),
      item({ id: "b", day: "2026-09-24", status: "published" }),
      item({ id: "c", day: "2026-09-26", status: "scheduled" }),
      item({ id: "d", day: "2026-09-25", status: "failed" }),
      item({ id: "e", day: "2026-09-29", status: "scheduled" }), // next week
      item({ id: "f", day: null }),
    ], today);
    expect([w.published, w.scheduled, w.failed]).toEqual([2, 1, 1]);
    // a failed post does not fill its day; the past is not a gap to fill
    expect(w.emptyAhead).toEqual(["2026-09-25", "2026-09-27"]);
  });

  it("lets a post be put on today up to thirty days ahead, not before", () => {
    expect(fillable("2026-09-25", "2026-09-25")).toBe(true);
    expect(fillable("2026-10-24", "2026-09-25")).toBe(true);
    expect(fillable("2026-09-24", "2026-09-25")).toBe(false);
    expect(fillable("2026-10-25", "2026-09-25")).toBe(false);
  });
});

describe("the next gap on a Page", () => {
  const morning = new Date("2026-09-25T09:00:00+07:00");

  it("is today at noon when the Page has nothing today", () => {
    expect(nextOpenDay(new Set(), morning)).toEqual({ day: "2026-09-25", time: "12:00" });
  });

  it("is the first day the Page has nothing on, not a second post on a day it has", () => {
    expect(nextOpenDay(new Set(["2026-09-25", "2026-09-26", "2026-09-28"]), morning)).toEqual({ day: "2026-09-27", time: "12:00" });
  });

  it("is this evening once noon has gone, and tomorrow once the evening has too", () => {
    expect(nextOpenDay(new Set(), new Date("2026-09-25T14:00:00+07:00"))).toEqual({ day: "2026-09-25", time: "19:30" });
    expect(nextOpenDay(new Set(), new Date("2026-09-25T21:30:00+07:00"))).toEqual({ day: "2026-09-26", time: "12:00" });
  });

  it("is nothing when every day Facebook will hold is taken", () => {
    const all = new Set<string>();
    for (let i = 0, d = "2026-09-25"; i < 30; i++) { all.add(d); d = nextDayKey(d); }
    expect(nextOpenDay(all, morning)).toBeNull();
  });
});
