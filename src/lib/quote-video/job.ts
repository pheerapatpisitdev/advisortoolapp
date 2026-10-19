/**
 * What a clip's render needs besides its drawing (remotion/): each scene's transition into the next, and the
 * narration as one WAV on the clip's timeline (mixNarration). The ffmpeg
 * cut that once used these (buildJob, a frame list per scene) is gone with the old engine (owner, 2026-10-20, ข).
 */

/** how each scene comes in over the one before it, as ffmpeg's xfade named them (remotion/src/Clip.tsx crossing) */
export const TRANSITIONS: Record<string, string> = { lead: "fade", price: "slideleft", cover: "zoomin", value: "slideleft", compare: "slideleft", critical: "slideleft", terms: "slideleft", contact: "fade",
  story: "fade", qa: "slideleft", versus: "zoomin", steps: "slideleft",
  fhcOpen: "fade", fhcScores: "slideleft", fhcGaps: "slideleft", fhcEvents: "zoomin", fhcPlan: "slideleft", fhcContact: "fade",
  storyHook: "fade", storyPool: "fade", storyHit: "fade", storyHelp: "slideleft", storyAll: "fade", storyContact: "fade", freeScene: "fade",
  knowAsk: "fade", knowOne: "slideleft", knowTwo: "slideleft", knowThree: "slideleft", knowRecap: "zoomin" };

/**
 * The narration as one WAV on the clip's timeline: each scene's line (16-bit mono PCM at
 * `rate`, as Gemini returns it) placed at its scene's voice start, silence between.
 */
export function mixNarration(lines: { pcm: Buffer; at: number }[], total: number, rate = 24000): Buffer {
  const samples = Math.ceil(total * rate);
  const out = Buffer.alloc(44 + samples * 2);
  for (const { pcm, at } of lines) {
    const start = Math.round(at * rate) * 2;
    const len = Math.min(pcm.length - (pcm.length % 2), out.length - 44 - start);
    if (len > 0) pcm.copy(out, 44 + start, 0, len);
  }
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples * 2, 40);
  return out;
}

/** how long 16-bit mono PCM at `rate` plays */
export const pcmSeconds = (pcm: Buffer, rate = 24000) => pcm.length / 2 / rate;
