import { POSTER_THEMES } from "@/lib/card-theme";
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
  switch (style) {
    case "outline":
      return { box: null, color: "#ffffff", stroke: "6px #000000", fontSize: 70, hookTopBg: "#ffffff", hookTopInk: "#111111", hookMainBg: "rgba(0,0,0,0)", hookMainInk: "#ffffff" };
    case "yellow":
      return { box: { background: "#facc15", color: "#111111", borderRadius: 18, padding: "16px 30px" }, color: "#111111", stroke: null, fontSize: 64, hookTopBg: "#111111", hookTopInk: "#facc15", hookMainBg: "#facc15", hookMainInk: "#111111" };
    case "page": {
      const c = POSTER_THEMES[theme] ?? POSTER_THEMES.navy;
      return { box: { background: c.from, color: c.headline, borderRadius: 22, padding: "18px 34px" }, color: c.headline, stroke: null, fontSize: 64, hookTopBg: c.badgeBg, hookTopInk: c.badgeInk, hookMainBg: c.from, hookMainInk: c.headline };
    }
    case "box":
    default:
      return { box: { background: "rgba(0,0,0,0.62)", color: "#ffffff", borderRadius: 22, padding: "18px 34px" }, color: "#ffffff", stroke: null, fontSize: 64, hookTopBg: "#facc15", hookTopInk: "#111111", hookMainBg: "rgba(17,24,39,0.88)", hookMainInk: "#ffffff" };
  }
}
