import type { MotionContext } from "./motion";
import type { QuoteVideoFacts, SceneKey } from "./script";
import type { ThemeKey } from "./theme-keys";
import type { FestivalKey } from "./festival";
import type { MyColor } from "@/lib/card-theme";
import type { OverlayState, ScenePlan, TableMove, VideoSize } from "./timeline";
import type { CardChart } from "@/lib/quote-card";
import type { TableNote } from "./table-pen";
import type { Extra } from "./told";
import type { PromptStoryInput } from "@/lib/prompt-story/types";
import type { StoryVideoInput } from "./story";
import type { StoryContext } from "./story-motion";
import type { FhcSceneKey, FhcVideoFacts } from "./fhc";

/**
 * วิดีโอนำเสนอ's Motion Graphic clip drawn by Remotion (owner, 2026-10-17: "ต่อ Remotion เข้าแอปจริงเลย";
 * trial https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9). The project in remotion/ draws every
 * frame with motion.tsx and themes.tsx, at 30 a second, on Cloud Run — no frame is drawn on Vercel.
 * What it is given is this file's ClipProps: the very context the satori frames are drawn from
 * (quotePartsFor's motion), each scene's start and length, the voice and the cut-outs as links.
 *
 * Every clip is drawn this way since 2026-10-20 (owner: "ให้ใช้ Remotion ตลอดไปเลย ไม่ต้องมีสวิตช์", ข): วิดีโอนำเสนอ
 * in both looks and every size (QuoteMotion, ClassicClip), สรุป FHC (FhcClip), คลิปเล่าเรื่อง and คลิปตามโจทย์
 * (StoryClip). The old engine (satori frames on Vercel cut by ffmpeg) is gone.
 */

/**
 * The version of the drawing code a clip's props are made for: the image refuses props of another
 * (remotion/src/Root.tsx). tests/quote-video/remotion-drawing.test.ts says when it must change.
 */
export const REMOTION_DRAWING = "680ce86181c1";

/**
 * the Cloud Run job that renders them (remotion/cloudrun), started with the same key as clip-ffmpeg: one
 * job a drawing, built by the pre-push hook before the code that names it reaches main (remotion/cloudrun/ship.sh),
 * so the app as deployed and the job it starts always carry the same drawing (Remotion move phase 0, 2026-10-19)
 */
export const REMOTION_JOB = `remotion-${REMOTION_DRAWING}`;

/** what a Motion Graphic quote clip is drawn from, beside its scenes: quotePartsFor's own context */
export type RemotionMotion = {
  theme: ThemeKey;
  /** ธีมเทศกาล's festival and the greeting it shows (festival.ts); with theme "festival" only */
  festival?: { key: FestivalKey; greeting: string };
  /** สีของฉัน's colour (card-theme.ts MY_COLORS); with theme "mine" only */
  myColor?: MyColor;
  /** น้องโล่ in the corner (mascot.tsx) */
  mascot?: boolean;
  /** the next scene's figure carried over each join (carry.tsx) */
  carry?: boolean;
  /** the clip's shape: portrait draws motionFrame, square and landscape wideQuoteFrame (wide.tsx); none = portrait */
  size?: VideoSize;
  sex: "M" | "F";
  facts: QuoteVideoFacts;
  customer: string;
  narrator: "F" | "M";
  contact: MotionContext["contact"];
  /** priceJar: the price told as the piggy jar (motion.tsx PriceJar); coverRoad: the cover as the road of life (CoverRoad) */
  shown: { headline?: string[]; loop: boolean; extra: Extra; priceJar?: boolean; coverRoad?: boolean };
};

/** a type, not an interface: Remotion's props must fit Record<string, unknown> */
export type ClipProps = RemotionMotion & {
  /** REMOTION_DRAWING as the app had it */
  drawing: string;
  total: number;
  scenes: { key: SceneKey; voice: string; voiceSec: number; start: number; dur: number }[];
  /** the mixed narration: a link, or a file in the project's public folder */
  audio: string;
  /**
   * Chinese, Russian and Burmese: the Noto face the old engine draws them in (video-words.ts
   * SCRIPT_FAMILY), cut to the clip's letters, one file a weight: links, or files in the project's public folder
   */
  scriptFont?: { url: string; weight: number }[];
};

/**
 * คลิปเล่าเรื่อง and คลิปตามโจทย์ drawn by Remotion (the Remotion move, owner chose to do them first,
 * 2026-10-19): the composition StoryClip draws each scene with the app's own clipFrame / freeFrame
 * (story-frames.tsx, prompt-story/frames.tsx) over the paper, as the frames engine does; a คลิปตามโจทย์
 * scene's picture is pushed in 1.00 → 1.12 as buildJob's zoompan does.
 */
