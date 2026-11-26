import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { deviceBody, freeLook, type FreeContext } from "@/lib/prompt-story/frames";
import { PICTURE_STYLES, type DeviceScene, type PromptStoryInput } from "@/lib/prompt-story/types";
import { lookGround } from "@/lib/prompt-story/asset-picture";
import { kitFor } from "@/lib/quote-video/story-kits";
import { storyBackground } from "@/lib/quote-video/story-motion";
import type { StoryVideoInput } from "@/lib/quote-video/story";
import { STORY_CLIP_COLORS as S } from "@/lib/card-theme";

/** โมชันกราฟิก's colours, Prompt font and device Kit (owner, 2026-11-26) */
const scene = { voice: "ทดสอบ เสียง", screen: "วงเงินต่อปี", picture: "" };
const input = (style: PromptStoryInput["style"], design?: "motion") =>
  ({ product: "FREESTORY", brief: "x", title: "t", caption: "", scenes: [scene], style, painter: "sharp", faces: { narrator: "m03" }, ...(design ? { design } : {}) }) as PromptStoryInput;
const ctx = (i: PromptStoryInput): FreeContext => ({ input: i, size: "portrait", customer: "", narrator: "F", contact: { name: "ก", phone: "081" }, crowd: [], faces: {}, words: ["ทดสอบ", "เสียง"], voiceSec: 2 });
const limit: DeviceScene = { layout: "limit", title: ["วงเงิน", "ต่อปี"], limit: 1000000, used: 60000, planName: "Gold" };

describe("โมชันกราฟิก's look", () => {
  it("has the colours the brief lists", () => {
    expect(S).toMatchObject({ mgNavy: "#06235f", mgNavy2: "#0d3a8c", mgCream: "#fbf6ec", mgGold: "#f2c75c", mgCoral: "#e4572e", mgRed: "#c2412d", mgTeal: "#2f9c97", mgInk: "#1d2433", mgGrey: "#e6dfd2", mgMute: "#8a8f9c", mgScrim: "rgba(6,14,36,0.78)", mgDot: "rgba(6,35,95,0.09)" });
  });

  it("has a Kit written in Prompt", () => {
    const k = kitFor({ art: "motion" });
    expect(k.hand).toBe("Prompt");
    expect(k.page).toBe(S.mgNavy);
    expect(k.bold).toBe(600);
    expect(k.reveal).toBe("fade");
    expect(k.glow).toBe(false);
    expect(k.machine).toBe(false);
    expect(k.dress?.band).toBe(S.mgScrim);
    expect(k.dress?.spoken).toBe(S.mgGold);
    expect(k.card).toBe(S.mgCream);
  });

  it("freeLook is motion whatever the style when design is motion, and today's otherwise", () => {
    for (const style of ["paper", "warm", "plot", "line", "board", "neon", "blueprint", "real"] as const) expect(freeLook({ style, design: "motion" })).toEqual({ art: "motion" });
    expect(freeLook({ style: "paper" })).toEqual({ art: "paper" });
    expect(freeLook({ style: "warm" })).toEqual({ art: "minimal", ground: "warm" });
    for (const { id } of PICTURE_STYLES) {
      expect(freeLook({ style: id }), id).toEqual(freeLook({ style: id, design: undefined }));
    }
  });

  it("draws the navy gradient ground, not the blueprint's", () => {
    const html = renderToStaticMarkup(storyBackground("portrait", { art: "motion" } as StoryVideoInput));
    expect(html).toContain("#06235f");
    expect(html).toContain("#0d3a8c");
    expect(html).not.toContain("#1f5aa6");
  });

  it("lays library parts on the navy", () => {
    expect(lookGround({ art: "motion" })).toBe(S.mgNavy);
  });

  it("draws a device in Prompt", () => {
    const html = renderToStaticMarkup(deviceBody(limit, ctx(input("paper", "motion")), 1));
    expect(html).toContain("font-family:Prompt");
    const plain = renderToStaticMarkup(deviceBody(limit, ctx(input("paper")), 1));
    expect(plain).not.toContain("font-family:Prompt");
  });
});
