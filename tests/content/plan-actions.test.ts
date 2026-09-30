import { beforeEach, describe, expect, it, vi } from "vitest";

/** Planning is checked on the server: the asker's own piece, a day not gone (owner, 2026-09-30). */

const ID = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f";
const store = vi.hoisted(() => ({ getContent: vi.fn(), setPlan: vi.fn(), setPlanDone: vi.fn() }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("@/lib/content/calendar", async (orig) => ({ ...(await orig<typeof import("@/lib/content/calendar")>()), todayKey: () => "2026-09-30" }));

const { markPlanDone, planPiece, unplanPiece } = await import("@/app/studio/plan");

const piece = (over: object = {}) => ({ id: ID, status: "draft", plan: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  store.getContent.mockResolvedValue(piece());
  store.setPlan.mockImplementation(async (_id: string, day: string | null) => piece({ plan: day ? { day, doneAt: null } : null }));
  store.setPlanDone.mockImplementation(async (_id: string, done: boolean) => piece({ plan: { day: "2026-10-01", doneAt: done ? "t" : null } }));
});

describe("putting a piece on a day", () => {
  it("puts the asker's own piece on today or a day ahead", async () => {
    expect(await planPiece({ id: ID, day: "2026-09-30" })).toMatchObject({ ok: true, item: { plan: { day: "2026-09-30" } } });
    expect(store.setPlan).toHaveBeenCalledWith(ID, "2026-09-30");
  });

  it("refuses a day gone or not a day, and writes nothing", async () => {
    for (const day of ["2026-09-29", "2026-02-30", "x"]) expect(await planPiece({ id: ID, day })).toMatchObject({ ok: false });
    expect(store.setPlan).not.toHaveBeenCalled();
  });

  it("refuses somebody else's piece, and one in the bin", async () => {
    store.getContent.mockResolvedValueOnce(null);
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "ไม่พบชิ้นงานนี้" });
    store.getContent.mockResolvedValueOnce(piece({ status: "trashed" }));
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "ไม่พบชิ้นงานนี้" });
    expect(store.setPlan).not.toHaveBeenCalled();
  });
});

describe("taking a piece off, and saying it was posted", () => {
  it("takes the asker's own piece off", async () => {
    expect(await unplanPiece(ID)).toMatchObject({ ok: true });
    expect(store.setPlan).toHaveBeenCalledWith(ID, null);
  });

  it("marks a planned piece posted, and unmarks it", async () => {
    store.getContent.mockResolvedValue(piece({ plan: { day: "2026-10-01", doneAt: null } }));
    expect(await markPlanDone({ id: ID, done: true })).toMatchObject({ ok: true, item: { plan: { doneAt: "t" } } });
    expect(await markPlanDone({ id: ID, done: false })).toMatchObject({ ok: true, item: { plan: { doneAt: null } } });
  });

  it("will not mark a piece that is not planned", async () => {
    expect(await markPlanDone({ id: ID, done: true })).toEqual({ ok: false, error: "ชิ้นนี้ยังไม่ได้วางแผน" });
    expect(store.setPlanDone).not.toHaveBeenCalled();
  });

  it("says so in Thai when the save fails", async () => {
    store.setPlan.mockRejectedValueOnce(new Error("db down"));
    expect(await planPiece({ id: ID, day: "2026-10-01" })).toEqual({ ok: false, error: "บันทึกแผนไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" });
  });
});
