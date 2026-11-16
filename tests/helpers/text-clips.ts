import { isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * Every run of words or figures in a drawn scene, with whether anything above it clips it (a write-in sweep's clipPath
 * or an overflow cut). A word or figure is shown whole or not at all (owner chose ก, 2026-11-16): none may be clipped.
 * Words painted clear (the pen's layer of a piece, whose words fade in over it) are not seen, so not counted.
 */
export function textClips(node: ReactNode, clipped = false, out: { text: string; clipped: boolean }[] = []): { text: string; clipped: boolean }[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (Array.isArray(node)) { for (const x of node) textClips(x, clipped, out); return out; }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<{ style?: Record<string, unknown>; children?: ReactNode }>;
  if (typeof el.type === "function") return textClips((el.type as (p: unknown) => ReactNode)(el.props), clipped, out);
  const style = el.props.style ?? {};
  const here = clipped || (style.clipPath !== undefined && style.clipPath !== "none") || style.overflow === "hidden";
  const kids = el.props.children;
  const mine = (Array.isArray(kids) ? kids : [kids]).filter((k) => typeof k === "string" || typeof k === "number").join("").trim();
  if (mine && style.color !== "rgba(0,0,0,0)") out.push({ text: mine, clipped: here });
  textClips(kids, here, out);
  return out;
}
