import { describe, expect, it } from "vitest";
import { isPromptStory, promptMotionCount, promptMotionPrice, promptPicturesPrice, promptStoryPrice, type PromptStoryInput } from "@/lib/prompt-story/types";
import { videoPrice } from "@/lib/quote-video/make";
import { clipKind } from "@/lib/quote-video/progress";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

const scene = { voice: "v", screen: "s", picture: "p" };
const input = (extra: Partial<PromptStoryInput> = {}): PromptStoryInput => ({
  product: "FREESTORY", brief: "b", title: "t", caption: "c",
  scenes: [scene, scene, scene, scene, scene], style: "cartoon", painter: "standard",
  faces: { narrator: "F" }, ...extra,
});

describe("prompt story input", () => {
  it("guards on the product", () => {
    expect(isPromptStory({ product: "FREESTORY" })).toBe(true);
    expect(isPromptStory({ product: "STORY" })).toBe(false);
  });
  it("prices the clip plus a picture per scene", () => {
    expect(promptStoryPrice(input(), DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoPrompt + 5 * DEFAULT_PRICES.drawStandard);
  });
  it("adds the ElevenLabs extra with a voice", () => {
    expect(promptStoryPrice(input({ voice: "x" }), DEFAULT_PRICES)).toBe(
      DEFAULT_PRICES.videoPrompt + 5 * DEFAULT_PRICES.drawStandard + DEFAULT_PRICES.elevenExtra);
  });
  it("videoPrice agrees", () => {
    expect(videoPrice(input({ voice: "x" }), DEFAULT_PRICES)).toBe(promptStoryPrice(input({ voice: "x" }), DEFAULT_PRICES));
  });
  it("is a story clip kind", () => {
    expect(clipKind({ product: "FREESTORY" })).toBe("story");
  });
});

describe("ภาพขยับ price (owner, 2026-10-17)", () => {
  const scenes = (flags: boolean[]) => flags.map((animate) => ({ voice: "v", screen: "s", picture: "p", ...(animate ? { animate } : {}) }));

  it("counts the moving scenes at the wallet's ฿15 each, on top of the clip and the pictures", () => {
    const v = { scenes: scenes([true, false, true]), painter: "standard" } as never;
    expect(promptMotionCount(v)).toBe(2);
    expect(promptMotionPrice(v, DEFAULT_PRICES)).toBe(2 * DEFAULT_PRICES.motionScene);
    expect(promptStoryPrice(v, DEFAULT_PRICES)).toBe(DEFAULT_PRICES.videoPrompt + 3 * DEFAULT_PRICES.drawStandard + 2 * DEFAULT_PRICES.motionScene);
  });

  it("is in what a free clip still pays", () => {
    const v = { scenes: scenes([true, true]), painter: "standard" } as never;
    expect(promptPicturesPrice(v, DEFAULT_PRICES)).toBe(2 * DEFAULT_PRICES.drawStandard + 2 * DEFAULT_PRICES.motionScene);
  });

  it("is zero when no scene moves", () => {
    expect(promptMotionPrice({ scenes: scenes([false, false]) }, DEFAULT_PRICES)).toBe(0);
  });
});
