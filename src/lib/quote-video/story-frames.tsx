import { CROWD_HERO, crowdOf } from "@/lib/story/faces";
import { abs } from "./motion";
import { type StorySceneKey, type StoryVideoInput } from "./story";
import { knowEpisode, knowText, type KnowSceneKey } from "./story-knowledge";
import { knowBody, knowFaces, knowWindows } from "./story-knowledge-motion";
import { storyFrame, storyHandText, storyWindows, Subtitle, type PoolSceneKey, type StoryContext } from "./story-motion";
import { SIZES, type VideoSize } from "./timeline";

/**
 * A story clip's frames, whichever topic it tells: กองกลาง 48 คน (story-motion.tsx) or an episode
 * of ความรู้ประกัน 1 นาที (story-knowledge-motion.tsx). make.ts asks here and nowhere else.
 */

const pool = (input: StoryVideoInput) => input.topic === "pool48";

/** when a scene's things move, in scene seconds */
export function clipWindows(key: StorySceneKey, input: StoryVideoInput, size: VideoSize): [number, number][] {
  return pool(input) ? storyWindows(key as PoolSceneKey, input, size) : knowWindows(key as KnowSceneKey | "storyContact", input);
}

/** the faces a clip draws, in colour and grey (story-faces.ts loads them) */
export function clipFaces(input: StoryVideoInput): string[] {
  return pool(input) ? [...crowdOf(input.faces.hero, input.faces.narrator), input.faces.narrator] : knowFaces(input);
}

/** the crowd of 48, for กองกลาง; an episode has none */
export const clipCrowd = (input: StoryVideoInput): string[] => (pool(input) ? crowdOf(input.faces.hero, input.faces.narrator) : []);
export { CROWD_HERO };

/** every letter the handwriting face is cut to */
export function clipHandText(input: StoryVideoInput, customer: string): string {
  return pool(input) ? storyHandText(input, customer) : `${knowText(knowEpisode(input, customer))}0123456789,=`;
}

/** One frame of a story clip's scene at scene time t: transparent, over the paper. */
export function clipFrame(key: StorySceneKey, c: StoryContext, t: number) {
  if (pool(c.input)) return storyFrame(key as PoolSceneKey, c, t);
  const { w, h } = SIZES[c.size];
  const episode = knowEpisode(c.input, c.customer, c.narrator);
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, background: "transparent", fontFamily: "Plex" }}>
      {knowBody(key as KnowSceneKey | "storyContact", c, t, episode)}
      <Subtitle c={c} t={t} />
      <div style={abs({ left: 0, width: w, bottom: c.size === "portrait" ? 34 : 18, justifyContent: "center", fontSize: 26, opacity: 0.55 })}>Design by www.unitclub.app</div>
    </div>
  );
}

/** คลิปตามโจทย์ draws its scenes by index and picture (prompt-story/frames.tsx), not by key */
export { freeFrame, freeHandText, freeWindows } from "@/lib/prompt-story/frames";
