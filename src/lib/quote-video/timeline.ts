import type { FhcSceneKey } from "./fhc";
import type { SceneKey } from "./script";

/** a quote clip's scenes, or an FHC summary's (fhc.ts) */
export type AnySceneKey = SceneKey | FhcSceneKey;

/**
 * When everything in the clip happens (owner, 2026-10-11: the free effects — transitions, count-up,
 * highlighter sweep, the pen ring, word-by-word subtitles, a slow zoom on the family photo).
 *
 * The animated parts of a scene are drawn as a run of still overlay frames, one for every moment
 * something visibly changes, each held until the next. This file decides those moments and what
 * each frame shows; drawing them is draw.tsx, joining them is job.ts. All pure, all in seconds.
 */

export const W = 1080;
export const H = 1920;
export const FPS = 30;
/** the cross-fade between scenes */
export const XFADE = 0.5;
/** silence before a scene's voice starts, and after it ends */
export const LEAD = 0.35;
export const TAIL = 0.6;

/** One animated item: from `at` for `dur` seconds, in `steps` visible steps. */
interface Anim { at: number; dur: number; steps: number }

/** The state of a scene's animated items at one moment: each progress 0..1, already stepped. */
export interface OverlayState {
  /** the word being said: -1 before the voice, words.length once it is done */
  word: number;
  count: number;
  sweep: number[];
  bars: [number, number];
  ring: number;
  callout: boolean;
  /** the Motion Graphic style: the scene time the frame is drawn at (motion.tsx works out the rest) */
  t?: number;
}

/** The pan down the value table, scene "value": from `at`, for `dur`. */
export interface Pan { at: number; dur: number }

export interface ScenePlan<K extends AnySceneKey = AnySceneKey> {
  key: K;
  /** where the scene starts in the finished clip */
  start: number;
  /** how long the scene's own stream runs (it overlaps the next by XFADE) */
  dur: number;
  /** where its voice starts, in the finished clip */
  voiceAt: number;
  pan?: Pan;
  /** the overlay frames: each shown from `t` (scene time) until the next one */
  frames: { t: number; state: OverlayState }[];
}

const COUNT: Anim = { at: 0.3, dur: 1.4, steps: 24 };
const BARS: [Anim, Anim] = [{ at: 0.15, dur: 0.9, steps: 10 }, { at: 0.55, dur: 0.9, steps: 10 }];
const RING_STEPS = 12;
const RING_DUR = 1.0;

/** How a scene moves, besides its subtitle (script.ts `sceneMotion` says it per product). */
export interface SceneMotion {
  /** a figure counted up from nought */
  count?: boolean;
  /** highlighter strokes: a few at the start, or `spread` through the voice, one per row read */
  sweeps?: number;
  spread?: boolean;
  /** Life Protect's two death-benefit bars */
  bars?: boolean;
  /** the value table's pan, the callout and the pen ring round the break-even */
  pan?: boolean;
  /** the pen ring round the main plan of a comparison */
  ring?: boolean;
  /** the Motion Graphic style: when its elements move; frames are drawn at `fps` inside these */
  windows?: [number, number][];
  fps?: number;
}

function sweepAnims(m: SceneMotion, voiceSec: number): Anim[] {
  const n = m.sweeps ?? 0;
  if (!m.spread) return Array.from({ length: n }, (_, i) => ({ at: 0.8 + i * 0.3, dur: 0.7, steps: 8 }));
  // one row lit as the voice reaches it, more or less: spaced over the first 85% of the line
  return Array.from({ length: n }, (_, i) => ({ at: LEAD + (i * voiceSec * 0.85) / n, dur: 0.6, steps: 8 }));
}

/** progress of an animation at time t, stepped: 0 before, 1 after, k/steps between */
function stepped(a: Anim, t: number): number {
  if (t < a.at) return 0;
  if (t >= a.at + a.dur) return 1;
  return Math.floor(((t - a.at) / a.dur) * a.steps) / a.steps;
}
/** the moments an animation changes step */
function stepTimes(a: Anim): number[] {
  return Array.from({ length: a.steps }, (_, k) => a.at + (k * a.dur) / a.steps).concat(a.at + a.dur);
}

