import { describe, expect, it } from "vitest";
import {
  clipPath, clockOf, isClipPath, isReelPiece, reelDescription, spokenNotes, clipOutput, clipFiles, NO_FLAGS, type ClipVideo,
} from "@/lib/content/clip";

const video = (over: Partial<ClipVideo> = {}): ClipVideo => ({
  path: "p/x.mp4", durationSec: 45, width: 1080, height: 1920, sizeBytes: 1, mime: "video/mp4",
  uploadedAt: "2026-10-02T00:00:00Z", caption: "แคปชัน", flags: NO_FLAGS, transcript: [], ...over,
});

describe("clip paths", () => {
  it("files a clip under its own piece and nowhere else", () => {
    const p = clipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", "video/quicktime");
    expect(p).toMatch(/^0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f\/[0-9a-f-]{36}\.mov$/);
    expect(isClipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", p)).toBe(true);
    expect(isClipPath("other", p)).toBe(false);
    expect(isClipPath("0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f", "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/../x.mp4")).toBe(false);
  });
});

describe("reelDescription", () => {
  it("is the caption with the footer every post carries", () => {
    const text = reelDescription({ ...clipOutput(""), video: video({ caption: "ลดหย่อนภาษีได้" }) });
    expect(text.startsWith("ลดหย่อนภาษีได้")).toBe(true);
    // footer() adds the insurer line always, and the tax line when the words speak of tax
    expect(text.split("\n\n").length).toBeGreaterThan(1);
  });
});

describe("spokenNotes", () => {
  it("asks about a clip nobody has listened to", () => {
    expect(spokenNotes(video({ transcript: undefined }))).toEqual(["ยังไม่ได้ตรวจเสียงพูดในคลิป"]);
  });
  it("lists each warning at its second, and nothing when it is clean", () => {
    expect(spokenNotes(video({ spokenFlags: [{ at: 42.4, kind: "word", text: "การันตี", message: "ได้ยินว่า “การันตี”" }] })))
      .toEqual(["0:42 ได้ยินว่า “การันตี”"]);
    expect(spokenNotes(video())).toEqual([]);
  });
  it("reads seconds as m:ss", () => {
    expect(clockOf(0)).toBe("0:00");
    expect(clockOf(65.9)).toBe("1:05");
  });
});

describe("isReelPiece", () => {
  it("is a clip piece, or any piece that carries a clip", () => {
    expect(isReelPiece({ format: "clip", output: clipOutput("") })).toBe(true);
    expect(isReelPiece({ format: "script", output: { ...clipOutput(""), video: video() } })).toBe(true);
    expect(isReelPiece({ format: "post", output: clipOutput("") })).toBe(false);
  });
});

describe("clipFiles", () => {
  it("is the clip, its preview and its edited take", () => {
    const v = { path: "p/a.mp4", durationSec: 5, width: 1, height: 2, sizeBytes: 1, mime: "video/mp4", uploadedAt: "", caption: "", flags: NO_FLAGS,
      edit: { proxyPath: "p/b.mp4", renderedPath: "p/c.mp4", cut: [], trimSilence: true, subs: [], hook: { main: "" }, style: "box" as const, rev: "r" } };
    expect(clipFiles(v)).toEqual(["p/a.mp4", "p/b.mp4", "p/c.mp4"]);
    expect(clipFiles({ ...v, edit: undefined })).toEqual(["p/a.mp4"]);
  });
});
