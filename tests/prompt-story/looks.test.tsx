import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { freeFrame, freeLook, type FreeContext } from "@/lib/prompt-story/frames";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { PICTURE_STYLES, type PromptStoryInput } from "@/lib/prompt-story/types";

/** คลิปตามโจทย์ in คลิปเล่าเรื่อง's four looks (owner, 2026-11-13, ก ก) */
const scene = { voice: "ทดสอบ เสียง", screen: "ดูแลคนที่เรารัก", picture: "ครอบครัว" };
const input = (style: PromptStoryInput["style"]) => ({ product: "FREESTORY", brief: "x", title: "t", caption: "", scenes: [scene], style, painter: "sharp", faces: { narrator: "m03" } }) as PromptStoryInput;
const ctx = (style: PromptStoryInput["style"]): FreeContext => ({ input: input(style), size: "portrait", customer: "", narrator: "F", contact: { name: "ก", phone: "081" }, crowd: [], faces: {}, words: ["ทดสอบ", "เสียง"], voiceSec: 2 });
const frame = (style: PromptStoryInput["style"]) => renderToStaticMarkup(freeFrame(scene, true, ctx(style), 1));

describe("คลิปตามโจทย์'s looks", () => {
  it("offers the seven looks, in that order, and no other", () => {
    expect(PICTURE_STYLES.map((s) => s.id)).toEqual(["paper", "warm", "plot", "line", "board", "neon", "blueprint"]);
    // ไวต์บอร์ด นีออน บลูพริ้นท์ (owner, 2026-11-14) after the four, by these names
    expect(PICTURE_STYLES.slice(4)).toEqual([{ id: "board", name: "ไวต์บอร์ด" }, { id: "neon", name: "นีออน" }, { id: "blueprint", name: "บลูพริ้นท์" }]);
  });

  it("dresses ไวต์บอร์ด นีออน บลูพริ้นท์ in คลิปเล่าเรื่อง's look of the same id", () => {
    for (const s of ["board", "neon", "blueprint"] as const) expect(freeLook(input(s)), s).toEqual({ art: s });
  });

  it("dresses each look as คลิปเล่าเรื่อง's, and leaves the others plain", () => {
    expect(freeLook(input("paper"))).toEqual({ art: "paper" });
    expect(freeLook(input("warm"))).toEqual({ art: "minimal", ground: "warm" });
    expect(freeLook(input("plot"))).toEqual({ art: "plot" });
    expect(freeLook(input("line"))).toEqual({ art: "line" });
    for (const s of ["real", "cartoon", "flat"] as const) expect(freeLook(input(s))).toEqual({});
  });

  it("writes the scene's words once, in the look's own band", () => {
    for (const s of ["paper", "warm", "plot", "line", "real", "cartoon"] as const) expect(frame(s).split("ดูแลคนที่เรารัก").length - 1).toBe(1);
    expect(frame("real")).toContain("rgba(236,232,223,0.9)");
    for (const s of ["paper", "warm", "plot", "line"] as const) expect(frame(s)).not.toContain("rgba(236,232,223,0.9)");
    expect(frame("plot")).toContain("#f3efe4");
    expect(frame("warm")).toContain('class="cut"');
  });

  it("gives การ์ตูนลายเส้น its subtitle with no band, and the rest the band", () => {
    expect(frame("line")).toContain("text-shadow");
    expect(frame("line")).not.toContain("rgba(20,22,26,0.82)");
    expect(frame("paper")).toContain("rgba(20,22,26,0.82)");
  });

  it("takes every style a clip may be in, old ones too, and no other", () => {
    const sent = (style: string) => checkedPromptStory({ draftId: "00000000-0000-0000-0000-000000000000", brief: "โจทย์", title: "ชื่อ", caption: "", scenes: [scene, scene, scene], style, painter: "sharp" }, "F");
    for (const s of ["paper", "warm", "plot", "line", "board", "neon", "blueprint", "real", "cartoon", "flat"]) expect(typeof sent(s), s).toBe("object");
    expect(sent("oil")).toBe("เลือกแบบภาพ");
  });
});
