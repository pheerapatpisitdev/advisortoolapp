import type { ClipEdit, ClipVideo } from "@/lib/content/clip";
import { HOOK_SEC } from "./styles";
import { keepRanges, keptDuration, mapTime, subsOnOutput, type Span, type Sub } from "./timeline";

/**
 * The editor's live preview, worked out the way the render works it out (owner, 2026-10-02):
 * the preview plays the whole preview file and skips what is cut, and lays the words over it
 * on the cut clip's clock. No I/O and nothing server-only: the browser runs these.
 */

/** what stays of the clip under this edit */
export const keepOf = (v: Pick<ClipVideo, "durationSec" | "transcript">, edit: Pick<ClipEdit, "cut" | "silences" | "trimSilence">): Span[] =>
  keepRanges({ duration: v.durationSec, segments: v.transcript ?? [], cut: edit.cut, silences: edit.silences ?? [], trimSilence: edit.trimSilence });

/** a player's clock is read a frame late: this close to a kept edge counts as on it */
const EDGE = 0.02;

/** a kept start this close to the file's own end has no frame to jump to */
const TAIL = 0.05;

/**
 * Where the player goes from source second `t`: nowhere (null) while it is in a kept stretch,
 * the next kept start when it is in a cut, or "end" once nothing kept is left after it. A start
 * at or past the end of the file playing (`duration`: the preview may run a little shorter than
 * the clip) is the end too, so the player never seeks to where it cannot go, again and again.
 */
export function playerJump(t: number, keep: Span[], duration = Infinity): number | "end" | null {
  for (const [a, b] of keep) {
    if (t < a - EDGE) return Number.isFinite(duration) && a >= duration - TAIL ? "end" : a;
    if (t < b - EDGE) return null;
  }
  return "end";
}

/**
 * The subtitles as the render lays them (render-run.ts startRender): on the cut clip's clock,
 * a cut sentence's lines left off; a stored line made before lines knew their sentence
 * belongs to none, and is never cut with one.
 */
export const subsShown = (edit: Pick<ClipEdit, "subs" | "cut">, keep: Span[]): Sub[] =>
  subsOnOutput(edit.subs.map((s) => ({ ...s, seg: s.seg ?? -1 })), keep, edit.cut);

/**
 * What lies over the frame at source second `t`: the hook while the cut clip's clock is under
 * HOOK_SEC (and the clip is that long), and the line showing then — the later one where two
 * meet, as the render's later picture lies on top.
 */
export function overlayAt(t: number, keep: Span[], subs: Sub[], hasHook: boolean): { out: number; hook: boolean; sub: number } {
  const out = mapTime(t, keep);
  const hook = hasHook && out < Math.min(HOOK_SEC, keptDuration(keep));
  let sub = -1;
  subs.forEach((s, i) => { if (s.text.trim() && s.start <= out && out <= s.end) sub = i; });
  return { out, hook, sub };
}