export type StoryClipProps = {
  composition: "StoryClip";
  /** REMOTION_DRAWING as the app had it */
  drawing: string;
  kind: "story" | "free";
  input: StoryVideoInput | PromptStoryInput;
  size: VideoSize;
  customer: string;
  narrator: "F" | "M";
  contact: StoryContext["contact"];
  total: number;
  /** each scene: its key, its words, where it stands, and a คลิปตามโจทย์ scene's picture (a link, or a file in the project's public folder) */
  scenes: { key: string; voice: string; voiceSec: number; start: number; dur: number; picture?: string }[];
  audio: string;
};

/** the props for a คลิปเล่าเรื่อง or คลิปตามโจทย์: its input and each scene's place, voice and picture (links) */
export function storyClipProps(
  input: StoryVideoInput | PromptStoryInput, size: VideoSize, customer: string, narrator: "F" | "M", contact: StoryContext["contact"],
  plans: { key: string; start: number; dur: number }[], script: { voice: string }[], secs: number[], total: number, audio: string,
  pictures: (string | undefined)[],
): StoryClipProps {
  return {
    composition: "StoryClip", drawing: REMOTION_DRAWING, kind: input.product === "FREESTORY" ? "free" : "story",
    input, size, customer, narrator, contact, total, audio,
    scenes: plans.map((p, i) => ({ key: p.key, voice: script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur, ...(pictures[i] ? { picture: pictures[i] } : {}) })),
  };
}

/**
 * An FHC summary drawn by Remotion (the composition FhcClip): fhcFrame / wideFhcFrame at the scene's time,
 * repainted by themed, over the theme's drifting ground.
 */
export type FhcClipProps = {
  composition: "FhcClip";
  drawing: string;
  size: VideoSize;
  theme: ThemeKey;
  /** ธีมเทศกาล's festival and the greeting it shows (festival.ts); with theme "festival" only */
  festival?: { key: FestivalKey; greeting: string };
  /** สีของฉัน's colour (card-theme.ts MY_COLORS); with theme "mine" only */
  myColor?: MyColor;
  /** น้องโล่ in the corner (mascot.tsx) */
  mascot?: boolean;
  facts: FhcVideoFacts;
  customer: string;
  narrator: "F" | "M";
  contact: MotionContext["contact"];
  total: number;
  scenes: { key: FhcSceneKey; voice: string; voiceSec: number; start: number; dur: number }[];
  audio: string;
};

/**
 * A แบบปกติ clip drawn by Remotion (the composition ClassicClip), as buildJob lays it in ffmpeg: each scene's base,
 * the family photo pushed in 1.00 → 1.12 or the value table moving down its window with its finished pen notes,
 * then the overlay frame of the moment (each held until the next, as the concat list holds it).
 */
export type ClassicClipProps = {
  composition: "ClassicClip";
  drawing: string;
  size: VideoSize;
  facts: QuoteVideoFacts;
  narrator: "F" | "M";
  customer: string;
  contact: MotionContext["contact"];
  chart?: CardChart;
  /** the value scene's pen notes (table-pen.tsx tablePlan); none for บำนาญ 95, whose table carries its own */
  notes?: (TableNote & { at: number })[];
  shown: { headline?: string[]; loop: boolean; extra: Extra };
  total: number;
  scenes: {
    key: SceneKey; voice: string; voiceSec: number; start: number; dur: number;
    frames: { t: number; state: OverlayState }[];
    layer?: "photo" | "table";
    table?: { moves: TableMove[]; shown: number[] };
  }[];
  audio: string;
  scriptFont?: { url: string; weight: number }[];
};

/**
 * The letters Plex has not got that the script faces carry: CJK and its punctuation, Cyrillic,
 * Myanmar. Clip.tsx gives the face these alone, so Thai, Latin and the figures stay in Plex, as in satori.
 */
export const SCRIPT_RANGE = [
  "U+0400-052F", "U+1C80-1C8F", "U+2DE0-2DFF", "U+A640-A69F", // Cyrillic
  "U+1000-109F", "U+A9E0-A9FF", "U+AA60-AA7F", // Myanmar
  "U+2E80-2FDF", "U+3000-303F", "U+3040-30FF", "U+3100-312F", "U+31C0-31EF", "U+3200-9FFF", "U+F900-FAFF", "U+FE30-FE4F", "U+FF00-FFEF", "U+20000-2FA1F", // CJK
].join(", ");


/** the props for one clip: its motion context, its scenes as planned, its voice */
export function clipProps(
  motion: RemotionMotion, plans: Pick<ScenePlan<SceneKey>, "key" | "start" | "dur">[], script: { voice: string }[],
  secs: number[], total: number, audio: string, scriptFont?: ClipProps["scriptFont"],
): ClipProps {
  return {
    ...motion, drawing: REMOTION_DRAWING, total, audio, ...(scriptFont?.length ? { scriptFont } : {}),
    scenes: plans.map((p, i) => ({ key: p.key, voice: script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur })),
  };
}
