import type { StoryFigure } from "@/lib/quote-video/story";
import type { VideoSize } from "@/lib/quote-video/timeline";
import { pictureSatang, type Prices } from "@/lib/wallet/prices";

/** a clip's title and one scene's words on the screen, in characters */
export const TITLE_MAX = 28;
export const SCREEN_MAX = 40;
/** a brief, in characters (owner, 2026-11-02: 600 → 10,000, a whole script may be pasted; mockup https://claude.ai/artifact/7kzsuHRkjEdnEVTXS9N5hs) */
export const BRIEF_MAX = 10_000;
/** how many scenes a script may be written in (owner, 2026-11-02: 10 and 12 added beside 3, 5, 8) */
export const SCENE_COUNTS = [3, 5, 8, 10, 12] as const;
export type SceneCount = (typeof SCENE_COUNTS)[number];
export const isSceneCount = (v: unknown): v is SceneCount => (SCENE_COUNTS as readonly unknown[]).includes(v);

/**
 * How a clip's pictures are painted. The four of คลิปเล่าเรื่อง's looks (owner, 2026-11-13, mockup
 * https://claude.ai/artifact/HHcQYn3umUREhMELrGQyKu) are on the form; "cartoon", "flat" and, on the owner's word
 * after seeing a picture of it the same day, "real" left it, and are kept for the clips made in them.
 */
export type PictureStyle = "paper" | "warm" | "plot" | "line" | "real" | "cartoon" | "flat";
/** the styles the form offers, in its order */
export const PICTURE_STYLES: { id: PictureStyle; name: string }[] = [
  { id: "paper", name: "สต็อปโมชันกระดาษ" }, { id: "warm", name: "ฉากกระดาษใต้แสงอุ่น" }, { id: "plot", name: "ปากกาพล็อตเตอร์" },
  { id: "line", name: "การ์ตูนลายเส้น" },
];

export type PromptScene = { voice: string; screen: string; picture: string; showFigure?: boolean };

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
  /** the written draft this clip was made from: a second press of the same draft is refused */
  draftId?: string;
  /** a picture redrawn and being cut in: its wallet hold, taken when the cut is done, given back if it fails */
  redraw?: { hold: string; satang: number; thb: number };
  /** who puts the clip together: Remotion (set by createVideo, never by the form; ดีไซน์พิเศษ by Shotstack removed 2026-11-11) */
  engine?: "remotion";
}

export const isPromptStory = (v: { product?: string }): v is PromptStoryInput => v.product === "FREESTORY";

/** one of the clip's pictures, at its painter's price (a redraw costs this) */
export const promptPicturePrice = (v: Pick<PromptStoryInput, "painter">, prices: Prices): number => pictureSatang(prices, v.painter) ?? 0;

/** every scene's picture */
export const promptPicturesPrice = (v: PromptStoryInput, prices: Prices): number => v.scenes.length * promptPicturePrice(v, prices);

/** what a free clip still pays from the wallet (spec, Money): its pictures */
export const promptFreePrice = (v: PromptStoryInput, prices: Prices): number => promptPicturesPrice(v, prices);

/** the clip, a picture per scene, and the ElevenLabs extra when a voice is chosen */
export const promptStoryPrice = (v: PromptStoryInput, prices: Prices): number =>
  prices.videoPrompt + promptPicturesPrice(v, prices) + (v.voice ? prices.elevenExtra : 0);
