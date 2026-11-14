import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { freeFrame, freeLook, type FreeContext } from "@/lib/prompt-story/frames";
import { checkedPromptStory } from "@/lib/prompt-story/checked";
import { PICTURE_STYLES, type PromptStoryInput } from "@/lib/prompt-story/types";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";

/** คลิปตามโจทย์ in คลิปเล่าเรื่อง's four looks (owner, 2026-11-13, ก ก) */
const scene = { voice: "ทดสอบ เสียง", screen: "ดูแลคนที่เรารัก", picture: "ครอบครัว" };
const input = (style: PromptStoryInput["style"]) => ({ product: "FREESTORY", brief: "x", title: "t", caption: "", scenes: [scene], style, painter: "sharp", faces: { narrator: "m03" } }) as PromptStoryInput;
const ctx = (style: PromptStoryInput["style"]): FreeContext => ({ input: input(style), size: "portrait", customer: "", narrator: "F", contact: { name: "ก", phone: "081" }, crowd: [], faces: {}, words: ["ทดสอบ", "เสียง"], voiceSec: 2 });
const frame = (style: PromptStoryInput["style"]) => renderToStaticMarkup(freeFrame(scene, true, ctx(style), 1));
/** สไตล์ภาพ AI (owner, 2026-11-14): the seven, in the form's order, by these names */
const AI = [
  { id: "cartoon3d", name: "การ์ตูน 3D" }, { id: "clay", name: "ดินเคลย์" }, { id: "anime", name: "อนิเมะ" }, { id: "watercolor", name: "สีน้ำ" },
  { id: "isometric", name: "ไอโซเมตริก" }, { id: "collage", name: "ตัดแปะนิตยสาร" }, { id: "pixel", name: "พิกเซล" },
] as const;

describe("คลิปตามโจทย์'s looks", () => {
  it("offers the seven drawn looks, then the seven AI styles, in that order, and no other", () => {
    expect(PICTURE_STYLES.map((s) => s.id)).toEqual(["paper", "warm", "plot", "line", "board", "neon", "blueprint", ...AI.map((a) => a.id)]);
    // ไวต์บอร์ด นีออน บลูพริ้นท์ (owner, 2026-11-14) after the four, by these names
    expect(PICTURE_STYLES.slice(4, 7)).toEqual([{ id: "board", name: "ไวต์บอร์ด" }, { id: "neon", name: "นีออน" }, { id: "blueprint", name: "บลูพริ้นท์" }]);
    // สไตล์ภาพ AI (owner, 2026-11-14, spec 2026-11-14-ai-picture-styles-design) after them, marked as AI, by these names
    expect(PICTURE_STYLES.slice(7)).toEqual(AI.map((a) => ({ ...a, ai: true })));
    expect(PICTURE_STYLES.slice(0, 7).every((s) => !s.ai)).toBe(true);
  });

  it("leaves the seven AI styles on the plain paper band, as the retired styles", () => {
    for (const { id } of AI) {
      expect(freeLook(input(id)), id).toEqual({});
      expect(frame(id), id).toBe(frame("real"));
      expect(frame(id), id).toContain("rgba(236,232,223,0.9)");
    }
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
    for (const s of ["paper", "warm", "plot", "line", "board", "neon", "blueprint", ...AI.map((a) => a.id), "real", "cartoon", "flat"]) expect(typeof sent(s), s).toBe("object");
    expect(sent("thai")).toBe("เลือกแบบภาพ");
    expect(sent("oil")).toBe("เลือกแบบภาพ");
  });

  it("writes ไวต์บอร์ด นีออน บลูพริ้นท์'s words over a picture on a marker sheet, a glowing sign, a white-on-blue plate", () => {
    for (const s of ["board", "neon", "blueprint"] as const) {
      expect(frame(s).split("ดูแลคนที่เรารัก").length - 1, s).toBe(1);
      expect(frame(s), s).not.toContain("rgba(236,232,223,0.9)");
    }
    const sign = (s: string) => /<div style="([^"]*)">ดูแลคนที่เรารัก</.exec(frame(s as PromptStoryInput["style"]))?.[1] ?? "";
    expect(sign("board")).toContain(`background:${S.boardBoard}`);
    expect(sign("board")).toContain(`color:${S.boardInk}`);
    expect(sign("board")).toContain("font-family:Mali");
    expect(sign("neon")).toContain(`background:${S.neonSub}`);
    expect(sign("neon")).toContain(`color:${S.neonCyan}`);
    expect(sign("neon")).toMatch(new RegExp(`text-shadow:0 0 \\d+px ${S.neonCyan}`));
    expect(sign("neon")).toContain("font-family:Sriracha");
    expect(sign("neon")).toContain("font-weight:400");
    expect(sign("blueprint")).toContain(`background:${S.bpGround}`);
    expect(sign("blueprint")).toContain(`color:${S.bpInk}`);
    expect(sign("blueprint")).toContain(`solid ${S.bpInk}`);
    expect(sign("blueprint")).toContain("font-family:Plex");
  });

  it("gives ไวต์บอร์ด นีออน บลูพริ้นท์ their own subtitle band", () => {
    expect(frame("board")).toContain(`background:${S.boardSub}`);
    expect(frame("neon")).toContain(`background:${S.neonSub}`);
    expect(frame("blueprint")).toContain(`background:${S.bpSub}`);
    for (const s of ["board", "neon", "blueprint"] as const) expect(frame(s), s).not.toContain("rgba(20,22,26,0.82)");
  });
});
