import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem, Publish } from "@/lib/content/store";

/** "วันว่างถัดไป" over a calendar kept in memory: which day a piece is held for, on which Page. */

const store = vi.hoisted(() => ({ listPublished: vi.fn(), getContent: vi.fn() }));
const flow = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/content/store", async (orig) => ({ ...(await orig<typeof import("@/lib/content/store")>()), ...store }));
vi.mock("@/lib/content/publish-flow", async (orig) => ({ ...(await orig<typeof import("@/lib/content/publish-flow")>()), ...flow }));
vi.mock("@/lib/facebook/connection", () => ({ pageConnections: vi.fn(async () => []) }));

const { scheduleNextOpen } = await import("@/app/studio/publish");

const on = (id: string, pageId: string, at: string) =>
  ({ id, publish: { state: "scheduled", pageId, postId: `${pageId}_1`, at, error: null } as Publish }) as ContentItem;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T09:00:00+07:00"));
  flow.publish.mockImplementation(async (i: { at: string }) => ({ ok: true, item: { id: "x", publish: { at: i.at } } }));
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("scheduleNextOpen", () => {
  it("holds the piece for the first day its Page has nothing on, at noon", async () => {
    store.listPublished.mockResolvedValue([
      on("a", "105", "2026-09-25T05:00:00.000Z"),
      on("b", "105", "2026-09-26T05:00:00.000Z"),
      on("c", "999", "2026-09-27T05:00:00.000Z"), // another Page's post does not take the day
    ]);
    const r = await scheduleNextOpen({ id: "p1", pageId: "105" });
    expect(r.ok).toBe(true);
    expect(flow.publish).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", pageId: "105", at: "2026-09-27T05:00:00.000Z" }));
  });

  it("does not count the piece's own old time as taken", async () => {
    store.listPublished.mockResolvedValue([on("p1", "105", "2026-09-25T05:00:00.000Z")]);
    await scheduleNextOpen({ id: "p1", pageId: "105" });
    expect(flow.publish.mock.calls[0][0].at).toBe("2026-09-25T05:00:00.000Z");
  });

  it("says so when the calendar cannot be read, and sends nothing", async () => {
    store.listPublished.mockRejectedValue(new Error("db"));
    expect(await scheduleNextOpen({ id: "p1", pageId: "105" })).toEqual({ ok: false, error: expect.stringContaining("อ่านปฏิทินไม่สำเร็จ") });
    expect(flow.publish).not.toHaveBeenCalled();
  });
});
