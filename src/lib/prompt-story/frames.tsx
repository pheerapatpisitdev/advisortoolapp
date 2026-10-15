import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { abs, box } from "@/lib/quote-video/motion";
import { planName, termShort } from "@/lib/quote-video/story";
import { Note } from "@/lib/quote-video/story-knowledge-motion";
import { Subtitle, type StoryContext } from "@/lib/quote-video/story-motion";
import { LEAD, SIZES, TAIL, type VideoSize } from "@/lib/quote-video/timeline";
import { FACE_PAPER } from "@/lib/story/faces";
import type { PromptScene, PromptStoryInput } from "./types";

/**
 * คลิปตามโจทย์'s scene: the scene's picture full bleed with a slow push-in, the screen words in the
 * handwriting face over a soft paper band, subtitles as in the other story clips. A scene with no
 * picture is the paper with the words only. The figure card is drawn by the system, never by the
 * painter, on the scene marked `showFigure`. No I/O: pictures arrive as data URIs.
 */

const C = STORY_CLIP_COLORS;
const HAND = "Mali";
/** how far the picture grows over the scene */
const PUSH = 0.06;

/** the context a scene is drawn with: a story clip's, with a คลิปตามโจทย์ input */
export type FreeContext = Omit<StoryContext, "input"> & { input: PromptStoryInput };

/** where the words stand: top of the band, its side margin, the type size, and the figure card */
const GEO: Record<VideoSize, { top: number; side: number; size: number; note: { x: number; y: number; w: number }; text: number }> = {
  portrait: { top: 150, side: 60, size: 76, note: { x: 140, y: 1020, w: 800 }, text: 46 },
  square: { top: 50, side: 50, size: 60, note: { x: 420, y: 520, w: 610 }, text: 30 },
  landscape: { top: 50, side: 80, size: 66, note: { x: 1080, y: 440, w: 780 }, text: 36 },
};

/** the one window the picture moves in; frames past the scene's end are dropped by the planner */
export const freeWindows = (): [number, number][] => [[0, 20]];

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const sumWord = (v: number) => (v >= 1_000_000 && v % 100_000 === 0 ? `${(v / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} ล้าน` : n(v));

/** the figure card's lines, from the plan the agent chose */
export function figureLines(input: PromptStoryInput) {
  const f = input.figure;
  if (!f) return null;
  return [
    { text: `${f.sex === "F" ? "หญิง" : "ชาย"} ${f.age} ปี · ทุน ${sumWord(f.sumAssured)}`, big: true },
    { text: `เบี้ยปีละ ${n(f.annual)} บาท` },
    { text: `${planName(f.plan)} ${termShort(f)}` },
  ];
}

/** every letter the handwriting face is cut to: the title, each scene's words and the figure card */
export function freeHandText(input: PromptStoryInput): string {
  return [input.title, ...input.scenes.map((s) => s.screen), ...(figureLines(input) ?? []).map((l) => l.text), "0123456789,.·"].join("");
}

/** One frame of a scene at scene time t: the picture (or the paper) and the words; transparent otherwise. */
export function freeFrame(scene: PromptScene, picture: string | null, c: FreeContext, t: number) {
  const { w, h } = SIZES[c.size];
  const g = GEO[c.size];
  const p = Math.min(1, Math.max(0, t / (LEAD + c.voiceSec + TAIL)));
  const scale = 1 + PUSH * p;
  const card = scene.showFigure ? figureLines(c.input) : null;
  // the drawing breaks Thai only at a space: a line with none is shrunk until it fits across
  const avail = w - g.side * 2 - 80;
  const len = [...scene.screen].length || 1;
  const size = scene.screen.includes(" ") ? g.size : Math.min(g.size, Math.floor(avail / (len * 0.52)));
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: picture ? "transparent" : FACE_PAPER, fontFamily: "Plex", overflow: "hidden" }}>
      {picture ? (
        <div style={abs({ left: 0, top: 0, width: w, height: h, overflow: "hidden" })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture} width={w} height={h} style={{ width: w, height: h, objectFit: "cover", transform: `scale(${scale.toFixed(4)})` }} alt="" />
        </div>
      ) : null}
      <div style={abs({ left: g.side, width: w - g.side * 2, top: picture ? g.top : Math.round(h * 0.36), justifyContent: "center" })}>
        <div style={box({ justifyContent: "center", textAlign: "center", background: picture ? "rgba(236,232,223,0.9)" : "transparent", borderRadius: 32, padding: picture ? "20px 36px" : "0 36px", maxWidth: w - g.side * 2, fontFamily: HAND, fontWeight: 600, fontSize: size, lineHeight: 1.2, color: C.ink })}>
          {scene.screen}
        </div>
      </div>
      {card ? <Note g={{ text: g.text }} r={{ x: g.note.x, y: g.note.y, w: g.note.w, h: 0 }} t={t} lines={card} /> : null}
      <Subtitle c={c as unknown as StoryContext} t={t} />
    </div>
  );
}
