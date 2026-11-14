import { describe, expect, it } from "vitest";
import { barText, byDay, cleanInput, cleanLink, dayHeading, shownFrom, unreadOf, visibleTo } from "@/lib/updates/rules";

/** มีอะไรใหม่'s rules (src/lib/updates/rules.ts), owner chose 1ข 2ก 3ก on 2026-11-14 */

describe("visibleTo", () => {
  it("shows a live row for everyone to everyone", () => {
    expect(visibleTo({ status: "live", audience: "all" }, false)).toBe(true);
  });
  it("keeps an owner-only row from the agents and shows it to the owner", () => {
    expect(visibleTo({ status: "live", audience: "owner" }, false)).toBe(false);
    expect(visibleTo({ status: "live", audience: "owner" }, true)).toBe(true);
  });
  it("never shows a draft or a skipped row, even to the owner", () => {
    expect(visibleTo({ status: "draft", audience: "all" }, true)).toBe(false);
    expect(visibleTo({ status: "skip", audience: "all" }, true)).toBe(false);
  });
});

describe("unreadOf and byDay", () => {
  const rows = [
    { id: "a", day: "2026-11-12", title: "สูตรคลิป" },
    { id: "b", day: "2026-11-14", title: "คลังแอนิเมชัน" },
    { id: "c", day: "2026-11-14", title: "ข้อความใบเสนอ" },
  ];
  it("drops what was read and keeps the order", () => {
    expect(unreadOf(rows, ["b"]).map((r) => r.id)).toEqual(["a", "c"]);
  });
  it("groups by day, newest day first, keeping the order within a day", () => {
    expect(byDay(rows).map((d) => [d.day, d.rows.map((r) => r.id)])).toEqual([["2026-11-14", ["b", "c"]], ["2026-11-12", ["a"]]]);
  });
});

describe("words for the page", () => {
  it("heads a day in Thai with the Buddhist year", () => {
    expect(dayHeading("2026-11-14")).toContain("14 พ.ย. 2569");
    expect(dayHeading("2026-11-14")).toContain("เสาร์");
  });
  it("names three titles on the bar and counts the rest", () => {
    const four = ["ก", "ข", "ค", "ง"].map((title) => ({ title }));
    expect(barText(four)).toEqual({ count: 4, titles: "ก · ข · ค และอีก 1 เรื่อง" });
    expect(barText(four.slice(0, 2))).toEqual({ count: 2, titles: "ก · ข" });
  });
  it("looks 60 days back in Bangkok", () => {
    expect(shownFrom(new Date("2026-11-14T03:00:00Z"))).toBe("2026-09-15");
  });
});

describe("cleanLink", () => {
  it("keeps a path in the app and cuts our own address to its path", () => {
    expect(cleanLink("/studio/library")).toBe("/studio/library");
    expect(cleanLink("https://www.advisortool.app/ihealthy-ultra?x=1")).toBe("/ihealthy-ultra?x=1");
  });
  it("means no button when empty", () => {
    expect(cleanLink("")).toBeNull();
  });
  it("refuses anywhere else", () => {
    expect(cleanLink("https://example.com/x")).toBe(false);
    expect(cleanLink("//example.com")).toBe(false);
    expect(cleanLink("/")).toBe(false);
    expect(cleanLink("studio")).toBe(false);
  });
});

describe("cleanInput", () => {
  const good = { kind: "new", grp: "studio", place: " Studio ", title: " คลังแอนิเมชัน ", body: "รวมฉาก", link: "/studio/library", audience: "all" };
  it("trims and passes a good form", () => {
    expect(cleanInput(good)).toEqual({ ok: true, value: { kind: "new", grp: "studio", place: "Studio", title: "คลังแอนิเมชัน", body: "รวมฉาก", link: "/studio/library", audience: "all" } });
  });
  it("asks for a title", () => {
    expect(cleanInput({ ...good, title: "  " })).toEqual({ ok: false, error: "ใส่หัวข้อก่อน" });
  });
  it("refuses an unknown kind, group or audience", () => {
    expect(cleanInput({ ...good, kind: "big" }).ok).toBe(false);
    expect(cleanInput({ ...good, grp: "x" }).ok).toBe(false);
    expect(cleanInput({ ...good, audience: "staff" }).ok).toBe(false);
  });
  it("refuses a link out of the app", () => {
    expect(cleanInput({ ...good, link: "https://example.com" }).ok).toBe(false);
  });
  it("holds the table's limits", () => {
    expect(cleanInput({ ...good, title: "ก".repeat(81) }).ok).toBe(false);
    expect(cleanInput({ ...good, body: "ก".repeat(501) }).ok).toBe(false);
  });
});
