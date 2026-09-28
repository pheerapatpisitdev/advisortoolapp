import { describe, expect, it } from "vitest";
import { ALL_PAGES, choosePage, forPage, pageOf, peopleFor, readPageField } from "@/lib/content/people-pages";

const pages = [
  { pageId: "p1", pageName: "LuckyPlanner" },
  { pageId: "p2", pageName: "ประกัน Talk" },
];
const people = [
  { id: "a", name: "phet", pageId: "p2" },
  { id: "b", name: "บอย", pageId: "p1" },
  { id: "c", name: "ใครก็ได้", pageId: null },
  { id: "d", name: "Luck", pageId: "p1" },
  { id: "e", name: "เพจที่ตัดไปแล้ว", pageId: "gone" },
];

describe("a person's Page", () => {
  it("is their own when it is still connected, and every Page's otherwise", () => {
    expect(pageOf(people[0], pages)).toBe("p2");
    expect(pageOf(people[2], pages)).toBe(ALL_PAGES);
    expect(pageOf(people[4], pages)).toBe(ALL_PAGES);
  });

  it("shows a Page its own people and every Page's", () => {
    expect(forPage(people, pages, "p1").map((p) => p.name)).toEqual(["บอย", "ใครก็ได้", "Luck", "เพจที่ตัดไปแล้ว"]);
    expect(forPage(people, [], "p1")).toHaveLength(people.length);
  });

  it("opens the Page asked for, else the first", () => {
    expect(choosePage("p2", pages)).toBe("p2");
    expect(choosePage("nope", pages)).toBe("p1");
    expect(choosePage(undefined, pages)).toBe("p1");
    expect(choosePage(ALL_PAGES, pages)).toBe(ALL_PAGES);
  });
});

describe("the picker while working for a Page", () => {
  it("offers that Page's people and every Page's, nobody else's", () => {
    expect(peopleFor(people, pages, "p1").map((p) => p.name)).toEqual(["บอย", "ใครก็ได้", "Luck", "เพจที่ตัดไปแล้ว"]);
    expect(peopleFor(people, pages, "p2").map((p) => p.name)).toEqual(["phet", "ใครก็ได้", "เพจที่ตัดไปแล้ว"]);
  });

  it("offers everyone where there are no Pages", () => {
    expect(peopleFor(people, [], "")).toEqual(people.map(({ id, name }) => ({ id, name })));
  });
});

describe("the page field sent with a person", () => {
  it("is left alone when not sent, cleared when empty, and a connected Page otherwise", () => {
    expect(readPageField(null, pages)).toEqual({ ok: true, pageId: undefined });
    expect(readPageField("", pages)).toEqual({ ok: true, pageId: null });
    expect(readPageField("p2", pages)).toEqual({ ok: true, pageId: "p2" });
    expect(readPageField("p9", pages)).toEqual({ ok: false });
  });
});
