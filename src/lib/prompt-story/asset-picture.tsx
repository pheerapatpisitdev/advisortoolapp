import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { drawPng } from "@/lib/draw-png";
import { cardFont, type DrawFont } from "@/lib/draw/fonts";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";
import { GROUNDS } from "@/lib/story/figure";
import type { freeLook } from "./frames";

/**
 * ภาพจากคลัง (คลังแอนิเมชัน phase 3, spec 2026-11-14-library-uploads, "Use in คลิปตามโจทย์"): a library part
 * laid in the middle of the frame on the ground of the clip's look and filed as the scene's picture, so it is
 * pushed in like any picture and keeps its own colours. Nothing else is drawn: the scene's words are the
 * frame's (frames.tsx freeFrame), and no figure is ever read from the part.
 */

const C = STORY_CLIP_COLORS;
/** the box the part is contained in, as shares of the frame */
const BOX = { w: 0.8, h: 0.55 };
// no words are drawn; satori is handed the app's face all the same
const FONTS: DrawFont[] = [{ name: "Plex", data: cardFont("IBMPlexSansThai-Regular.ttf"), weight: 400, style: "normal" }];

/**
 * The ground StoryClip paints behind a คลิปตามโจทย์ scene in this look (story-motion.tsx storyBackground):
 * สต็อปโมชันกระดาษ's kraft sheet, แสงอุ่น's stage, the plotter's sheet, การ์ตูนลายเส้น's clean ground, else paper.
 */
export function lookGround(look: ReturnType<typeof freeLook>): string {
  if (look.art === "paper") return C.kraft;
  if (look.art === "minimal" && look.ground === "warm") return GROUNDS.warm.bg;
  if (look.art === "plot") return C.plotPaper;
  if (look.art === "line") return C.lineGround;
  return C.paper;
}

/** the part (its bytes and type, uploads.ts uploadFile) contained in the middle 80% × 55% of a frame of `size` */
export async function assetPicture(part: { bytes: Buffer; type: string }, look: ReturnType<typeof freeLook>, size: VideoSize): Promise<Buffer> {
  const { w, h } = SIZES[size];
  const bw = Math.round(w * BOX.w);
  const bh = Math.round(h * BOX.h);
  const src = `data:${part.type};base64,${part.bytes.toString("base64")}`;
  return drawPng(
    <div style={{ display: "flex", width: w, height: h, alignItems: "center", justifyContent: "center", background: lookGround(look) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn by satori, never a page */}
      <img src={src} width={bw} height={bh} style={{ width: bw, height: bh, objectFit: "contain" }} alt="" />
    </div>,
    { width: w, height: h },
    FONTS,
  );
}
