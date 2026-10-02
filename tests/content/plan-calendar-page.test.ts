import { beforeEach, describe, expect, it, vi } from "vitest";

/** /studio/calendar is a Page's for those who post, and a plan for everyone else (owner, 2026-09-30). */

const who = vi.hoisted(() => ({ viewer: { agentId: "a1", staff: null } as unknown }));
const fb = vi.hoisted(() => ({ publishSetup: vi.fn(async () => ({ pages: [] })) }));
const store = vi.hoisted(() => ({ listPlanned: vi.fn(async () => []), listUnplanned: vi.fn(async () => []), listPublished: vi.fn(async () => []), listWaiting: vi.fn(async () => []) }));
vi.mock("@/lib/auth/viewer", () => ({ gatePage: vi.fn(async () => who.viewer), placedBy: vi.fn(async () => ({})) }));
vi.mock("@/app/studio/publish", () => fb);
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/content/publish-flow", () => ({ verifyDue: vi.fn(async () => undefined) }));
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));
vi.mock("@/app/studio/calendar/PlanBoard", () => ({ PlanBoard: () => null }));
vi.mock("@/app/studio/calendar/CalendarBoard", () => ({ CalendarBoard: () => null, MonthList: () => null }));
// the real forClient, watched: every piece read for the page goes through it
const clip = vi.hoisted(() => ({ forClient: vi.fn() }));
vi.mock("@/lib/content/clip", async (orig) => {
  const real = await orig<typeof import("@/lib/content/clip")>();
  clip.forClient.mockImplementation(real.forClient);
  return { ...real, forClient: clip.forClient };
});

const { default: CalendarPage } = await import("@/app/studio/calendar/page");
const { PlanCalendar } = await import("@/app/studio/calendar/PlanCalendar");

beforeEach(() => {
  vi.clearAllMocks();
  who.viewer = { agentId: "a1", staff: null };
});

describe("the calendar an agent with no Page gets", () => {
  it("is the plan, and asks Facebook nothing", async () => {
    const page = (await CalendarPage({ searchParams: Promise.resolve({ y: "2026", m: "10" }) })) as { type: unknown; props: { params: unknown } };
    expect(page.type).toBe(PlanCalendar);
    expect(page.props.params).toEqual({ y: "2026", m: "10" });
    expect(fb.publishSetup).not.toHaveBeenCalled();
  });

  it("reads the month's grid, first day to last, and the rail", async () => {
    await PlanCalendar({ params: { y: "2026", m: "10" } });
    // October 2026's grid runs Monday 28 September to Sunday 1 November
    expect(store.listPlanned).toHaveBeenCalledWith("2026-09-28", "2026-11-01");
    expect(store.listUnplanned).toHaveBeenCalled();
  });

  it("draws a fresh board for each month and view, not the first month's again (final review)", async () => {
    const { PlanBoard } = await import("@/app/studio/calendar/PlanBoard");
    const boardOf = async (params: object) => {
      const tree = (await PlanCalendar({ params })) as { props: { children: { type: unknown; key: string | null }[] } };
      return tree.props.children.find((c) => c?.type === PlanBoard);
    };
    expect((await boardOf({ y: "2026", m: "10" }))?.key).toBe("2026-10-month");
    expect((await boardOf({ y: "2026", m: "11", view: "list" }))?.key).toBe("2026-11-list");
  });
});

describe("what the browser is handed (final review, 2026-10-02)", () => {
  it("every planned and unplanned piece goes through forClient, as every answer carrying a piece does", async () => {
    const piece = (id: string) => ({
      id, createdAt: "", planHref: "clip", format: "clip", angle: "", length: null, flags: { numbers: [], words: [], policy: [], fixes: null },
      model: null, costThb: 0, status: "draft", hookTemplateId: null, publish: null, agentId: "a1", pageId: null, plan: { day: "2026-10-05", doneAt: null },
      output: { hooks: [], body: "", closing: "", hashtags: [], imagePrompt: "", disclaimer: "", video: {
        path: `${id}/v.mp4`, durationSec: 10, width: 1080, height: 1920, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "c",
        flags: { numbers: [], words: [], policy: [], fixes: null },
        edit: { cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box", rev: "r",
          job: { kind: "render", engine: "rendi", id: "j", startedAt: "", tokenHash: "h", tried: ["rendi"], pass: { paidBy: "wallet", holdId: "hold-9", heldSatang: 1, multiplier: 1 } } },
      } },
    });
    store.listPlanned.mockResolvedValueOnce([piece("a")] as never);
    store.listUnplanned.mockResolvedValueOnce([piece("b")] as never);
    await PlanCalendar({ params: { y: "2026", m: "10" } });
    const seen = clip.forClient.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(seen).toEqual(expect.arrayContaining(["a", "b"]));
    for (const r of clip.forClient.mock.results) expect(JSON.stringify(r.value)).not.toContain("hold-9");
  });
});

describe("the calendar posting staff get", () => {
  it("is still the Page's", async () => {
    who.viewer = { agentId: "s1", staff: { owner: false, publish: true, connect: false, admin: false } };
    const page = (await CalendarPage({ searchParams: Promise.resolve({}) })) as { type: unknown };
    expect(page.type).not.toBe(PlanCalendar);
    expect(fb.publishSetup).toHaveBeenCalled();
    expect(store.listPlanned).not.toHaveBeenCalled();
  });
});
