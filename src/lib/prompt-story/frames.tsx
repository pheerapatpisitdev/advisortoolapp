import { STORY_CLIP_COLORS } from "@/lib/card-theme";
import { abs, box } from "@/lib/quote-video/motion";
import { planName, termShort } from "@/lib/quote-video/story";
import { Note } from "@/lib/quote-video/story-knowledge-motion";
import { Subtitle, type StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES, type VideoSize } from "@/lib/quote-video/timeline";
import type { PromptScene, PromptStoryInput } from "./types";

/**
 * คลิปตามโจทย์'s scene: the screen words in the handwriting face over a soft paper band, subtitles as
 * in the other story clips, on a transparent frame. The scene's picture is not in the frame: it is
 * filed once as the scene's own layer, full bleed, and ffmpeg pushes it in (make.ts freeParts, job.ts
 * buildJob), so a frame is drawn only when a word lights up. A scene with no picture sits on the
 * paper base with its words centred. The figure card is drawn by the system, never by the painter,
 * on the scene marked `showFigure`.
 */

const C = STORY_CLIP_COLORS;
const HAND = "Mali";

/** the context a scene is drawn with: a story clip's, with a คลิปตามโจทย์ input */
export type FreeContext = Omit<StoryContext, "input"> & { input: PromptStoryInput };

/** where the words stand: top of the band, its side margin, the type size, and the figure card */
const GEO: Record<VideoSize, { top: number; side: number; size: number; note: { x: number; y: number; w: number }; text: number }> = {
  portrait: { top: 150, side: 60, size: 76, note: { x: 140, y: 1020, w: 800 }, text: 46 },
  square: { top: 50, side: 50, size: 60, note: { x: 420, y: 520, w: 610 }, text: 30 },
  landscape: { top: 50, side: 80, size: 66, note: { x: 1080, y: 440, w: 780 }, text: 36 },
};

/** nothing in a frame moves between words (the picture's push-in is ffmpeg's): one frame per word */
export const freeWindows = (): [number, number][] => [];

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

/**
 * Whether a scene shows the figure card, which takes the place of its words: the page shows the
 * agent "การ์ดเบี้ยจริง (ระบบวาด)" there, so no word they cannot see goes into the clip.
 */
const carded = (scene: PromptScene, input: PromptStoryInput) => Boolean(scene.showFigure && figureLines(input));

/** every letter the handwriting face is cut to: the title, each scene's words as drawn, and the figure card */
export function freeHandText(input: PromptStoryInput): string {
  return [input.title, ...input.scenes.filter((s) => !carded(s, input)).map((s) => s.screen), ...(figureLines(input) ?? []).map((l) => l.text), "0123456789,.·"].join("");
}

/** One frame of a scene at scene time t: the words over the scene's picture layer (`picture`), or over the paper. */
export function freeFrame(scene: PromptScene, picture: boolean, c: FreeContext, t: number) {
  const { w, h } = SIZES[c.size];
  const g = GEO[c.size];
  const card = carded(scene, c.input) ? figureLines(c.input) : null;
  // the drawing breaks Thai only at a space: a line with none is shrunk until it fits across
  const avail = w - g.side * 2 - 80;
  const len = [...scene.screen].length || 1;
  const size = scene.screen.includes(" ") ? g.size : Math.min(g.size, Math.floor(avail / (len * 0.52)));
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: "transparent", fontFamily: "Plex", overflow: "hidden" }}>
      {card ? null : (
        <div style={abs({ left: g.side, width: w - g.side * 2, top: picture ? g.top : Math.round(h * 0.36), justifyContent: "center" })}>
          <div style={box({ justifyContent: "center", textAlign: "center", background: picture ? "rgba(236,232,223,0.9)" : "transparent", borderRadius: 32, padding: picture ? "20px 36px" : "0 36px", maxWidth: w - g.side * 2, fontFamily: HAND, fontWeight: 600, fontSize: size, lineHeight: 1.2, color: C.ink })}>
            {scene.screen}
          </div>
        </div>
      )}
      {card ? <Note g={{ text: g.text }} r={{ x: g.note.x, y: g.note.y, w: g.note.w, h: 0 }} t={t} lines={card} /> : null}
      <Subtitle c={c as unknown as StoryContext} t={t} />
    </div>
  );
}
