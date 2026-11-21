import { describe, expect, it } from "vitest";
import {
  clipKind, clipSteps, DEFAULT_ESTIMATES, estimatesFrom, HOLD, leftWords, preShare, progressView, readNote, type ProgressState,
} from "@/lib/quote-video/progress";

const est = { pre: 90, render: 270 };
const drawing = (note: ProgressState["note"], sinceStart = 0): ProgressState => ({ status: "drawing", note, sinceStart, sinceRender: null, est });

describe("progressView", () => {
  it("starts at 0 before anything is written", () => {
    expect(progressView(drawing(null))).toMatchObject({ pct: 0, text: "เริ่มทำ…" });
  });

  it("counts lines and scenes for real, inside the share before rendering", () => {
    const share = preShare(est) * 100; // 25
    expect(share).toBe(25);
    const v = progressView(drawing({ step: "voice", done: 3, of: 5 }));
    expect(v.pct).toBe(Math.floor(share * 0.35 * 0.6));
    expect(v.text).toBe("ทำเสียงแล้ว 3/5 ประโยค");
    const d = progressView(drawing({ step: "draw", done: 2, of: 5 }));
    expect(d.pct).toBe(Math.floor(share * (0.45 + 0.45 * 0.4)));
    expect(d.text).toBe("วาดภาพแล้ว 2/5 ฉาก");
    expect(progressView(drawing({ step: "submit", done: 0, of: 0 })).pct).toBe(25);
  });

  it("never goes back as the steps move on", () => {
    const steps: ProgressState["note"][] = [
      null, { step: "voice", done: 0, of: 5 }, { step: "voice", done: 5, of: 5 }, { step: "files", done: 0, of: 0 },
      { step: "draw", done: 0, of: 5 }, { step: "draw", done: 5, of: 5 }, { step: "submit", done: 0, of: 0 },
    ];
    const pcts = steps.map((n) => progressView(drawing(n)).pct);
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
    const render = progressView({ status: "rendering", note: null, sinceStart: 90, sinceRender: 0, est });
    expect(render.pct).toBeGreaterThanOrEqual(pcts[pcts.length - 1]);
  });

  it("runs the render on time and waits at 98% past the estimate", () => {
    const half = progressView({ status: "rendering", note: null, sinceStart: 200, sinceRender: 100, est }, 35);
    expect(half.pct).toBe(Math.floor(25 + (HOLD - 25) * 0.5));
    expect(half.leftSec).toBe(135);
    const over = progressView({ status: "rendering", note: null, sinceStart: 600, sinceRender: 400, est });
    expect(over).toEqual({ pct: HOLD, text: "ใกล้เสร็จแล้ว", leftSec: null });
  });

  it("says the time left from the estimate, never under the render's own", () => {
    expect(progressView(drawing({ step: "draw", done: 1, of: 5 }, 30)).leftSec).toBe(60 + 270);
    expect(progressView(drawing({ step: "draw", done: 1, of: 5 }, 300)).leftSec).toBe(5 + 270);
  });
});

describe("preShare", () => {
  it("keeps the part before rendering between 15% and 60%", () => {
    expect(preShare({ pre: 1, render: 1000 })).toBe(0.15);
    expect(preShare({ pre: 1000, render: 1 })).toBe(0.6);
  });
});

describe("estimatesFrom", () => {
  it("uses the median once a kind has three finished clips, and the default before", () => {
    const e = estimatesFrom([
      { kind: "classic-full", pre: 80, render: 200 },
      { kind: "classic-full", pre: 100, render: 300 },
      { kind: "classic-full", pre: 90, render: 250 },
      { kind: "classic-full", pre: 90, render: 5000 }, // a hung render: not counted
      { kind: "motion-full", pre: 10, render: 10 },
    ]);
    expect(e["classic-full"]).toEqual({ pre: 90, render: 250 });
    expect(e["motion-full"]).toEqual(DEFAULT_ESTIMATES["motion-full"]);
  });
});

describe("clipKind", () => {
  it("names a clip's kind from its input", () => {
    expect(clipKind({})).toBe("classic-full");
    expect(clipKind({ style: "motion", length: "short" })).toBe("motion-short");
    expect(clipKind({ fhc: { x: 1 }, style: "motion" })).toBe("fhc");
  });
  it("counts a recipe clip, stored as the 15-second one but about 25 seconds long, as a whole Remotion clip (final review, 2026-11-12)", () => {
    expect(clipKind({ style: "motion", length: "short", engine: "remotion", recipe: "life" })).toBe("remotion-full");
    expect(clipKind({ style: "motion", length: "short", recipe: "ask" })).toBe("remotion-full");
    // no recipe, or a key that is none: as before
    expect(clipKind({ style: "motion", length: "short", engine: "remotion" })).toBe("remotion-short");
    expect(clipKind({ style: "motion", length: "short", engine: "remotion", recipe: "nope" })).toBe("remotion-short");
  });
});

