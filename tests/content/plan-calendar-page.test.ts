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
