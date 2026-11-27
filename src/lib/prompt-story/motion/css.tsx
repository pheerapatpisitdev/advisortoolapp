import type { CSSProperties } from "react";
import type { Rect } from "./geo";

/**
 * The style helpers of quote-video/motion.tsx (`abs`, `box`), kept here rather than imported: motion.tsx pulls every
 * plan's rate tables (about 8 MB) after it, and these drawings also run in the editor's preview in the browser.
 * Each box says its own display, position and box sizing, as Remotion's `.sat` rule does, so the preview, which has
 * no such rule, lays them out the same.
 */

export const PROMPT = "Prompt";

export const abs = (s: CSSProperties): CSSProperties => ({ display: "flex", position: "absolute", boxSizing: "border-box", ...s });
export const box = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", position: "relative", boxSizing: "border-box", ...s });
/** a box's place in the frame */
export const place = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });

/** one of the palette's colours (#rrggbb or rgba) at another opacity: the blobs, shadows and scrims are its own */
export function alpha(color: string, a: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return rgb ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${a})` : color;
}

/** a picture filling its box (the existing frames draw theirs as a plain img too) */
export function Pic({ src, style }: { src: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}
