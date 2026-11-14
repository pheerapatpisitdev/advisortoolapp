import { describe, expect, it, vi } from "vitest";
import { LIBRARY } from "@/lib/scene-library/catalog";
import { cleanMarks, hasMark, MARK_FAILED, pressMark, withMark, type Marks } from "@/lib/scene-library/mark-state";

const READY = LIBRARY.find((i) => i.ready)!.id;
const [U1, U2] = LIBRARY.filter((i) => !i.ready).map((i) => i.id);
const none: Marks = { saved: [], wanted: [], counts: {} };

describe("cleanMarks", () => {
  it("keeps saves of any catalogue piece, and votes only for pieces not built yet", () => {
    const m = cleanMarks(LIBRARY, { saved: [READY, U1, "gone-piece"], wanted: [READY, U1, "gone-piece"], counts: { [READY]: 7, [U1]: 3, "gone-piece": 2, [U2]: 0 } });
    expect(m).toEqual({ saved: [READY, U1], wanted: [U1], counts: { [U1]: 3 } });
  });
});

describe("withMark", () => {
  it("turns a save on and off", () => {
    const on = withMark(none, "save", READY, true);
    expect(hasMark(on, "save", READY)).toBe(true);
    expect(withMark(on, "save", READY, false)).toEqual(none);
  });
  it("moves the vote count with the viewer's own vote, once", () => {
    const on = withMark({ ...none, counts: { [U1]: 2 } }, "want", U1, true);
    expect(on).toEqual({ saved: [], wanted: [U1], counts: { [U1]: 3 } });
    // already on: nothing moves
    expect(withMark(on, "want", U1, true)).toBe(on);
    expect(withMark(on, "want", U1, false)).toEqual({ saved: [], wanted: [], counts: { [U1]: 2 } });
  });
  it("never counts below nothing", () => {
    expect(withMark({ ...none, wanted: [U1] }, "want", U1, false).counts[U1] ?? 0).toBe(0);
  });
});

describe("pressMark", () => {
  /** the board's marks, as React would hold them */
  const board = (start: Marks) => {
    let m = start;
    const seen: Marks[] = [];
    return { apply: (kind: "save" | "want", id: string, on: boolean) => { m = withMark(m, kind, id, on); seen.push(m); }, now: () => m, seen };
  };

  it("shows the mark at once, then keeps the server's answer", async () => {
    const b = board(none);
    const toggle = vi.fn(async () => ({ ok: true as const, on: true }));
    expect(await pressMark(toggle, U1, "want", b.now(), b.apply)).toBeNull();
    expect(toggle).toHaveBeenCalledWith(U1, "want");
    expect(b.seen[0].wanted).toEqual([U1]);
    expect(b.now()).toEqual({ saved: [], wanted: [U1], counts: { [U1]: 1 } });
  });
  it("takes the server's answer when it differs from the guess (a second press landed first)", async () => {
    const b = board(none);
    await pressMark(async () => ({ ok: true, on: false }), READY, "save", b.now(), b.apply);
    expect(b.seen[0].saved).toEqual([READY]);
    expect(b.now()).toEqual(none);
  });
  it("puts it back and says why when the server refuses", async () => {
    const start = { saved: [READY], wanted: [], counts: {} };
    const b = board(start);
    expect(await pressMark(async () => ({ ok: false, error: "บันทึกไม่สำเร็จ" }), READY, "save", b.now(), b.apply)).toBe("บันทึกไม่สำเร็จ");
    expect(b.seen[0].saved).toEqual([]);
    expect(b.now()).toEqual(start);
  });
  it("puts it back with a Thai line when the call throws (signed out, network gone)", async () => {
    const start = { saved: [], wanted: [U1], counts: { [U1]: 4 } };
    const b = board(start);
    expect(await pressMark(async () => { throw new Error("NEXT_REDIRECT"); }, U1, "want", b.now(), b.apply)).toBe(MARK_FAILED);
    expect(b.now()).toEqual(start);
    expect(MARK_FAILED).toMatch(/[ก-๙]/);
  });
});
