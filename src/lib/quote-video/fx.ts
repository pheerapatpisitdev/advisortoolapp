import { LEAD, XFADE } from "./timeline";

/**
 * ลูกเล่นคลิปใหม่ (owner chose ก on the real side-by-side, 2026-10-20; https://claude.ai/artifact/E6U7G4pcYMAgR8JdoL2KMW,
 * plan https://claude.ai/artifact/UqRvZyxLrMNG8fiTHJeeSm): music under the voice, sound effects at the moments that
 * matter, headlines in from a blur, a fourth way between scenes (the wipe), and a moving icon where a scene has no
 * picture of its own. A clip has them when it is made while the back office's switch lets its maker have them
 * (fx-switch.ts; the owner alone at first); the agent may turn the music off on the form.
 *
 * Browser-safe and plain: the app writes `fxPropsOf` into the clip's props, and the Remotion image reads them.
 */

/** what the clip's row keeps: `fx` when it was made with the new look, `noMusic` when the agent turned the music off */
export type FxChoice = {
  fx?: true;
  noMusic?: true;
};

/** the three pieces of music (remotion/public/fx/music-<mood>.mp3), picked by what the clip is about */
export const MUSIC_MOODS = ["warm", "bright", "calm"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

/** what the render is told: absent = the clip as it was before, music null = the new look without music. A type, not an interface: Remotion's props must fit Record<string, unknown> */
export type FxProps = {
  fx?: { music: MusicMood | null };
};

/** health and savings sound bright; the money check calm; life cover, pensions and stories warm */
export function moodFor(product: string | undefined): MusicMood {
  if (product === "IHEALTHY" || product === "ISHIELD" || product === "PLB" || product === "GSAVING") return "bright";
  if (product === "FHC") return "calm";
  return "warm";
}

export function fxPropsOf(input: FxChoice & { product?: string }): FxProps {
  if (!input.fx) return {};
  return { fx: { music: input.noMusic ? null : moodFor(input.product) } };
}

/** the scenes that come in by the wipe instead of their usual way, one or two a clip */
const WIPE = new Set(["value", "terms", "index", "fhcGaps", "storyHelp", "knowTwo"]);

/** how scene `key` comes in: the wipe on the new look's few, its own way (job.ts TRANSITIONS) otherwise */
export function transitionOf(key: string, fx: boolean, own: Record<string, string>): string {
  return fx && WIPE.has(key) ? "wipe" : own[key] ?? "fade";
}

const ramp = (x: number) => Math.max(0, Math.min(1, x));

/** how loud the music is at T: up over the first second, down under every line the voice says, out over the end */
export function musicVolume(T: number, scenes: { start: number; voiceSec: number }[], total: number): number {
  const talking = Math.max(0, ...scenes.map((sc) => {
    const from = sc.start + LEAD;
    const to = from + sc.voiceSec;
    return Math.min(ramp((T - (from - 0.35)) / 0.35), ramp((to + 0.35 - T) / 0.35));
  }));
  return (0.3 - 0.21 * talking) * ramp(T / 1.2) * ramp((total - T) / 1.8);
}

export const SOUNDS = ["whoosh", "pop", "ding", "coins"] as const;
export type Sound = (typeof SOUNDS)[number];
export type Cue = { at: number; sound: Sound; volume: number };

/** a whoosh as each scene after the first comes in, a little ahead of the join */
export function joinCues(scenes: { start: number }[]): Cue[] {
  return scenes.slice(1).map((sc) => ({ at: Math.max(0, sc.start - 0.2), sound: "whoosh" as const, volume: 0.5 }));
}

/** the cues in time order, none before the clip starts, two of one sound never closer than half a second */
export function tidyCues(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const c of [...cues].filter((c) => c.at >= 0).sort((a, b) => a.at - b.at)) {
    if (out.some((o) => o.sound === c.sound && Math.abs(o.at - c.at) < 0.5)) continue;
    out.push(c);
  }
  return out;
}

/** how long a join takes, so an icon waits for its scene to be in */
export const ICON_AT = Math.min(0.3, XFADE);
