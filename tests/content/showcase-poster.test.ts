import { describe, expect, it, vi } from "vitest";

// the paper's storage is not under test: a white pixel stands in for it
vi.mock("@/lib/content/store", () => ({ backgroundDataUri: async () => null }));

const { paperPlan } = await import("@/lib/content/poster-draw");
const { metrics } = await import("@/lib/content/poster-layout");
const { SIZES, parsePoster } = await import("@/lib/content/poster");
const { SHOWCASE_PAPER_SHARE, showcasePoster, cleanShowcaseFacts } = await import("@/lib/content/showcase");

/** the plan for papers of these shapes on a poster size, as DocumentPoster asks for it */
function plan(id: keyof typeof SIZES, ratios: number[], share?: number, aside = false) {
  const canvas = SIZES[id];
  const m = metrics(canvas, null);
  const room = canvas.height - m.padTop - m.padBottom;
  const areaW = aside ? Math.round(m.usableWidth * 0.6) : m.usableWidth;
  return { room, m, ...paperPlan(ratios, areaW, room, m.gap, Math.round(24 * m.k), Math.round(14 * m.k), canvas, share, aside) };
}

describe("the share of a poster the papers cover (owner, 2026-10-07: 40%)", () => {
  it("is asked for by a showcase poster, and kept when the poster is read back", () => {
    const poster = showcasePoster({ headline: "ผลงาน" }, cleanShowcaseFacts({ what: "x" }), "hook");
    expect(poster.paperShare).toBe(SHOWCASE_PAPER_SHARE);
    expect(SHOWCASE_PAPER_SHARE).toBe(0.4);
    expect(parsePoster(poster)?.paperShare).toBe(0.4);
  });

  it("is dropped when it is not a sane share", () => {
    const base = { layout: "top", theme: "navy", blocks: [{ kind: "headline", text: "x" }] };
    for (const bad of [0, 0.05, 0.9, "0.4", null, NaN]) expect(parsePoster({ ...base, paperShare: bad })?.paperShare).toBeUndefined();
  });

  it("leaves รีวิวเคลม's split exactly as it was: no share asked, no change", () => {
    for (const id of ["square", "portrait", "story"] as const) {
      const p = plan(id, [0.56]);
      expect(p.side).toBe(false);
      if (!p.side) {
        expect(p.areaH).toBe(p.room - Math.round(p.room * 0.44) - p.m.gap);
        expect(p.wordsH).toBe(Math.round(p.room * 0.44));
      }
    }
  });

  it("covers 40% of a square or portrait poster with a landscape or square paper", () => {
    expect(plan("square", [1.5], 0.4).covered).toBeGreaterThanOrEqual(0.4);
    expect(plan("portrait", [1], 0.4).covered).toBeGreaterThanOrEqual(0.4);
    expect(plan("portrait", [0.56, 0.56], 0.4).covered).toBeGreaterThanOrEqual(0.4);
  });

  it("lays a phone screenshot beside the words, since stacked it cannot get near, and covers far more than before", () => {
    for (const id of ["square", "portrait"] as const) {
      const before = plan(id, [0.5]);
      const after = plan(id, [0.5], 0.4);
      expect(after.side).toBe(true);
      expect(after.covered).toBeGreaterThan(before.covered * 2.5);
      expect(after.covered).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("keeps the words a column of at least a third of the width beside the papers, and the two apart", () => {
    const p = plan("square", [0.5], 0.4);
    if (!p.side) throw new Error("expected the papers beside the words");
    expect(p.wordsW).toBeGreaterThanOrEqual(p.m.usableWidth * 0.34);
    expect(p.wordsW + p.m.gap + p.areaW).toBeLessThanOrEqual(p.m.usableWidth + 1);
  });

  it("never covers less than the fixed split did, and never lays papers beside a person drawn into the photograph", () => {
    for (const id of ["square", "portrait", "story"] as const) {
      for (const ratios of [[0.46], [0.75], [1], [1.5], [0.56, 0.56], [0.75, 0.75, 0.75], [1.5, 1.5]]) {
        expect(plan(id, ratios, 0.4).covered).toBeGreaterThanOrEqual(plan(id, ratios).covered);
      }
    }
    expect(plan("square", [0.5], 0.4, true).side).toBe(false);
  });

  it("keeps the words at least 28% of the room when papers are stacked under them", () => {
    for (const id of ["square", "portrait", "story"] as const) {
      const p = plan(id, [1], 0.4);
      if (!p.side) expect(p.wordsH).toBeGreaterThanOrEqual(Math.round(p.room * 0.28) - 1);
    }
  });
});
