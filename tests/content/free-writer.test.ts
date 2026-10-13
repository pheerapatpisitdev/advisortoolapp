import { describe, expect, it } from "vitest";
import { fallbackWriters } from "@/lib/content/write";
import { FREE_WRITER_MODEL, WRITERS, writerOf } from "@/lib/content/models";

describe("Studio's ทดลองฟรี writer", () => {
  it("is offered, free, and falls back to ประหยัด alone", () => {
    expect(writerOf("free")).toMatchObject({ model: FREE_WRITER_MODEL, thb: 0, label: "ทดลองฟรี" });
    expect(fallbackWriters(FREE_WRITER_MODEL)).toEqual([FREE_WRITER_MODEL, "gemini-3.7-flash"]);
  });

  it("is no paid pick's fallback, and ประหยัด still falls back to nothing dearer", () => {
    expect(fallbackWriters("claude-sonnet-5")).not.toContain(FREE_WRITER_MODEL);
    expect(fallbackWriters("gemini-3.7-flash")).toEqual(["gemini-3.7-flash"]);
  });

  it("is never what อัตโนมัติ picks", () => {
    expect(writerOf("auto").id).toBe("best");
    expect(writerOf("auto", 1).id).toBe("cheap");
    expect(WRITERS.map((w) => w.id)).toEqual(["best", "balanced", "cheap", "free"]);
  });
});
