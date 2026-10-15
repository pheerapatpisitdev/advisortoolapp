import type { StoryFigure } from "@/lib/quote-video/story";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { pictureSatang, type Prices } from "@/lib/wallet/prices";

export type PictureStyle = "cartoon" | "real" | "flat";

export type PromptScene = { voice: string; screen: string; picture: string; showFigure?: boolean };

/** a คลิปตามโจทย์: the agent's own brief turned into a script, pictures and a clip */
export interface PromptStoryInput {
  product: "FREESTORY";
  brief: string;
  title: string;
  caption: string;
  scenes: PromptScene[];
  style: PictureStyle;
  painter: "standard" | "sharp" | "gemini";
  size?: VideoSize;
  narrator?: "F" | "M";
  voice?: string;
  faces: { narrator: string };
  figure?: StoryFigure;
  pictures?: (string | null)[];
}

export const isPromptStory = (v: { product?: string }): v is PromptStoryInput => v.product === "FREESTORY";

/** the clip, a picture per scene, and the ElevenLabs extra when a voice is chosen */
export const promptStoryPrice = (v: PromptStoryInput, prices: Prices): number =>
  prices.videoStory + v.scenes.length * (pictureSatang(prices, v.painter) ?? 0) + (v.voice ? prices.elevenExtra : 0);
