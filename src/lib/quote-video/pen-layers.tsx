import type React from "react";
import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * Words and figures are never written in part (owner chose ก, 2026-11-16): a pen sweeping across "1,800,000" shows
 * "1,8" for a moment. A piece holding text is laid twice in the same place: its lines, frames, bars and icons (the words
 * in it made clear) written in by the pen, and over them its words and figures alone (every ground, edge and icon made
 * clear), fading in whole over the same moments. Used by the story looks that write (story-info-motion.tsx E) and by
 * วิดีโอนำเสนอ's ไวท์บอร์ด marker (themes.tsx, after its repaint; owner chose ก again, 2026-11-16).
 */

/** where a piece stands, kept on the place around its two layers */
export const PLACE = ["position", "left", "top", "right", "bottom", "width", "height", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "alignSelf", "flex", "flexGrow", "flexShrink", "zIndex"] as const;
const CLEAR = "rgba(0,0,0,0)";

/** whether a piece holds any word or figure, through the drawers' own parts (they are plain functions of their props) */
export function holdsText(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return false;
  if (typeof node === "string") return node.trim() !== "";
  if (typeof node === "number" || typeof node === "bigint") return true;
  if (Array.isArray(node)) return node.some(holdsText);
  if (!isValidElement(node)) return false;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function") return holdsText((el.type as (p: unknown) => ReactNode)(el.props));
  return holdsText(el.props.children);
}

/** whether words or figures stand directly in an element (not in one inside it) */
export const ownText = (kids: ReactNode) => (Array.isArray(kids) ? kids : [kids]).some((k) => (typeof k === "string" && k.trim() !== "") || typeof k === "number");

/** a style with its ground, edges and shadow made clear: what is left is its words (its layout unchanged) */
export function clearOf(style: React.CSSProperties): React.CSSProperties {
  const out: Record<string, unknown> = { ...style };
  for (const [k, v] of Object.entries(style)) {
    if (/^border(Top|Right|Bottom|Left)?$/.test(k) && typeof v === "string" && !/^(none|0)$/.test(v.trim())) {
      const [w, how] = v.trim().split(/\s+/);
      out[k] = `${w} ${how ?? "solid"} ${CLEAR}`;
    }
    if (/^border(Top|Right|Bottom|Left)?Color$/.test(k)) out[k] = CLEAR;
  }
  if ("background" in out) out.background = CLEAR;
  if ("backgroundColor" in out) out.backgroundColor = CLEAR;
  delete out.backgroundImage;
  if ("boxShadow" in out) out.boxShadow = "none";
  return out as React.CSSProperties;
}

/** a style with its own words made clear: what is left is its ground and edges */
export function mute(style: React.CSSProperties): React.CSSProperties {
  const out: Record<string, unknown> = { ...style, color: CLEAR };
  if ("textShadow" in out) out.textShadow = "none";
  delete out.WebkitTextStroke;
  return out as React.CSSProperties;
}

/**
 * The same piece with only its lines and edges showing ("lines"), or only its words and figures ("words"): each element
 * kept where it is, only its paint changed, so the two lie exactly over each other. In the words, a drawing (svg) is an
 * empty box of its size, and no element carries a data- mark twice.
 */
export function layer(node: ReactNode, keep: "lines" | "words"): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map((x) => layer(x, keep));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown> & { style?: React.CSSProperties; children?: ReactNode }>;
  if (el.type === Fragment) return cloneElement(el, { children: layer(el.props.children, keep) });
  if (typeof el.type === "function") return layer((el.type as (p: unknown) => ReactNode)(el.props), keep);
  const style = el.props.style ?? {};
  if (el.type !== "div" && el.type !== "span") {
    if (keep === "lines") return el;
    return <div key={el.key ?? undefined} style={{ ...style, display: "flex", flexShrink: 0, width: el.props.width as number, height: el.props.height as number }} />;
  }
  const kids = el.props.children;
  const own = ownText(kids);
  const marks = keep === "words" ? Object.fromEntries(Object.keys(el.props).filter((k) => k.startsWith("data-")).map((k) => [k, undefined])) : {};
  return cloneElement(el, { ...marks, style: keep === "words" ? clearOf(style) : own ? mute(style) : style, children: layer(kids, keep) });
}
