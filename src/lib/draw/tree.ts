import { Fragment, isValidElement, type ReactNode } from "react";
import { isFontFile, type DrawFont } from "@/lib/draw/fonts";
import { BYTES, FRAGMENT, type Tree, type WireFont } from "@/lib/draw/wire";

/**
 * A picture's element, sent to the draw service as JSON.
 *
 * satori reads only host elements — div, img, svg and their props — and fragments, and calls a
 * function component itself to get to them. Calling them here instead, the same way, leaves a
 * plain { type, props } tree that satori draws exactly as it draws the element, and that
 * survives JSON. Bytes (a photo handed over as a buffer, a fetched face) travel as base64.
 */

function encodeValue(v: unknown): unknown {
  if (v instanceof ArrayBuffer) return { [BYTES]: Buffer.from(v).toString("base64") };
  if (ArrayBuffer.isView(v)) return { [BYTES]: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x)]));
  return v;
}

export function toTree(node: ReactNode): Tree {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (typeof node === "string" || typeof node === "number") return node;
  if (typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(toTree);
  if (isValidElement(node)) {
    const { type } = node;
    const props = (node.props ?? {}) as Record<string, unknown> & { children?: ReactNode };
    // kept as a box, as satori lays it out (wire.ts)
    if (type === Fragment) return { type: FRAGMENT, props: { children: toTree(props.children) } };
    if (typeof type === "function") return toTree((type as (p: unknown) => ReactNode)(props));
    if (typeof type !== "string") throw new Error("draw: only host elements and function components can be drawn");
    const { children, ...rest } = props;
    return { type, props: { ...(encodeValue(rest) as Record<string, unknown>), children: toTree(children) } };
  }
  if (typeof node === "object" && Symbol.iterator in node) return [...(node as Iterable<ReactNode>)].map(toTree);
  throw new Error("draw: a promise or object cannot be drawn");
}

export function toWireFonts(fonts: DrawFont[]): WireFont[] {
  return fonts.map(({ data, ...f }) => (isFontFile(data)
    ? { ...f, file: data.file }
    : { ...f, bytes: (data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength)).toString("base64") }));
}
