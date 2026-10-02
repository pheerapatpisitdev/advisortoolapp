import { describe, expect, it } from "vitest";
import {
  buildSubs, keepRanges, keptDuration, mapTime, parseSilences, snapSegments, speechSpans, subsOnOutput, subtitleLines,
} from "@/lib/video/timeline";
import { DURATION, SEGMENTS, SILENCE_LOG } from "./fixtures/c1369";

describe("parseSilences", () => {
  it("pairs starts with ends, and closes one left open at the end", () => {
    const s = parseSilences(SILENCE_LOG, DURATION);
    expect(s[0]).toEqual([0, 1.53]);
    expect(s[1]).toEqual([4.62, 5.07]);
    expect(s.at(-1)).toEqual([34.21, 35.52]);
    expect(s).toHaveLength(9);
  });
  it("is empty for a log with nothing in it", () => {
    expect(parseSilences("", 10)).toEqual([]);
  });
});

describe("speechSpans", () => {
  it("is what lies between the silences", () => {
    const sp = speechSpans(parseSilences(SILENCE_LOG, DURATION), DURATION);
    expect(sp[0]).toEqual([1.53, 4.62]);
    expect(sp).toHaveLength(8);
    expect(sp.at(-1)).toEqual([30.41, 34.21]);
  });
  it("is the whole clip when nothing was silent", () => {
    expect(speechSpans([], 12)).toEqual([[0, 12]]);
  });
});

describe("snapSegments", () => {
  it("moves a sentence's edges to the nearest silence edge within 1.2 s, and no further", () => {
    const sil = parseSilences(SILENCE_LOG, DURATION);
    const s = snapSegments([{ start: 3.9, end: 9.2, text: "x" }, { start: 14.0, end: 15.0, text: "y" }], sil, DURATION);
    expect(s[0]).toMatchObject({ start: 5.07, end: 9.06 });
    // 14.0 and 15.0 have no speech edge within 1.2 s (11.82 and 16.54/16.92 are further): they stay
    expect(s[1]).toMatchObject({ start: 14.0, end: 15.0 });
  });
});

describe("keepRanges", () => {
  const silences = parseSilences(SILENCE_LOG, DURATION);
  it("drops the silences, leaving 0.1 s of air, as the hand-cut example did", () => {
    const keep = keepRanges({ duration: DURATION, segments: SEGMENTS, cut: [], silences, trimSilence: true });
    expect(keep[0][0]).toBeCloseTo(1.43, 2);
    expect(keep.at(-1)![1]).toBeCloseTo(34.31, 2);
    expect(keptDuration(keep)).toBeCloseTo(31.67, 1);
  });
  it("keeps the whole clip when silence trimming is off and nothing is cut", () => {
    expect(keepRanges({ duration: 10, segments: [], cut: [], silences: [[2, 3]], trimSilence: false })).toEqual([[0, 10]]);
  });
  it("takes a cut sentence out, edges snapped to the silences around it", () => {
    const keep = keepRanges({ duration: DURATION, segments: SEGMENTS, cut: [10], silences, trimSilence: true });
    expect(keep.at(-1)![1]).toBeLessThan(34.3);
    expect(keptDuration(keep)).toBeLessThan(31.67);
  });
  it("is empty when everything is cut", () => {
    expect(keepRanges({ duration: 5, segments: [{ start: 0, end: 5, text: "x" }], cut: [0], silences: [], trimSilence: true })).toEqual([]);
  });
});

describe("mapTime", () => {
  it("counts only the kept time before a moment", () => {
    const keep: [number, number][] = [[1, 3], [5, 9]];
    expect(mapTime(0.5, keep)).toBe(0);
    expect(mapTime(2, keep)).toBe(1);
    expect(mapTime(4, keep)).toBe(2);
    expect(mapTime(6, keep)).toBe(3);
    expect(mapTime(20, keep)).toBe(6);
  });
});

describe("subtitleLines", () => {
  it("breaks on the speaker's spaces first, and Thai words only when a phrase is too long", () => {
    expect(subtitleLines("ส่วนที่เหลือก็คือติดเกี่ยวกับการขอประวัติ")).toEqual(["ส่วนที่เหลือก็คือติด", "เกี่ยวกับการขอประวัติ"]);
    expect(subtitleLines("พี่ๆ น้องๆ ท่านใหม่ที่คอยกดติดตามเพจด้วย")).toEqual(["พี่ๆ น้องๆ", "ท่านใหม่ที่คอยกดติดตามเพจด้วย"]);
  });
  it("never starts a line with a closing particle", () => {
    for (const l of subtitleLines("ขอบคุณลูกเพจมากมายนะคะ แล้วก็ขอบคุณน้องๆ")) expect(l).not.toMatch(/^(คะ|ค่ะ|ครับ|นะ)/);
  });
  it("lets a short leftover ride with the line before, keeping a space after a number", () => {
    expect(subtitleLines("อนุมัติมาที่ 53,333 บาท")).toEqual(["อนุมัติมาที่ 53,333 บาท"]);
  });
  it("keeps every word", () => {
    const text = "ขอบคุณจริงๆ ขอบคุณทุกท่านที่สนับสนุนมา ณ โอกาสนี้ด้วยค่ะ";
    expect(subtitleLines(text).join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
});

describe("buildSubs", () => {
  const silences = parseSilences(SILENCE_LOG, DURATION);
  it("times every line inside a speech span, in order, with no words lost", () => {
    const subs = buildSubs(SEGMENTS, silences, DURATION);
    const spans = speechSpans(silences, DURATION);
    for (const s of subs) expect(spans.some(([a, b]) => s.start >= a - 1e-6 && s.end <= b + 1e-6)).toBe(true);
    for (let i = 1; i < subs.length; i++) expect(subs[i].start).toBeGreaterThanOrEqual(subs[i - 1].start);
    expect(subs.map((s) => s.text).join("").replace(/\s/g, "")).toBe(SEGMENTS.map((s) => s.text).join("").replace(/\s/g, ""));
  });
  it("a segment that falls in a silence joins the nearest speech", () => {
    // its middle (2.6) is 1.1 s from the speech before the silence and 0.4 s from the speech after
    const subs = buildSubs([{ start: 2.4, end: 2.8, text: "เงียบ" }], [[1.5, 3]], 6);
    expect(subs).toHaveLength(1);
    expect(subs[0].start).toBeGreaterThanOrEqual(3);
  });
  it("needs no silences: one span, the whole clip", () => {
    expect(buildSubs([{ start: 0, end: 2, text: "สวัสดีครับ" }], [], 2)).toEqual([{ start: 0, end: 2, text: "สวัสดีครับ" }]);
  });
});

describe("subsOnOutput", () => {
  it("moves subtitles onto the cut clip and drops ones that were cut", () => {
    const keep: [number, number][] = [[0, 2], [4, 6]];
    expect(subsOnOutput([{ start: 0.5, end: 1.5, text: "a" }, { start: 2.5, end: 3.5, text: "cut" }, { start: 4.5, end: 5.5, text: "b" }], keep))
      .toEqual([{ start: 0.5, end: 1.5, text: "a" }, { start: 2.5, end: 3.5, text: "b" }]);
  });
});
