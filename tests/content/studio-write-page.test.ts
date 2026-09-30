import { beforeEach, describe, expect, it, vi } from "vitest";

/** /studio/write opens one Page's project (owner, 2026-09-30): the opened piece's, the card's, or the first. */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const state = vi.hoisted(() => ({
  mine: [{ pageId: "pA", pageName: "A" }, { pageId: "pB", pageName: "B" }] as { pageId: string; pageName: string }[],
  opened: null as null | { id: string; pageId: string | null },
}));
const actions = vi.hoisted(() => ({
  contentWorkbench: vi.fn(async () => ({ items: [], counts: { draft: 0, used: 0, trashed: 0 } })),
  contentSpend: vi.fn(async () => ({ spent: 0, cap: 30, rounds: null })),
}));
vi.mock("@/lib/auth/pages", () => ({ myPages: vi.fn(async () => state.mine) }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => state.mine) }));
vi.mock("@/lib/content/store", () => ({
  getContent: vi.fn(async () => state.opened), listContent: vi.fn(async () => []), listHookTemplates: vi.fn(async () => []),
}));
vi.mock("@/lib/content/people-store", () => ({ listPeople: vi.fn(async () => []) }));
vi.mock("@/app/studio/actions", () => actions);
vi.mock("@/app/studio/ContentStudio", () => ({ ContentStudio: () => null }));

const { StudioPage } = await import("@/app/studio/StudioPage");
const projectOf = async (args: Parameters<typeof StudioPage>[0]) =>
  ((await StudioPage(args)) as { props: { project: unknown } }).props.project;

beforeEach(() => {
  vi.clearAllMocks();
  state.mine = [{ pageId: "pA", pageName: "A" }, { pageId: "pB", pageName: "B" }];
  state.opened = null;
});

describe("the project /studio/write opens", () => {
  it("is the Page of a piece opened from the calendar, whatever Page comes first", async () => {
    state.opened = { id: ID, pageId: "pB" };
    expect(await projectOf({ open: ID })).toEqual({ pageId: "pB", pageName: "B" });
    expect(actions.contentWorkbench).toHaveBeenCalledWith({ status: "draft", page: "pB" });
  });

  it("is the Page its card asked for, else the first", async () => {
    expect(await projectOf({ page: "pB" })).toEqual({ pageId: "pB", pageName: "B" });
    expect(await projectOf({ page: "not-mine" })).toEqual({ pageId: "pA", pageName: "A" });
    expect(await projectOf({})).toEqual({ pageId: "pA", pageName: "A" });
  });

  it("is none for an agent with no Pages", async () => {
    state.mine = [];
    expect(await projectOf({})).toBeNull();
    expect(actions.contentWorkbench).toHaveBeenCalledWith({ status: "draft", page: undefined });
  });
});
