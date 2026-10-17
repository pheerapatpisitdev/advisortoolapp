import type { StoryFigure } from "@/lib/quote-video/story";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { pictureSatang, type Prices } from "@/lib/wallet/prices";

/** a clip's title and one scene's words on the screen, in characters */
export const TITLE_MAX = 28;
export const SCREEN_MAX = 40;
/** a brief, in characters */
export const BRIEF_MAX = 600;

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
  /** one of Gemini's 30 voices by name (owner, 2026-10-17); none = the narrator's own, Kore or Orus */
  gemini?: string;
  faces: { narrator: string };
  figure?: StoryFigure;
  /** each scene's picture in the clip's folder ("<id>/pic-<n>.png", n from 0), null where it fell back to paper */
  pictures?: (string | null)[];
  /** the written draft this clip was made from: a second press of the same draft is refused */
  draftId?: string;
  /** a picture redrawn and being cut in: its wallet hold, taken when the cut is done, given back if it fails */
  redraw?: { hold: string; satang: number; thb: number };
}

export const isPromptStory = (v: { product?: string }): v is PromptStoryInput => v.product === "FREESTORY";

/** one of the clip's pictures, at its painter's price (a redraw costs this) */
export const promptPicturePrice = (v: Pick<PromptStoryInput, "painter">, prices: Prices): number => pictureSatang(prices, v.painter) ?? 0;

/** every scene's picture: what a free clip still pays from the wallet */
export const promptPicturesPrice = (v: PromptStoryInput, prices: Prices): number => v.scenes.length * promptPicturePrice(v, prices);

/** the clip, a picture per scene, and the ElevenLabs extra when a voice is chosen */
export const promptStoryPrice = (v: PromptStoryInput, prices: Prices): number =>
  prices.videoPrompt + promptPicturesPrice(v, prices) + (v.voice ? prices.elevenExtra : 0);