describe("clipKind of an ad clip (วิดีโอโฆษณา, owner, 2026-11-22)", () => {
  it("is the Motion kind: the ad is a Motion short clip, drawn by Remotion once made", () => {
    const ad = { hook: { kind: "question" } };
    expect(clipKind({ style: "motion", length: "short", ad } as never)).toBe("motion-short");
    expect(clipKind({ style: "motion", length: "short", engine: "remotion", ad } as never)).toBe("remotion-short");
  });
});

describe("leftWords", () => {
  it("says the time in plain Thai", () => {
    expect(leftWords(null)).toBe("");
    expect(leftWords(8)).toBe("อีกไม่กี่วินาที");
    expect(leftWords(42)).toBe("อีกประมาณ 40 วินาที");
    expect(leftWords(95)).toBe("อีกประมาณ 1 นาทีครึ่ง");
    expect(leftWords(270)).toBe("อีกประมาณ 4 นาทีครึ่ง");
    expect(leftWords(300)).toBe("อีกประมาณ 5 นาที");
  });
});

describe("คลิปตามโจทย์'s pictures", () => {
  it("has its own words, apart from the scenes being drawn", () => {
    expect(progressView(drawing({ step: "pictures", done: 2, of: 5 })).text).toBe("วาดรูปประกอบ 2/5");
    expect(progressView(drawing({ step: "draw", done: 2, of: 5 })).text).toBe("วาดภาพแล้ว 2/5 ฉาก");
    expect(readNote({ step: "pictures", done: 1, of: 3 })).toEqual({ step: "pictures", done: 1, of: 3 });
  });
  it("never says วาดรูปประกอบ 0/0 for a clip with no picture to paint", () => {
    expect(progressView(drawing({ step: "pictures", done: 0, of: 0 })).text).toBe("เริ่มทำ…");
  });
  it("comes before the voice on the bar and never goes back while drawing", () => {
    const pcts = [0, 3, 5].map((done) => progressView(drawing({ step: "pictures", done, of: 5 })).pct);
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
    expect(pcts[2]).toBeLessThanOrEqual(progressView(drawing({ step: "files", done: 0, of: 0 })).pct);
  });
});

describe("readNote", () => {
  it("reads a row's progress and refuses anything else", () => {
    expect(readNote({ step: "draw", done: 2, of: 5 })).toEqual({ step: "draw", done: 2, of: 5 });
    expect(readNote({ step: "nope" })).toBeNull();
    expect(readNote(null)).toBeNull();
  });
});

describe("clipSteps", () => {
  const rendering = (sinceRender: number): ProgressState => ({ status: "rendering", note: null, sinceStart: 200, sinceRender, est });
  const marks = (s: ProgressState, later = 0) => clipSteps(s, later).map((x) => x.state).join(" ");

  it("lists the four steps, the first in hand before anything is written", () => {
    const s = clipSteps(drawing(null));
    expect(s.map((x) => x.label)).toEqual(["ทำเสียงพากย์", "เตรียมไฟล์", "วาดภาพฉาก", "รวมเป็นวิดีโอ"]);
    expect(s.map((x) => x.state).join(" ")).toBe("now wait wait wait");
  });

  it("ticks off the steps behind and counts the one in hand", () => {
    const v = clipSteps(drawing({ step: "voice", done: 3, of: 12 }));
    expect(v[0]).toEqual({ label: "ทำเสียงพากย์", state: "now", count: "3/12 ประโยค" });
    expect(marks(drawing({ step: "files", done: 0, of: 0 }))).toBe("ok now wait wait");
    const d = clipSteps(drawing({ step: "draw", done: 4, of: 8 }));
    expect(d.map((x) => x.state).join(" ")).toBe("ok ok now wait");
    expect(d[2].count).toBe("4/8 ฉาก");
    expect(d[0].count).toBeUndefined();
  });

  it("names a คลิปตามโจทย์'s pictures as the first step while they are painted", () => {
    expect(clipSteps(drawing({ step: "pictures", done: 2, of: 6 }))[0]).toEqual({ label: "วาดรูปประกอบ", state: "now", count: "2/6 รูป" });
  });

  it("puts the hand-off and the render on the last step", () => {
    expect(marks(drawing({ step: "submit", done: 0, of: 0 }))).toBe("ok ok ok now");
    expect(clipSteps(rendering(10))[3]).toEqual({ label: "รวมเป็นวิดีโอ", state: "now", count: undefined });
    expect(clipSteps(rendering(est.render + 5))[3].count).toBe("ใกล้เสร็จแล้ว");
  });
});
