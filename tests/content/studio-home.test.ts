import { describe, expect, it } from "vitest";
import { homeCards, initials, scheduledByPage, type HomeInput } from "@/lib/content/studio-home";

const base: HomeInput = {
  room: "luckyplanner",
  name: "สมชาย",
  publish: true,
  pages: [
    { pageId: "p1", pageName: "Diamond Wealth Planner", canPost: true },
    { pageId: "p2", pageName: "ประกัน talk", canPost: false },
  ],
  scheduled: new Map([["p1", 3]]),
  drafts: 5,
  hooks: 30,
  people: [],
};

const tile = (cards: ReturnType<typeof homeCards>, card: number, key: string) =>
  cards[card].tiles.find((t) => t.key === key);

describe("the Studio home", () => {
  it("draws a card for every connected Page, the calendar filtered to it", () => {
    const cards = homeCards(base);
    expect(cards.map((c) => c.title)).toEqual(["Diamond Wealth Planner", "ประกัน talk"]);
    expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "calendar", "hooks", "people", "settings"]);
    expect(tile(cards, 0, "calendar")).toMatchObject({ href: "/studio/calendar?page=p1", status: "ตั้งเวลาไว้ 3 โพสต์" });
    expect(tile(cards, 1, "calendar")?.status).toBe("ยังไม่มีรายการตั้งเวลา");
  });

  it("says in each tile what is in it", () => {
    const cards = homeCards(base);
    expect(tile(cards, 0, "write")).toMatchObject({ href: "/studio/write?page=p1", status: "ร่าง 5 ชิ้น" });
    expect(tile(cards, 0, "hooks")?.status).toBe("30 สูตร");
    expect(tile(cards, 0, "people")?.status).toBe("ยังไม่มีคน");
    expect(tile(cards, 0, "settings")).toMatchObject({ href: "/admin/posting", status: "เชื่อมต่อ Facebook แล้ว" });
    expect(tile(cards, 1, "settings")?.status).toBe("ยังไม่ให้สิทธิ์โพสต์");
  });

  it("counts the people each Page sees, its own and every Page's, and links the library open on it", () => {
    const cards = homeCards({ ...base, people: [{ pageId: "p1" }, { pageId: "p1" }, { pageId: "p2" }, { pageId: null }] });
    expect(tile(cards, 0, "people")).toMatchObject({ href: "/studio/people?page=p1", status: "3 คน" });
    expect(tile(cards, 1, "people")?.status).toBe("2 คน");
    expect(homeCards({ ...base, publish: false, pages: null, people: [{ pageId: "p1" }, { pageId: null }] })[0].tiles[2])
      .toMatchObject({ href: "/studio/people", status: "2 คน" });
  });

  it("gives a count that could not be read a word, not a zero", () => {
    const cards = homeCards({ ...base, drafts: null, hooks: null });
    expect(tile(cards, 0, "write")?.status).toBe("เปิดดู");
    expect(tile(cards, 0, "hooks")?.status).toBe("เปิดดู");
    expect(homeCards({ ...base, drafts: 0 })[0].tiles[0].status).toBe("ยังไม่มีร่าง");
  });

  it("shows an agent who may not post one card of their room, without the Page's tools", () => {
    const cards = homeCards({ ...base, publish: false, pages: null });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "room", title: "luckyplanner", picture: null });
    expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "hooks", "people"]);
  });

  it("sends staff with no Page connected to connect one", () => {
    const cards = homeCards({ ...base, pages: [] });
    expect(cards).toHaveLength(1);
    expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "hooks", "people", "settings"]);
    expect(tile(cards, 0, "settings")?.status).toBe("ยังไม่ได้เชื่อมต่อ");
    expect(homeCards({ ...base, pages: null })[0].tiles.at(-1)?.status).toBe("อ่านรายชื่อเพจไม่ได้");
  });

  it("puts the Page's own picture on its card", () => {
    expect(homeCards(base)[0].picture).toBe("https://graph.facebook.com/p1/picture?type=square&width=128&height=128");
  });
});

describe("initials", () => {
  it("takes two letters, capitalised, and keeps Thai marks with their letter", () => {
    expect(initials("luckyplanner")).toBe("LU");
    expect(initials("Diamond Wealth Planner")).toBe("DI");
    expect(initials("ประกัน talk")).toBe("ปร");
    expect(initials("  ")).toBe("?");
  });
});

describe("scheduledByPage", () => {
  it("counts only the posts Facebook is holding, per Page", () => {
    const counts = scheduledByPage([
      { publish: { state: "scheduled", pageId: "p1" } },
      { publish: { state: "scheduled", pageId: "p1" } },
      { publish: { state: "published", pageId: "p1" } },
      { publish: { state: "scheduled", pageId: null } },
      { publish: null },
    ]);
    expect([...counts]).toEqual([["p1", 2]]);
  });
});
