import { describe, expect, it, vi } from "vitest";
import { NO_FLAGS } from "@/lib/content/clip";

// publish-flow is imported for its 48-hour window; its other imports are not needed here
vi.mock("@/app/studio/actions", () => ({ setContentStatus: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: vi.fn() }));

const { sweepPlan } = await import("@/lib/content/clip-sweep");
type SweepFile = import("@/lib/content/clip-sweep").SweepFile;
type SweepRow = import("@/lib/content/clip-sweep").SweepRow;

const now = new Date("2026-12-31T00:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const file = (piece: string, name: string, h = 30): SweepFile => ({ piece, name, createdAt: ago(h) });
const row = (id: string, name: string, over: Partial<SweepRow> = {}, uploadedH = 30): SweepRow => ({
  id, rev: "r", state: null, at: null,
  video: { path: `${id}/${name}`, durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: ago(uploadedH), caption: "", flags: NO_FLAGS },
  ...over,
});

describe("sweepPlan", () => {
  it("removes a file whose piece is gone, and a file no piece points at, once a day old", () => {
    const rows = new Map([["a", row("a", "keep.mp4")]]);
    const plan = sweepPlan([file("gone", "x.mp4"), file("a", "old.mp4"), file("a", "keep.mp4"), file("a", "fresh.mp4", 2)], rows, now);
    expect(plan.remove.sort()).toEqual(["a/old.mp4", "gone/x.mp4"]);
    expect(plan.expire).toEqual([]);
  });

  it("lets a posted clip's file go 48 hours after it went up", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "published", at: ago(49) })],
      ["b", row("b", "v.mp4", { state: "published", at: ago(10) })],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now);
    expect(plan.remove).toEqual(["a/v.mp4"]);
    expect(plan.expire).toEqual(["a"]);
  });

  it("lets a never-scheduled clip's file go after 60 days", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", {}, 24 * 61)],
      ["b", row("b", "v.mp4", { state: "failed" }, 24 * 61)],
      ["c", row("c", "v.mp4", {}, 24 * 59)],
    ]);
    const plan = sweepPlan([file("a", "v.mp4"), file("b", "v.mp4"), file("c", "v.mp4")], rows, now);
    expect(plan.remove.sort()).toEqual(["a/v.mp4", "b/v.mp4"]);
    expect(plan.expire.sort()).toEqual(["a", "b"]);
  });

  it("never touches a held clip, however old", () => {
    const rows = new Map([
      ["a", row("a", "v.mp4", { state: "scheduled", at: ago(-24) }, 24 * 90)],
      ["b", row("b", "v.mp4", { state: "posting", at: ago(1) }, 24 * 90)],
    ]);
    expect(sweepPlan([file("a", "v.mp4"), file("b", "v.mp4")], rows, now)).toEqual({ remove: [], expire: [] });
  });

  it("does not expire a clip already expired", () => {
    const r = row("a", "v.mp4", {}, 24 * 61);
    r.video!.expired = true;
    expect(sweepPlan([file("a", "v.mp4")], new Map([["a", r]]), now)).toEqual({ remove: ["a/v.mp4"], expire: [] });
  });
});
