import { describe, expect, it } from "vitest";
import { isPromptStory, promptStoryPrice, type PromptStoryInput } from "@/lib/prompt-story/types";
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
