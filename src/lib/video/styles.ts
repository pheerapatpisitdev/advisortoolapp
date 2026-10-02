import { CLIP_STYLE_COLORS, POSTER_THEMES } from "@/lib/card-theme";
import type { ClipStyle } from "@/lib/content/clip";
import type { Theme } from "@/lib/content/poster";
import { subtitleLines } from "./timeline";

/** satori does not wrap unspaced Thai, so lines are broken here; the preview and the render both use these. */
export const hookLines = (main: string): string[] => subtitleLines(main, 16);
export const subLines = (text: string): string[] => subtitleLines(text, 22);

export const STYLE_LABEL: Record<ClipStyle, string> = { box: "กล่องดำ", outline: "ตัวขาวขอบดำ", yellow: "เน้นเหลือง", page: "สีของเพจ" };

/**
 * Where the words sit and how big they are drawn, on the 1080×1920 frame the render makes
 * (owner's hand-cut clip, 2026-10-02): the render's pictures (overlays.tsx, render-run.ts) and
 * the editor's CSS preview read the same numbers, so what the agent sees is what goes up.
 */
export const FRAME = { width: 1080, height: 1920 };
export const SUB_SIZE = { width: 1080, height: 200 };
export const HOOK_SIZE = { width: 1080, height: 360 };
export const HOOK_Y = 230;
export const SUB_Y = 1450;
/** how long the hook stays, in seconds of the cut clip */
export const HOOK_SEC = 2.6;

/** a subtitle's font size: two lines fit at full size; more shrink to fit the 200px picture (box padding ~36 comes off first) */
export const subFontSize = (size: number, lines: number): number =>
  Math.max(40, Math.min(size, Math.floor((SUB_SIZE.height - 36) / (1.25 * lines))));

/** the hook's main font size: the picture is 360 tall; the top pill (~101 with its gap) and the main box's padding come off first */
export const hookMainSize = (lines: number, hasTop: boolean): number =>
  Math.max(40, Math.min(76, Math.floor((HOOK_SIZE.height - (hasTop ? 101 : 0) - 44 - 10) / (1.25 * lines))));

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
