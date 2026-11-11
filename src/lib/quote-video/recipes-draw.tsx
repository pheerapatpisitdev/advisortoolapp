import type { ReactNode } from "react";
import type { RecipeKey } from "./recipes";
import type { RecipeClip } from "./recipe-blocks";
import { askFrame } from "./recipe-ask";
import { lifeFrame } from "./recipe-life";
import { versusFrame } from "./recipe-versus";

/**
 * สูตรคลิป Motion as Remotion draws them (owner, 2026-11-11, mockup https://claude.ai/artifact/2yaTZU2RVFVmMn9VNi9K88,
 * ก ก ก): the one place remotion/src/Clip.tsx asks for a recipe's scene and how its scenes join, so the
 * composition never names the three frame files itself.
 */

const FRAMES: Record<RecipeKey, typeof askFrame> = { ask: askFrame, life: lifeFrame, versus: versusFrame };

/** scene `index` of the recipe at scene time t (clip time T), w × h px */
export function recipeFrame(key: RecipeKey, c: RecipeClip, index: number, t: number, T: number, w: number, h: number): ReactNode {
  return FRAMES[key](c, index, t, T, w, h);
}

/**
 * how scene `index` comes in over XFADE: ask a hard cut, life a cross-fade, versus slideleft (Clip.tsx
 * crossing kinds; "cut" = no style on either scene). The poster's swaps of ground and ink land as cuts;
 * the life line flows on; the sheet turns like a page.
 */
const JOINS: Record<RecipeKey, "cut" | "fade" | "slideleft"> = { ask: "cut", life: "fade", versus: "slideleft" };
export const recipeJoin = (key: RecipeKey): "cut" | "fade" | "slideleft" => JOINS[key];
