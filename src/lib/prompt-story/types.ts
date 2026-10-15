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
  /** each scene's picture in the clip's folder ("<id>/pic-<n>.png", n from 0), null where it fell back to paper */
  pictures?: (string | null)[];
  /** the written draft this clip was made from: a second press of the same draft is refused */
  draftId?: string;
}

export const isPromptStory = (v: { product?: string }): v is PromptStoryInput => v.product === "FREESTORY";

/** one of the clip's pictures, at its painter's price (a redraw costs this) */
export const promptPicturePrice = (v: Pick<PromptStoryInput, "painter">, prices: Prices): number => pictureSatang(prices, v.painter) ?? 0;

/** every scene's picture: what a free clip still pays from the wallet */
export const promptPicturesPrice = (v: PromptStoryInput, prices: Prices): number => v.scenes.length * promptPicturePrice(v, prices);

/** the clip, a picture per scene, and the ElevenLabs extra when a voice is chosen */
export const promptStoryPrice = (v: PromptStoryInput, prices: Prices): number =>
  prices.videoStory + promptPicturesPrice(v, prices) + (v.voice ? prices.elevenExtra : 0);
