import { describe, expect, it } from "vitest";
import { renderPng } from "@/lib/content/poster-png";
import { TRANSITIONS } from "@/lib/quote-video/job";
import { freeFrame, freeHandText, freeWindows, type FreeContext } from "@/lib/prompt-story/frames";
import type { PromptScene, PromptStoryInput } from "@/lib/prompt-story/types";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";

const SIZE_LIST: VideoSize[] = ["portrait", "square", "landscape"];
/** the scene's picture is its own layer under the frames (make.ts freeParts); a frame only knows whether there is one */
const PIC = true;
const scene = (i: number, screen = "สั้นๆ นะคะ"): PromptScene => ({ voice: `เสียงที่ ${i} ค่ะ`, screen, picture: "a calm room", ...(i === 2 ? { showFigure: true } : {}) });
const figure = { plan: "LIFEPROTECT" as const, variant: "WLF99H", sex: "M" as const, age: 35, sumAssured: 1_000_000, annual: 24_000, monthly: 2_000 };
const input = (count: number, o: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", brief: "b", title: "ชื่อเรื่อง", caption: "c", style: "cartoon", painter: "standard", faces: { narrator: "w26" },
  scenes: Array.from({ length: count }, (_, i) => scene(i + 1)), figure, ...o,
});
const ctx = (i: PromptStoryInput, size: VideoSize): FreeContext => ({
  input: i, size, customer: "", narrator: "F", contact: { name: "เอก", phone: "081" }, crowd: [], faces: {}, words: ["เสียงที่", "1", "ค่ะ"], voiceSec: 6,
});

describe("freeFrame", () => {
  it("moves nothing between words, and fades between scenes", () => {
    expect(freeWindows()).toEqual([]);
    expect(TRANSITIONS.freeScene).toBeDefined();
  });

  for (const count of [3, 8]) {
    it(`draws a ${count}-scene input in every size`, () => {
      for (const size of SIZE_LIST) {
        const i = input(count);
        for (const s of i.scenes) {
          expect(freeFrame(s, PIC, ctx(i, size), 2)).toBeTruthy();
          expect(freeFrame(s, false, ctx(i, size), 2)).toBeTruthy();
        }
      }
    });
  }

  it("renders the longest allowed title and screen, with and without a picture", async () => {
    const title = "ก".repeat(28);
    const screen = "ข".repeat(40);
    const i = input(2, { title, scenes: [{ ...scene(1, screen), showFigure: true }, scene(2, screen)] });
    for (const size of SIZE_LIST) {
      const { w, h } = SIZES[size];
      for (const pic of [true, false]) {
        const png = await renderPng(freeFrame(i.scenes[0], pic, ctx(i, size), 3), { width: w, height: h }, { hand: freeHandText(i) });
        expect(png.length).toBeGreaterThan(1000);
      }
    }
  });

  it("draws the figure card in place of the figure scene's words", () => {
    const i = input(3, { scenes: [scene(1, "คำฉากหนึ่ง"), { ...scene(2, "ซ่อนฉากสอง"), showFigure: true }, scene(3, "คำฉากสาม")] });
    // what is drawn, leaving out the subtitles' context (which carries the whole input)
    const drawn = (el: unknown) => JSON.stringify(el, (k, v) => (k === "c" ? undefined : v));
    const f = drawn(freeFrame(i.scenes[1], true, ctx(i, "portrait"), 2));
    expect(f).toContain("ทุน");
    expect(f).not.toContain("ซ่อนฉากสอง");
    expect(freeHandText(i)).not.toContain("ซ่อนฉากสอง");
    // without a figure the card is not drawn, so the words stay
    const plain = input(3, { figure: undefined, scenes: [scene(1), { ...scene(2, "คำฉากสอง"), showFigure: true }, scene(3)] });
    expect(drawn(freeFrame(plain.scenes[1], true, ctx(plain, "portrait"), 2))).toContain("คำฉากสอง");
    expect(freeHandText(plain)).toContain("คำฉากสอง");
  });

  it("cuts the handwriting face to the title, every screen and the figure card", () => {
    const i = input(3, { title: "หัวเรื่องยาว", scenes: [scene(1, "คำที่หนึ่ง"), scene(2, "คำที่สอง"), scene(3, "คำที่สาม")] });
    const hand = freeHandText(i);
    for (const ch of [...i.title, ...i.scenes.flatMap((s) => [...s.screen]), ..."ชาย 35 ปี ทุน 1 ล้านเบี้ยปีละ 24,000 บาท"]) expect(hand).toContain(ch);
  });

  it("is transparent with no picture in it, and leaves the figure card to the showFigure scene", () => {
    const i = input(3);
    for (const pic of [true, false]) {
      const f = JSON.stringify(freeFrame(i.scenes[0], pic, ctx(i, "portrait"), 2));
      expect(f).not.toContain("<img");
      expect(f).not.toContain("\"img\"");
      expect(f).toContain("transparent");
    }
    expect(JSON.stringify(freeFrame(i.scenes[1], PIC, ctx(i, "portrait"), 2))).toContain("ทุน");
    expect(JSON.stringify(freeFrame(i.scenes[0], PIC, ctx(i, "portrait"), 2))).not.toContain("ทุน");
  });
});
