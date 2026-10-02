import { CLIP_STYLE_COLORS, POSTER_THEMES } from "@/lib/card-theme";
import type { ClipStyle } from "@/lib/content/clip";
import type { Theme } from "@/lib/content/poster";
import { subtitleLines } from "./timeline";

/** satori does not wrap unspaced Thai, so lines are broken here; the preview and the render both use these. */
export const hookLines = (main: string): string[] => subtitleLines(main, 16);
export const subLines = (text: string): string[] => subtitleLines(text, 22);

/**
 * The four looks of words on a clip (owner, 2026-10-02), defined once: the editor's preview
 * draws them in CSS, the render draws them with satori, from these same numbers.
 * Browser-safe: no server-only imports here.
 */
export interface StyleLook {
  box: { background: string; color: string; borderRadius: number; padding: string } | null;
  color: string;
  /** a text outline (satori and CSS -webkit-text-stroke), for the style with no box */
  stroke: string | null;
  fontSize: number;
  hookTopBg: string;
  hookTopInk: string;
  hookMainBg: string;
  hookMainInk: string;
}

export function styleLook(style: ClipStyle, theme: Theme = "navy"): StyleLook {
  if (style === "page") {
    const c = POSTER_THEMES[theme] ?? POSTER_THEMES.navy;
    return { box: { background: c.from, color: c.headline, borderRadius: 22, padding: "18px 34px" }, color: c.headline, stroke: null, fontSize: 64, hookTopBg: c.badgeBg, hookTopInk: c.badgeInk, hookMainBg: c.from, hookMainInk: c.headline };
  }
  const c = CLIP_STYLE_COLORS[style] ?? CLIP_STYLE_COLORS.box;
  const rest = { color: c.color, stroke: c.stroke, hookTopBg: c.hookTopBg, hookTopInk: c.hookTopInk, hookMainBg: c.hookMainBg, hookMainInk: c.hookMainInk };
  switch (style) {
    case "outline":
      return { box: null, fontSize: 70, ...rest };
    case "yellow":
      return { box: { background: c.boxBg ?? c.hookMainBg, color: c.color, borderRadius: 18, padding: "16px 30px" }, fontSize: 64, ...rest };
    case "box":
    default:
      return { box: { background: c.boxBg ?? c.hookMainBg, color: c.color, borderRadius: 22, padding: "18px 34px" }, fontSize: 64, ...rest };
  }
}
