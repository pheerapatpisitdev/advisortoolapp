import type { StoryFigure } from "@/lib/quote-video/story";
import type { VideoSize } from "@/lib/quote-video/timeline";
import type { DesignLook } from "@/lib/shotstack/looks";
import { pictureSatang, type Prices } from "@/lib/wallet/prices";

/** a clip's title and one scene's words on the screen, in characters */
export const TITLE_MAX = 28;
export const SCREEN_MAX = 40;
/** a brief, in characters */
export const BRIEF_MAX = 600;

export type PictureStyle = "cartoon" | "real" | "flat";

/** `move`: what moves in the picture, as the AI wrote it; `animate`: the scene's picture is made to move (ภาพขยับ) */
export type PromptScene = { voice: string; screen: string; picture: string; showFigure?: boolean; move?: string; animate?: boolean };

export const MOVE_MAX = 200;

/** a คลิปตามโจทย์: the agent's own brief turned into a script, pictures and a clip */
export interface PromptStoryInput {
  product: "FREESTORY";
  /** ลูกเล่นคลิปใหม่ (fx.ts): made with the music, the sounds and the new joins; the agent turned the music off */
  fx?: true;
  noMusic?: true;
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
  /** each animated scene's clip ("<id>/mov-<n>.mp4"), null where it was not made and the still picture stands */
  movies?: (string | null)[];
  /** how long each made clip runs, in seconds (its engine's: Kling 5, Hailuo 6), beside movies */
  movieSecs?: (number | null)[];
  /** the written draft this clip was made from: a second press of the same draft is refused */
  draftId?: string;
  /** a picture redrawn and being cut in: its wallet hold, taken when the cut is done, given back if it fails */
  redraw?: { hold: string; satang: number; thb: number };
  /**
   * ดีไซน์พิเศษ (owner, 2026-10-21): the clip put together by Shotstack in this look (shotstack/looks.ts);
   * none is the clip Remotion draws
   */
  design?: DesignLook;
  /** who puts the clip together: Remotion, or Shotstack for a ดีไซน์พิเศษ (set by createVideo, never by the form) */
  engine?: "remotion" | "shotstack";
}

export const isPromptStory = (v: { product?: string }): v is PromptStoryInput => v.product === "FREESTORY";

/** one of the clip's pictures, at its painter's price (a redraw costs this) */
export const promptPicturePrice = (v: Pick<PromptStoryInput, "painter">, prices: Prices): number => pictureSatang(prices, v.painter) ?? 0;

/** how many scenes are asked to move */
export const promptMotionCount = (v: Pick<PromptStoryInput, "scenes">): number => v.scenes.filter((s) => s.animate).length;

/** the moving scenes at the wallet's ภาพขยับ price (a scene with no picture has nothing to move: refunded in make.ts) */
export const promptMotionPrice = (v: Pick<PromptStoryInput, "scenes">, prices: Prices): number => promptMotionCount(v) * prices.motionScene;

/** every scene's picture and every moving scene: what a free clip still pays from the wallet */
export const promptPicturesPrice = (v: PromptStoryInput, prices: Prices): number =>
  v.scenes.length * promptPicturePrice(v, prices) + promptMotionPrice(v, prices);

/** ดีไซน์พิเศษ over the plain clip: what it adds to แบบเดิม's price, so a free clip still pays it */
export const promptDesignExtra = (v: Pick<PromptStoryInput, "design">, prices: Prices): number =>
  v.design ? Math.max(0, prices.videoPromptDesign - prices.videoPrompt) : 0;

/** what a free clip still pays from the wallet (spec, Money): its pictures, and ดีไซน์พิเศษ's extra */
export const promptFreePrice = (v: PromptStoryInput, prices: Prices): number => promptPicturesPrice(v, prices) + promptDesignExtra(v, prices);

/** the clip (ดีไซน์พิเศษ's own price when chosen), a picture per scene, and the ElevenLabs extra when a voice is chosen */
export const promptStoryPrice = (v: PromptStoryInput, prices: Prices): number =>
  prices.videoPrompt + promptDesignExtra(v, prices) + promptPicturesPrice(v, prices) + (v.voice ? prices.elevenExtra : 0);
