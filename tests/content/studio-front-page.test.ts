import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The /studio front page counts people on each Page's card. Someone of a connected Page the caller
 * does not look after must not be counted: pageOf() reads a person whose Page is not in the
 * caller's own list as every Page's, so the raw library would put them on every card.
 */

const state = vi.hoisted(() => ({
  who: { name: "เจเจ", room: "ห้อง", admin: false, publish: true },
  mine: [{ pageId: "pX", pageName: "X" }] as { pageId: string; pageName: string }[],
  connected: [{ pageId: "pX" }, { pageId: "pY" }] as { pageId: string }[],
  people: [
    { id: "1", name: "ของ X", pageId: "pX" },
    { id: "2", name: "ของ Y", pageId: "pY" },
    { id: "3", name: "ทุกเพจ", pageId: null },
  ] as { id: string; name: string; pageId: string | null }[],
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => ({ gatePage: vi.fn(async () => state.who), whoOf: (v: unknown) => v }));
vi.mock("@/lib/content/people-store", () => ({ listPeople: vi.fn(async () => state.people) }));
vi.mock("@/lib/content/store", () => ({
  countByStatus: vi.fn(async () => ({ draft: 0 })), countDraftsByPage: vi.fn(async () => new Map([["pX", 4]])), listHookTemplates: vi.fn(async () => []), listPublished: vi.fn(async () => []),
}));
vi.mock("@/app/studio/publish", () => ({
  publishSetup: vi.fn(async () => ({ pages: state.mine.map((p) => ({ ...p, canPost: true })) })),
}));
vi.mock("@/lib/auth/pages", () => ({ myPages: vi.fn(async () => state.mine) }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => state.connected) }));
vi.mock("@/app/studio/StudioHome", () => ({ StudioHome: () => null }));

const { default: StudioFrontPage } = await import("@/app/studio/page");

type Card = { id: string; tiles: { key: string; status: string }[] };
async function cards(): Promise<Card[]> {
  const element = (await StudioFrontPage({ searchParams: Promise.resolve({}) })) as { props: { cards: Card[] } };
  return element.props.cards;
}
const peopleStatus = (card: Card) => card.tiles.find((t) => t.key === "people")?.status;

beforeEach(() => {
  state.who = { name: "เจเจ", room: "ห้อง", admin: false, publish: true };
  state.mine = [{ pageId: "pX", pageName: "X" }];
});

describe("the people counted on a card of the front page", () => {
  it("leave out someone of a connected Page the caller does not look after", async () => {
    const [card] = await cards();
    expect(card.id).toBe("pX");
    expect(peopleStatus(card)).toBe("2 คน"); // ของ X + ทุกเพจ, not ของ Y
  });

  it("with no Page of their own, count only the people who belong to no Page", async () => {
    state.mine = [];
    const [card] = await cards();
    expect(card.id).toBe("room");
    expect(peopleStatus(card)).toBe("1 คน");
  });

  it("say how many drafts the card's own Page has", async () => {
    const [card] = await cards();
    expect(card.tiles.find((t) => t.key === "write")?.status).toBe("ร่าง 4 ชิ้น");
  });

  it("stay whole for an admin, who sees every Page", async () => {
    state.who = { name: "เจ้าของ", room: "ห้อง", admin: true, publish: true };
    state.mine = [{ pageId: "pX", pageName: "X" }, { pageId: "pY", pageName: "Y" }];
    const shown = await cards();
    expect(shown.map(peopleStatus)).toEqual(["2 คน", "2 คน"]);
  });
});
