import { beforeEach, describe, expect, it, vi } from "vitest";

/** Deleting from one's history: the agent is the signed-in member, never one named in the request. */

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const auth = vi.hoisted(() => ({ requireMember: vi.fn(async () => ({ agentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", staff: null })) }));
vi.mock("@/lib/auth/viewer", () => auth);
const hist = vi.hoisted(() => ({ deleteReading: vi.fn(async () => undefined), clearReadings: vi.fn(async () => undefined) }));
vi.mock("@/lib/content/describe-history", () => hist);

const { clearReadingsAction, deleteReadingAction } = await import("@/app/studio/describe/actions");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("deleteReadingAction", () => {
  it("deletes under the signed-in member's own id", async () => {
    expect(await deleteReadingAction(ID)).toEqual({ ok: true });
    expect(hist.deleteReading).toHaveBeenCalledWith(A, ID);
  });

  it("refuses an id that is not a UUID, calling nothing", async () => {
    expect(await deleteReadingAction("../../x")).toEqual({ ok: false });
    expect(hist.deleteReading).not.toHaveBeenCalled();
  });

  it("answers not ok, and logs, when the store throws", async () => {
    hist.deleteReading.mockRejectedValueOnce(new Error("down"));
    expect(await deleteReadingAction(ID)).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });

  it("asks nothing of the store for somebody who is not signed in", async () => {
    auth.requireMember.mockRejectedValueOnce(new Error("กรุณาเข้าสู่ระบบก่อน"));
    expect(await deleteReadingAction(ID)).toEqual({ ok: false });
    expect(hist.deleteReading).not.toHaveBeenCalled();
  });
});

describe("clearReadingsAction", () => {
  it("clears under the signed-in member's own id", async () => {
    expect(await clearReadingsAction()).toEqual({ ok: true });
    expect(hist.clearReadings).toHaveBeenCalledWith(A);
  });

  it("answers not ok when the store throws", async () => {
    hist.clearReadings.mockRejectedValueOnce(new Error("down"));
    expect(await clearReadingsAction()).toEqual({ ok: false });
  });
});