/** The words of a line and when each starts and ends, by its share of the line's letters. */
export function wordTimes(voice: string, voiceSec: number, at = LEAD): { word: string; from: number; to: number }[] {
  const words = voice.split(" ").filter(Boolean);
  const total = words.reduce((n, w) => n + w.length, 0) || 1;
  let acc = 0;
  return words.map((word) => {
    const from = at + (acc / total) * voiceSec;
    acc += word.length;
    return { word, from, to: at + (acc / total) * voiceSec };
  });
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Every scene's length and frames, from how long each voice line runs. A scene lasts its voice
 * plus LEAD and TAIL; the value scene at least long enough for its pan and the pen ring.
 */
export function planScenes<K extends AnySceneKey>(lines: ({ key: K; voice: string; voiceSec: number } & SceneMotion)[]): ScenePlan<K>[] {
  let start = 0;
  return lines.map(({ key, voice, voiceSec, ...motion }, i) => {
    const words = wordTimes(voice, voiceSec);
    let dur = LEAD + voiceSec + TAIL;
    let pan: Pan | undefined;
    let ring: Anim | undefined;
    let calloutAt: number | undefined;
    if (motion.pan) {
      pan = { at: 1.2, dur: Math.max(4, Math.min(8, voiceSec * 0.5)) };
      calloutAt = pan.at + pan.dur + 0.2;
      ring = { at: calloutAt + 0.2, dur: RING_DUR, steps: RING_STEPS };
      dur = Math.max(dur, ring.at + ring.dur + 1.5);
    }
    if (motion.ring && !motion.pan) ring = { at: 0.9, dur: RING_DUR, steps: RING_STEPS };
    const sweeps = sweepAnims(motion, voiceSec);
    const times = new Set<number>([0]);
    for (const w of words) times.add(r3(w.from));
    times.add(r3(words.length ? words[words.length - 1].to : LEAD));
    if (motion.count) for (const t of stepTimes(COUNT)) times.add(r3(t));
    for (const s of sweeps) for (const t of stepTimes(s)) times.add(r3(t));
    if (motion.bars) for (const b of BARS) for (const t of stepTimes(b)) times.add(r3(t));
    if (ring) for (const t of stepTimes(ring)) times.add(r3(t));
    if (calloutAt !== undefined) times.add(r3(calloutAt));

    const stateAt = (t: number): OverlayState => {
      let word = -1;
      for (let k = 0; k < words.length; k++) if (t >= words[k].from - 1e-6) word = k;
      if (words.length && t >= words[words.length - 1].to - 1e-6) word = words.length;
      return {
        word,
        count: motion.count ? stepped(COUNT, t) : 1,
        sweep: sweeps.map((s) => stepped(s, t)),
        bars: motion.bars ? [stepped(BARS[0], t), stepped(BARS[1], t)] : [1, 1],
        ring: ring ? stepped(ring, t) : 0,
        callout: calloutAt !== undefined && t >= calloutAt - 1e-6,
      };
    };

    if (motion.windows) {
      // the Motion Graphic style: a frame every 1/fps while anything moves, one per word otherwise
      const fps = motion.fps ?? 12;
      const ts = new Set<number>([0]);
      for (const [from, to] of motion.windows) {
        for (let x = Math.max(0, from); x < to + 1 / fps; x += 1 / fps) ts.add(r3(Math.min(x, to)));
      }
      for (const w of words) ts.add(r3(w.from));
      ts.add(r3(words.length ? words[words.length - 1].to : LEAD));
      const wordAt = (t: number) => {
        let word = -1;
        for (let k = 0; k < words.length; k++) if (t >= words[k].from - 1e-6) word = k;
        if (words.length && t >= words[words.length - 1].to - 1e-6) word = words.length;
        return word;
      };
      const frames = [...ts].filter((x) => x >= 0 && x < dur).sort((a, b) => a - b)
        .map((t) => ({ t, state: { word: wordAt(t), count: 1, sweep: [], bars: [1, 1] as [number, number], ring: 0, callout: false, t } }));
      const plan: ScenePlan<K> = { key, start: r3(start), dur: r3(dur), voiceAt: r3(start + LEAD), frames };
      start += dur - (i < lines.length - 1 ? XFADE : 0);
      return plan;
    }

    const frames: ScenePlan["frames"] = [];
    let last = "";
    for (const t of [...times].filter((x) => x >= 0 && x < dur).sort((a, b) => a - b)) {
      const state = stateAt(t);
      const k = JSON.stringify(state);
      if (k !== last) frames.push({ t, state });
      last = k;
    }
    const plan: ScenePlan<K> = { key, start: r3(start), dur: r3(dur), voiceAt: r3(start + LEAD), frames, ...(pan ? { pan } : {}) };
    start += dur - (i < lines.length - 1 ? XFADE : 0);
    return plan;
  });
}

/** the finished clip's length */
export function clipLength(plans: ScenePlan[]): number {
  const last = plans[plans.length - 1];
  return last ? r3(last.start + last.dur) : 0;
}

/** an eased count-up: the figure shown at progress p of `target` */
export function countAt(target: number, p: number): number {
  return Math.round(target * (1 - Math.pow(1 - p, 3)));
}
