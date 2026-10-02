import { describe, expect, it } from "vitest";
import { keepOf, overlayAt, playerJump, subsShown } from "@/lib/video/preview";
import { HOOK_SEC, hookMainSize, subFontSize } from "@/lib/video/styles";
import type { Span } from "@/lib/video/timeline";

/** The clip editor's live preview works its clock out the way the render does (2026-10-02). */

const KEEP: Span[] = [[0, 2], [4, 6], [8, 9]];

describe("playerJump", () => {
  it("stays inside a kept stretch", () => {
    expect(playerJump(0, KEEP)).toBeNull();
    expect(playerJump(1.5, KEEP)).toBeNull();
    expect(playerJump(5, KEEP)).toBeNull();
  });
  it("jumps from a cut to the next kept start", () => {
    expect(playerJump(2.5, KEEP)).toBe(4);
    expect(playerJump(6.3, KEEP)).toBe(8);
    // at a kept stretch's very end, the next one
    expect(playerJump(1.99, KEEP)).toBe(4);
  });
  it("counts a frame early as on the kept start, so the jump does not repeat", () => {
    expect(playerJump(3.99, KEEP)).toBeNull();
  });
  it("says end once nothing kept is left", () => {
    expect(playerJump(9, KEEP)).toBe("end");
    expect(playerJump(12, KEEP)).toBe("end");
    expect(playerJump(0, [])).toBe("end");
  });
});

describe("overlayAt", () => {
  const subs = [
    { start: 0, end: 1, text: "หนึ่ง", seg: 0 },
    { start: 1, end: 3, text: "สอง", seg: 1 },
    { start: 3, end: 5, text: "  ", seg: 2 },
  ];
  it("shows the hook only under HOOK_SEC on the cut clip's clock", () => {
    // source 4.5 is output 2.5: still under 2.6
    expect(overlayAt(4.5, KEEP, subs, true).hook).toBe(true);
    expect(overlayAt(4.7, KEEP, subs, true).hook).toBe(false);
    expect(overlayAt(0, KEEP, subs, false).hook).toBe(false);
    expect(HOOK_SEC).toBe(2.6);
  });
  it("stops the hook at the clip's end when the clip is shorter than the hook", () => {
    expect(overlayAt(1.9, [[0, 2]], [], true).hook).toBe(true);
    expect(overlayAt(2, [[0, 2]], [], true).hook).toBe(false);
  });
  it("picks the line whose output time holds the moment, the later where two meet, never an empty one", () => {
    expect(overlayAt(0.5, KEEP, subs, false).sub).toBe(0);
    expect(overlayAt(1, KEEP, subs, false).sub).toBe(1);
    // source 4.5 → output 2.5
    expect(overlayAt(4.5, KEEP, subs, false).sub).toBe(1);
    expect(overlayAt(5.5, KEEP, subs, false).sub).toBe(-1);
  });
});

describe("subsShown", () => {
  it("leaves a cut sentence's lines off and moves the rest onto the cut clip's clock", () => {
    const edit = {
      cut: [1],
      subs: [
        { start: 0, end: 2, text: "แรก", seg: 0 },
        { start: 2, end: 4, text: "ตัดออก", seg: 1 },
        { start: 4, end: 6, text: "ท้าย", seg: 2 },
        { start: 6, end: 7, text: "เก่า" },
      ],
    };
    const keep: Span[] = [[0, 2], [4, 8]];
    expect(subsShown(edit, keep)).toEqual([
      { start: 0, end: 2, text: "แรก", seg: 0 },
      { start: 2, end: 4, text: "ท้าย", seg: 2 },
      // a line with no sentence is never cut with one
      { start: 4, end: 5, text: "เก่า", seg: -1 },
    ]);
  });
});

describe("keepOf", () => {
  it("keeps the whole clip with nothing cut and no silence", () => {
    expect(keepOf({ durationSec: 10, transcript: [] }, { cut: [], silences: [], trimSilence: true })).toEqual([[0, 10]]);
  });
});

describe("the words' sizes, shared by the render's pictures and the preview", () => {
  it("keeps a subtitle at full size for two lines and shrinks it for more, never under 40", () => {
    expect(subFontSize(64, 1)).toBe(64);
    expect(subFontSize(64, 2)).toBe(64);
    expect(subFontSize(64, 3)).toBe(43);
    expect(subFontSize(70, 9)).toBe(40);
  });
  it("sizes the hook's main line by its lines and whether it has a top line", () => {
    expect(hookMainSize(1, false)).toBe(76);
    expect(hookMainSize(3, false)).toBe(76);
    expect(hookMainSize(3, true)).toBe(54);
    expect(hookMainSize(9, true)).toBe(40);
  });
});
