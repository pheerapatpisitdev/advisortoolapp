import { joinCues, tidyCues, type Cue } from "./fx";
import { ICON_POP, iconFor } from "./fx-icons";
import { motionSpec } from "./motion";
import type { QuoteVideoFacts, SceneKey } from "./script";
import type { OverlayState } from "./timeline";

/**
 * Where ลูกเล่นคลิปใหม่'s sound effects fall (fx.ts), clip by clip: a whoosh at each join, a ding as a figure finishes
 * counting up, coins as the price's coins stack, a pop as a picture or an icon pops in.
 */

type Placed = { key: string; start: number; voiceSec: number; voice: string };

/** a Motion Graphic quote clip: its scenes' own entrances (motion.tsx motionSpec) say when */
export function quoteCues(scenes: Placed[], facts: QuoteVideoFacts, portrait: boolean): Cue[] {
  const cues: Cue[] = joinCues(scenes);
  for (const sc of scenes) {
    const spec = motionSpec(sc.key as SceneKey, facts, sc.voiceSec, sc.voice);
    if (spec.count) cues.push({ at: sc.start + spec.count.at + spec.count.dur, sound: "ding", volume: 0.45 });
    if (spec.family) cues.push({ at: sc.start + spec.family.at, sound: "pop", volume: 0.45 });
    if (sc.key === "price" && spec.coin0) cues.push({ at: sc.start + spec.coin0.at, sound: "coins", volume: 0.35 });
    if (portrait && iconFor(facts.product, sc.key)) cues.push({ at: sc.start + ICON_POP, sound: "pop", volume: 0.5 });
  }
  return tidyCues(cues);
}

/** a แบบปกติ clip: its overlay states say when each figure has finished counting */
export function classicCues(scenes: { start: number; frames: { t: number; state: OverlayState }[] }[]): Cue[] {
  const cues: Cue[] = joinCues(scenes);
  for (const sc of scenes) {
    const done = sc.frames.find((f, i) => f.state.count >= 1 && i > 0 && sc.frames[i - 1].state.count < 1);
    if (done) cues.push({ at: sc.start + done.t, sound: "ding", volume: 0.45 });
  }
  return tidyCues(cues);
}

/** an FHC summary: the joins, and the phone's pop at the end */
export function fhcCues(scenes: { key: string; start: number }[], portrait: boolean): Cue[] {
  const cues: Cue[] = joinCues(scenes);
  if (portrait) for (const sc of scenes) if (iconFor("FHC", sc.key)) cues.push({ at: sc.start + ICON_POP, sound: "pop", volume: 0.5 });
  return tidyCues(cues);
}
