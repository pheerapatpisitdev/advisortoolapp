import type { MotionContext } from "./motion";
import type { QuoteVideoFacts, SceneKey, VideoInput } from "./script";
import type { ThemeKey } from "./theme-keys";
import type { ScenePlan } from "./timeline";
import type { Extra } from "./told";

/**
 * วิดีโอนำเสนอ's Motion Graphic clip drawn by Remotion (owner, 2026-10-17: "ต่อ Remotion เข้าแอปจริงเลย";
 * trial https://claude.ai/artifact/Bjrk5RBReE3qYuCaHu2Mw9). The project in remotion/ draws every
 * frame with motion.tsx and themes.tsx, at 30 a second, on Cloud Run — no frame is drawn on Vercel.
 * What it is given is this file's ClipProps: the very context the satori frames are drawn from
 * (quotePartsFor's motion), each scene's start and length, the voice and the cut-outs as links.
 *
 * Who gets it is the switch on /admin/ai (remotion-switch.ts). Life Protect in portrait only, as the
 * trial measured it (mockup https://claude.ai/artifact/1ccgwYoiQsJoDtuA5irZVd): the other plans and
 * the square and landscape shapes stay on the satori frames until each is tried.
 */

/** who gets them: the switch on /admin/ai (remotion-switch.ts reads and saves it) */
export type RemotionFor = "off" | "owner" | "all";
export const REMOTION_FOR: RemotionFor[] = ["off", "owner", "all"];
export const REMOTION_FOR_LABEL: Record<RemotionFor, string> = { off: "เครื่องเดิม ทุกคน", owner: "Remotion เฉพาะเจ้าของ", all: "Remotion ทุกคน" };
export const readRemotionFor = (v: unknown): RemotionFor => (REMOTION_FOR.includes(v as RemotionFor) ? (v as RemotionFor) : "off");

/**
 * The version of the drawing code a clip's props are made for: the image refuses props of another
 * (remotion/src/Root.tsx). tests/quote-video/remotion-drawing.test.ts says when it must change.
 */
export const REMOTION_DRAWING = "227d4530ba70";

/** the Cloud Run job that renders them (remotion/cloudrun), started with the same key as clip-ffmpeg */
export const REMOTION_JOB = "remotion-render";

/** what a Motion Graphic quote clip is drawn from, beside its scenes: quotePartsFor's own context */
export type RemotionMotion = {
  theme: ThemeKey;
  sex: "M" | "F";
  facts: QuoteVideoFacts;
  customer: string;
  narrator: "F" | "M";
  contact: MotionContext["contact"];
  shown: { headline?: string[]; loop: boolean; extra: Extra };
};

/** a type, not an interface: Remotion's props must fit Record<string, unknown> */
export type ClipProps = RemotionMotion & {
  /** REMOTION_DRAWING as the app had it */
  drawing: string;
  total: number;
  scenes: { key: SceneKey; voice: string; voiceSec: number; start: number; dur: number }[];
  /** the mixed narration (and คอลลาจ's sounds): a link, or a file in the project's public folder */
  audio: string;
  /** คอลลาจ's cut-outs by "scene/piece": links, or files in the project's public folder */
  pieces: Record<string, string>;
};

/** whether a clip can be drawn by Remotion: a portrait Motion Graphic Life Protect clip */
export function remotionFits(input: VideoInput): boolean {
  return (input.product ?? "LIFEPROTECT") === "LIFEPROTECT" && input.style === "motion" && (input.size ?? "portrait") === "portrait";
}

/** the props for one clip: its motion context, its scenes as planned, its voice and cut-outs */
export function clipProps(
  motion: RemotionMotion, plans: Pick<ScenePlan<SceneKey>, "key" | "start" | "dur">[], script: { voice: string }[],
  secs: number[], total: number, audio: string, pieces: Record<string, string>,
): ClipProps {
  return {
    ...motion, drawing: REMOTION_DRAWING, total, audio, pieces,
    scenes: plans.map((p, i) => ({ key: p.key, voice: script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur })),
  };
}
