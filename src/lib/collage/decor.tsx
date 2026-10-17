import type { ReactNode } from "react";
import sharp from "sharp";

/**
 * A library cut-out laid in a scene of any clip that is not วิดีโอนำเสนอ's (owner chose ก, 2026-10-17,
 * mockup https://claude.ai/artifact/RcQRD93uywHi12PhSWVGbH): it pops in, stop-motion, into the room
 * the scene leaves free, and wobbles six times a second as the paper does (themes.tsx collageDecor).
 */

export interface Sticker { uri: string; w: number; h: number }
/** where a picture may stand in a scene, in frame pixels; it sits on the room's floor, centred */
export interface Room { left: number; top: number; w: number; h: number }

/** when a scene's picture pops in, in scene seconds: after what the scene first shows */
export const DECOR_AT = 1.4;

export async function stickerOf(png: Buffer): Promise<Sticker> {
  const m = await sharp(png).metadata();
  return { uri: `data:image/png;base64,${png.toString("base64")}`, w: m.width ?? 1, h: m.height ?? 1 };
}

/** the picture at scene time t: nothing before it pops in */
export function stickerAt(st: Sticker, room: Room, t: number, at = DECOR_AT, i = 0): ReactNode {
  if (t < at) return null;
  const k = Math.min(room.w / st.w, room.h / st.h);
  const w = Math.round(st.w * k), h = Math.round(st.h * k);
  // pop: big, a touch past, then settled; after that the paper wobble six times a second
  const since = t - at;
  const scale = since < 1 / 12 ? 0.45 : since < 2 / 12 ? 0.85 : since < 3 / 12 ? 1.08 : 1;
  const tilt = (((i * 7 + Math.floor(t * 6)) % 3) - 1) * 0.9 + (i % 2 ? 1.5 : -1.5);
  return (
    <div key={`decor-${i}`} style={{ display: "flex", position: "absolute", left: room.left + Math.round((room.w - w) / 2), top: room.top + room.h - h, width: w, height: h, transform: `rotate(${tilt.toFixed(2)}deg) scale(${scale})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={st.uri} width={w} height={h} style={{ width: w, height: h }} alt="" />
    </div>
  );
}
