import { describe, expect, it } from "vitest";
import { homeCards, initials, scheduledByPage, type HomeInput } from "@/lib/content/studio-home";

const base: HomeInput = {
  room: "luckyplanner",
  name: "สมชาย",
  publish: true,
  admin: true,
  pages: [
    { pageId: "p1", pageName: "Diamond Wealth Planner", canPost: true },
    { pageId: "p2", pageName: "ประกัน talk", canPost: false },
  ],
  scheduled: new Map([["p1", 3]]),
  drafts: 5,
  draftsByPage: new Map([["p1", 5]]),
  hooks: 30,
  people: [],
  owner: false,
  adCampaigns: null,
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

  it("gives an assistant their Pages' cards without the settings, which are the admins' (owner, 2026-10-02)", () => {
    const cards = homeCards({ ...base, admin: false });
    expect(cards.map((c) => c.title)).toEqual(["Diamond Wealth Planner", "ประกัน talk"]);
    expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "calendar", "hooks", "people"]);
  });

  it("says in each tile what is in it", () => {
    const cards = homeCards(base);
    expect(tile(cards, 0, "write")).toMatchObject({ href: "/studio/write?page=p1", status: "ร่าง 5 ชิ้น" });
    expect(tile(cards, 0, "hooks")?.status).toBe("30 สูตร");
    expect(tile(cards, 0, "people")?.status).toBe("ยังไม่มีคน");
    expect(tile(cards, 0, "settings")).toMatchObject({ href: "/admin/posting", status: "เชื่อมต่อ Facebook แล้ว" });
    expect(tile(cards, 1, "settings")?.status).toBe("ยังไม่ให้สิทธิ์โพสต์");
  });

  it("counts each Page's own drafts on its card (owner, 2026-09-30)", () => {
    const cards = homeCards({ ...base, draftsByPage: new Map([["p1", 2]]) });
    expect(tile(cards, 0, "write")?.status).toBe("ร่าง 2 ชิ้น");
    expect(tile(cards, 1, "write")?.status).toBe("ยังไม่มีร่าง");
    expect(tile(homeCards({ ...base, draftsByPage: null }), 0, "write")?.status).toBe("เปิดดู");
  });

  it("counts the people each Page sees, its own and every Page's, and links the library open on it", () => {
    const cards = homeCards({ ...base, people: [{ pageId: "p1" }, { pageId: "p1" }, { pageId: "p2" }, { pageId: null }] });
    expect(tile(cards, 0, "people")).toMatchObject({ href: "/studio/people?page=p1", status: "3 คน" });
    expect(tile(cards, 1, "people")?.status).toBe("2 คน");
    expect(homeCards({ ...base, publish: false, pages: null, people: [{ pageId: "p1" }, { pageId: null }] })[0].tiles[2])
      .toMatchObject({ href: "/studio/people", status: "2 คน" });
  });

  it("gives a count that could not be read a word, not a zero", () => {
    // a Page's card counts that Page's drafts (its project, 2026-09-30); the room's card counts `drafts`
    const cards = homeCards({ ...base, draftsByPage: null, hooks: null });
    expect(tile(cards, 0, "write")?.status).toBe("เปิดดู");
    expect(tile(cards, 0, "hooks")?.status).toBe("เปิดดู");
    expect(homeCards({ ...base, draftsByPage: new Map() })[0].tiles[0].status).toBe("ยังไม่มีร่าง");
    expect(homeCards({ ...base, publish: false, pages: null, drafts: null })[0].tiles[0].status).toBe("เปิดดู");
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

  it("tells posting staff with no Page of their own to ask the owner, with no settings to open", () => {
    const cards = homeCards({ ...base, admin: false, pages: [] });
    expect(cards).toHaveLength(1);
    expect(cards[0].subtitle).toBe("ยังไม่มีเพจที่ดูแล — ให้เจ้าของเพิ่มที่หน้าทีมงาน");
    expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "hooks", "people"]);
  });

  it("puts the Page's own picture on its card", () => {
    expect(homeCards(base)[0].picture).toBe("https://graph.facebook.com/p1/picture?type=square&width=128&height=128");
  });

  describe("the Ads Studio tile, the owner's alone", () => {
    const owner = { ...base, owner: true };

    it("sits after Organic Studio on each Page's card, to that Page's campaigns", () => {
      const cards = homeCards({ ...owner, adCampaigns: new Map([["p1", { campaigns: 2, launched: 3 }]]) });
      expect(cards[0].tiles.map((t) => t.key)).toEqual(["write", "ads", "calendar", "hooks", "people", "settings"]);
      expect(tile(cards, 0, "ads")).toMatchObject({ href: "/studio/ads?page=p1", label: "Ads Studio", status: "2 แคมเปญ · ยิงแล้ว 3" });
    });

    it("says only the campaigns when none is launched, and that there are none for a Page not in the count", () => {
      const cards = homeCards({ ...owner, adCampaigns: new Map([["p1", { campaigns: 1, launched: 0 }]]) });
      expect(tile(cards, 0, "ads")?.status).toBe("1 แคมเปญ");
      expect(tile(cards, 1, "ads")?.status).toBe("ยังไม่มีแคมเปญ");
    });

    it("says เปิดดู, not a false zero, when the counts could not be read", () => {
      expect(tile(homeCards(owner), 0, "ads")?.status).toBe("เปิดดู");
    });

    it("is not on anyone else's card", () => {
      const cards = homeCards({ ...base, owner: false, adCampaigns: new Map([["p1", { campaigns: 2, launched: 1 }]]) });
      expect(cards.flatMap((c) => c.tiles.map((t) => t.key))).not.toContain("ads");
    });
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
