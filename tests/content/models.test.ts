import { describe, expect, it } from "vitest";
import { AUTO_FLOOR_THB, DEFAULT_PAINTER, DEFAULT_WRITER, PAINTERS, WRITERS, autoWriterNote, painterFor, painterOf, shortModel, writerOf } from "@/lib/content/models";
import { fallbackWriters } from "@/lib/content/write";

describe("the models the owner may pick", () => {
  it("offers the three writers the bake-off kept, Sonnet first and the default, then the free trial", () => {
    expect(WRITERS.map((w) => w.model)).toEqual(["claude-sonnet-5", "gpt-5", "gemini-3.7-flash", "google/gemma-4-31b-it:free"]);
    expect(writerOf("best").model).toBe("claude-sonnet-5");
  });

  it("never passes on a model name the browser made up", () => {
    // an id not on the list is the default, so a stranger cannot order the dearest model
    expect(writerOf("claude-opus-5-5").model).toBe("claude-sonnet-5");
    expect(writerOf(undefined).model).toBe("claude-sonnet-5");
    expect(painterOf("gpt-image-ultra").modelId).toBe("gpt-image-medium");
  });

  it("has a no-picture choice that costs nothing, and the standard picture as default", () => {
    expect(painterOf("none")).toMatchObject({ modelId: null, thb: 0 });
    expect(painterOf("standard").modelId).toBe("gpt-image-medium");
    expect(PAINTERS.map((p) => p.id)).toEqual(["none", "standard", "sharp", "gemini"]);
  });

  it("names a fallback model the owner did not pick", () => {
    expect(shortModel("gemini-3.7-flash")).toBe("Gemini Flash");
    expect(shortModel("glm-5.3")).toBe("GLM-5.3");
    expect(shortModel("some-new-model")).toBe("some-new-model");
  });

  describe("อัตโนมัติ", () => {
    it("is the default for both rows", () => {
      expect(DEFAULT_WRITER).toBe("auto");
      expect(DEFAULT_PAINTER).toBe("auto");
    });

    it("writes with the best in a round the agent's wallet pays for (no ceiling: Infinity)", () => {
      expect(writerOf("auto", Infinity).model).toBe("claude-sonnet-5");
      expect(writerOf("auto").model).toBe("claude-sonnet-5");
    });

    it("writes with the cheap writer in a round the owner pays for, however much budget is left", () => {
      // a free round, the owner's own, an assistant's free rounds: all under the owner's ceiling
      expect(writerOf("auto", 250).model).toBe("gemini-3.7-flash");
      expect(writerOf("auto", AUTO_FLOOR_THB).model).toBe("gemini-3.7-flash");
      expect(writerOf("auto", 0).model).toBe("gemini-3.7-flash");
    });

    it("draws the standard picture while the budget has room, and none near its end", () => {
      expect(painterOf("auto", 20).id).toBe("standard");
      expect(painterOf("auto", 1).id).toBe("none");
    });

    it("says under the dropdown which writer this round gets, and why", () => {
      expect(autoWriterNote(Infinity)).toBe("ตอนนี้ใช้ Sonnet 5 · หักจากกระเป๋า");
      expect(autoWriterNote(120)).toBe("รอบนี้เป็นรอบฟรี ใช้ Gemini Flash · ถ้าจ่ายจากกระเป๋า จะเขียนด้วย Sonnet 5");
    });

    it("leaves an explicit pick alone whatever the budget", () => {
      expect(writerOf("best", 0.5).model).toBe("claude-sonnet-5");
      expect(painterOf("sharp", 0.5).id).toBe("sharp");
    });
  });

  describe("a picture with a person in it", () => {
    it("is drawn, and priced, as Gemini whatever painter was picked", () => {
      expect(painterFor("standard", 20, true).id).toBe("gemini");
      expect(painterFor("auto", 20, true).id).toBe("gemini");
      expect(painterFor("standard", 20, false).id).toBe("standard");
    });

    it("draws nothing when nothing was asked for, or อัตโนมัติ is near the end of the budget", () => {
      expect(painterFor("none", 20, true).id).toBe("none");
      expect(painterFor("auto", 1, true).id).toBe("none");
    });
  });

  describe("fallback for a writer that is down", () => {
    it("keeps ประหยัด to the cheap model alone", () => {
      expect(fallbackWriters(writerOf("cheap").model)).toEqual(["gemini-3.7-flash"]);
      // อัตโนมัติ near the end of the budget picks ประหยัด, and is held to it too
      expect(fallbackWriters(writerOf("auto", 1).model)).toEqual(["gemini-3.7-flash"]);
    });

    it("lets the dearer picks fall back along the lane เขียนโพสต์, and nothing when no pick", () => {
      // undefined is the lane on ตั้งค่า AI, which never holds the free writer
      expect(fallbackWriters("claude-sonnet-5")).toBeUndefined();
      expect(fallbackWriters(undefined)).toBeUndefined();
    });
  });
});
