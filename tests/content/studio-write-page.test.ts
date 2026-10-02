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
vi.mock("@/lib/auth/pages", () => ({ myPages: vi.fn(async () => { if (pages.failed) throw new Error("db down"); return state.mine; }) }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => state.mine) }));
const store = vi.hoisted(() => ({ listContent: vi.fn(async () => []), listPlanned: vi.fn(async () => [] as unknown[]) }));
const pages = vi.hoisted(() => ({ failed: false }));
vi.mock("@/lib/content/store", () => ({
  getContent: vi.fn(async () => state.opened), listContent: store.listContent, listPlanned: store.listPlanned, listHookTemplates: vi.fn(async () => []),
}));
vi.mock("@/lib/content/people-store", () => ({ listPeople: vi.fn(async () => []) }));
vi.mock("@/app/studio/actions", () => actions);
const viewer = vi.hoisted(() => ({ current: { agentId: "a1", staff: null } as unknown }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: vi.fn(async () => viewer.current) }));
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));
const clip = vi.hoisted(() => ({ enabled: true, failed: false }));
vi.mock("@/lib/video/settings", () => ({ videoSettings: vi.fn(async () => { if (clip.failed) throw new Error("db down"); return { enabled: clip.enabled }; }) }));
vi.mock("@/app/studio/ContentStudio", () => ({ ContentStudio: () => null }));

const { StudioPage } = await import("@/app/studio/StudioPage");
const projectOf = async (args: Parameters<typeof StudioPage>[0]) =>
  ((await StudioPage(args)) as { props: { project: unknown } }).props.project;

beforeEach(() => {
  vi.clearAllMocks();
  state.mine = [{ pageId: "pA", pageName: "A" }, { pageId: "pB", pageName: "B" }];
  state.opened = null;
  pages.failed = false;
  clip.enabled = true;
  clip.failed = false;
  viewer.current = { agentId: "a1", staff: null };
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

describe("when the Pages cannot be read (final review, 2026-09-30)", () => {
  it("keeps the Page asked for, for the server to settle, rather than falling back to none", async () => {
    pages.failed = true;
    expect(await projectOf({ page: "pB" })).toEqual({ pageId: "pB", pageName: "B" });
    expect(actions.contentWorkbench).toHaveBeenCalledWith({ status: "draft", page: "pB" });
    expect(store.listContent).toHaveBeenCalledWith({ status: "used", pageId: "pB" }, 20);
  });

  it("lists nothing rather than every Page's pieces together when no Page was asked for", async () => {
    pages.failed = true;
    expect(await projectOf({})).toBeNull();
    expect(store.listContent).not.toHaveBeenCalled();
  });
});

const propsOf = async (args: Parameters<typeof StudioPage>[0]) =>
  ((await StudioPage(args)) as { props: { planner: boolean; todayPlan: { id: string; title: string }[] } }).props;

describe("an agent who plans rather than posts (owner, 2026-09-30)", () => {
  it("is told what today's plan still holds", async () => {
    state.mine = [];
    store.listPlanned.mockResolvedValue([
      { id: "p1", output: { hooks: ["โพสต์วันนี้"] }, plan: { day: "2026-09-30", doneAt: null } },
      { id: "p2", output: { hooks: ["โพสต์ไปแล้ว"] }, plan: { day: "2026-09-30", doneAt: "t" } },
    ]);
    const props = await propsOf({});
    expect(props.planner).toBe(true);
    expect(store.listPlanned).toHaveBeenCalledWith("2026-09-30", "2026-09-30");
    expect(props.todayPlan).toEqual([{ id: "p1", title: "โพสต์วันนี้" }]);
  });

  it("is not who posting staff are: no plan read for them", async () => {
    viewer.current = { agentId: "s1", staff: { owner: false, publish: true, connect: false, admin: false } };
    const props = await propsOf({});
    expect(props.planner).toBe(false);
    expect(props.todayPlan).toEqual([]);
    expect(store.listPlanned).not.toHaveBeenCalled();
  });
});

describe("the clip editing switch", () => {
  const flag = async () => ((await StudioPage({})) as { props: { clipEditing: boolean } }).props.clipEditing;
  it("reaches the workbench as the owner set it", async () => {
    expect(await flag()).toBe(true);
    clip.enabled = false;
    expect(await flag()).toBe(false);
  });
  it("is off when the setting cannot be read", async () => {
    clip.failed = true;
    expect(await flag()).toBe(false);
  });
});
