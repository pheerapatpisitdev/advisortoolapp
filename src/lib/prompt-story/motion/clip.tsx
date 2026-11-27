import type { CSSProperties, JSX } from "react";
import type { StoryContext } from "@/lib/quote-video/story-motion";
import { SIZES, XFADE } from "@/lib/quote-video/timeline";
import type { PromptScene } from "../types";
import { MotionSubtitle, motionContact } from "./chrome";
import { PROMPT } from "./css";
import { clamp, inout, r2 } from "./ease";
import { motionBody, type MotionCtx } from "./layouts";

/**
 * A โมชันกราฟิก clip's scene as Remotion's StoryClip draws it (owner, 2026-11-26, mockup ข round 2): the scene's layout
 * (motionBody), its device, its library part, or the agent's card that closes the clip, with the voice's subtitle over
 * it. The ground under a device or a part is StoryClip's (story-motion.tsx storyBackground in the motion look); a
 * layout and the agent's card draw their own. Drawn here, without Remotion, so it can be tested and seen in a still.
 */

/** a library part's picture (asset-picture.tsx: the part in the middle of a frame on the navy) pushed in as today's are */
const PART_PUSH = 0.12;

/**
 * One scene's layer at scene time t. `scene` null is the agent's card; `c.words` and `c.voiceSec` are the voice the
 * subtitle follows. A device is handed in drawn (frames.tsx deviceBody), and the figure card's lines (frames.tsx
 * figureLines) are handed in too: this folder never imports frames.tsx, which pulls every plan's rate tables after it.
 */
export function motionLayer(p: {
  scene: PromptScene | null; c: StoryContext; t: number; dur: number; picture?: string;
  figure: MotionCtx["figure"]; device?: JSX.Element | null;
}): JSX.Element {
  const { scene, c, t, dur, picture } = p;
  const { w, h } = SIZES[c.size];
  const body = !scene ? motionContact({ contact: c.contact, customer: c.customer, narrator: c.narrator, size: c.size, t })
    : scene.device ? (p.device ?? null)
    : scene.asset ? (picture ? (
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: w, height: h, transform: `scale(${r2(1 + PART_PUSH * clamp(t / dur))})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt="" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    ) : null)
    : motionBody(scene, { size: c.size, dur, picture, figure: p.figure }, t);
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, overflow: "hidden", fontFamily: PROMPT }}>
      {body}
      <MotionSubtitle words={c.words} voiceSec={c.voiceSec} size={c.size} t={t} />
    </div>
  );
}

/**
 * How scene `s`'s layer stands at a join (the mockup's): the incoming scene uncovered from left to right over its
 * first XFADE, the gold edge at `wipe` (0–1 across the frame, motionWipe); the outgoing scene sliding 12% to the left
 * as the next one (starting at `nextStart`) comes in. `t` is the scene's own time, `T` the clip's.
 */
export function motionJoin(s: number, t: number, T: number, nextStart: number | undefined): { style: CSSProperties; wipe?: number } {
  if (s > 0 && t < XFADE) {
    const e = inout(t / XFADE);
    return { style: { clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` }, wipe: e };
  }
  if (nextStart !== undefined && T >= nextStart) return { style: { transform: `translateX(${-12 * inout((T - nextStart) / XFADE)}%)` } };
  return { style: {} };
}
