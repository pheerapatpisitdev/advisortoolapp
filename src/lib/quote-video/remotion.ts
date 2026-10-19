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
 * Who gets it is the switch on /admin/ai (remotion-switch.ts), one row a plan. Life Protect in portrait,
 * as the trial measured it (mockup https://claude.ai/artifact/1ccgwYoiQsJoDtuA5irZVd), and iHealthy in
 * portrait in all five languages, the owner's first (owner chose 1ก 2ก, mockup
 * https://claude.ai/artifact/Bz9r68ApXPeuzosx1yC69a), and iShield in portrait, the Remotion move's phase 1
 * (owner chose ก ก, 2026-10-19, mockup https://claude.ai/artifact/1tNeLnWfAsoHMrw9dw17gR): the other plans and
 * the square and landscape shapes stay on the satori frames until each is tried.
 */

/** who gets them: the switch on /admin/ai (remotion-switch.ts reads and saves it) */
export type RemotionFor = "off" | "owner" | "all";
export const REMOTION_FOR: RemotionFor[] = ["off", "owner", "all"];
export const REMOTION_FOR_LABEL: Record<RemotionFor, string> = { off: "เครื่องเดิม ทุกคน", owner: "Remotion เฉพาะเจ้าของ", all: "Remotion ทุกคน" };
export const readRemotionFor = (v: unknown): RemotionFor => (REMOTION_FOR.includes(v as RemotionFor) ? (v as RemotionFor) : "off");

/** the plans Remotion draws, each with its own row on the switch */
export type RemotionPlan = "LIFEPROTECT" | "IHEALTHY" | "ISHIELD";
export const REMOTION_PLANS: RemotionPlan[] = ["LIFEPROTECT", "IHEALTHY", "ISHIELD"];
export const REMOTION_PLAN_LABEL: Record<RemotionPlan, string> = { LIFEPROTECT: "Life Protect", IHEALTHY: "iHealthy", ISHIELD: "iShield" };

/**
 * The version of the drawing code a clip's props are made for: the image refuses props of another
 * (remotion/src/Root.tsx). tests/quote-video/remotion-drawing.test.ts says when it must change.
 */
export const REMOTION_DRAWING = "60d944716e34";

/**
 * the Cloud Run job that renders them (remotion/cloudrun), started with the same key as clip-ffmpeg: one
 * job a drawing, built by the pre-push hook before the code that names it reaches main (remotion/cloudrun/ship.sh),
 * so the app as deployed and the job it starts always carry the same drawing (Remotion move phase 0, 2026-10-19)
 */
export const REMOTION_JOB = `remotion-${REMOTION_DRAWING}`;

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
  /**
   * Chinese, Russian and Burmese: the Noto face the old engine draws them in (video-words.ts
   * SCRIPT_FAMILY), cut to the clip's letters, one file a weight: links, or files in the project's public folder
   */
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

/** the plan whose switch row a clip follows, when Remotion can draw it: a portrait Motion Graphic Life Protect, iHealthy or iShield clip */
export function remotionPlan(input: VideoInput): RemotionPlan | null {
  if (input.style !== "motion" || (input.size ?? "portrait") !== "portrait") return null;
  const product = input.product ?? "LIFEPROTECT";
  return (REMOTION_PLANS as string[]).includes(product) ? (product as RemotionPlan) : null;
}

/** whether a clip can be drawn by Remotion */
export const remotionFits = (input: VideoInput): boolean => remotionPlan(input) !== null;

/** the props for one clip: its motion context, its scenes as planned, its voice and cut-outs */
export function clipProps(
  motion: RemotionMotion, plans: Pick<ScenePlan<SceneKey>, "key" | "start" | "dur">[], script: { voice: string }[],
  secs: number[], total: number, audio: string, pieces: Record<string, string>, scriptFont?: ClipProps["scriptFont"],
): ClipProps {
  return {
    ...motion, drawing: REMOTION_DRAWING, total, audio, pieces, ...(scriptFont?.length ? { scriptFont } : {}),
    scenes: plans.map((p, i) => ({ key: p.key, voice: script[i].voice, voiceSec: secs[i], start: p.start, dur: p.dur })),
  };
}
