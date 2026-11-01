import type { DrawFont } from "@/lib/draw/fonts";

/**
 * The shapes a picture travels to the draw service in, and the service's side of reading them
 * (the app's side, from a React element: tree.ts). No React here: the service never has it.
 */

export type Tree = string | number | null | Tree[] | { type: string; props: Record<string, unknown> };
/** the one key of an object standing for bytes, as base64 */
export const BYTES = "$bytes";
/**
 * A fragment's type. satori does not flatten a fragment the way React would: it lays it out as
 * a box of its own (a row, like a div with no style) everywhere but inside an <svg>, so the
 * fragment has to arrive as one, as React's own symbol.
 */
export const FRAGMENT = "$fragment";

/** the tree back, its bytes as buffers again (the service's side) */
export function fromTree(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(fromTree);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.type === FRAGMENT && o.props && typeof o.props === "object") {
      return { type: Symbol.for("react.fragment"), props: fromTree(o.props) };
    }
    if (typeof o[BYTES] === "string" && Object.keys(o).length === 1) {
      const b = Buffer.from(o[BYTES] as string, "base64");
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, fromTree(x)]));
  }
  return v;
}

/** a face as JSON: a shipped one by its file name, a fetched one as its bytes */
export type WireFont = Omit<DrawFont, "data"> & ({ file: string } | { bytes: string });

export function fromWireFonts(fonts: WireFont[]): DrawFont[] {
  return fonts.map((f) => {
    if ("file" in f) {
      const { file, ...rest } = f;
      return { ...rest, data: { file } };
    }
    const { bytes, ...rest } = f;
    const b = Buffer.from(bytes, "base64");
    return { ...rest, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  });
}
