/**
 * The soft tick under a press on the menu (owner's ask, 2026-10-03).
 *
 * It is drawn with the Web Audio API rather than played from a file, so there is nothing to
 * download and nothing to go missing: a 45 ms blip that falls away at once, quiet enough to be
 * felt more than heard, because the menu is also on the pages an agent holds up to a customer.
 *
 * A browser only lets sound start after the person has done something on the page, and a
 * press is exactly that, so the context is made on the first press and reused after it. Every
 * way this can fail — no Web Audio, a context the browser keeps suspended, the server render —
 * ends in silence and never in an error, because a menu that throws on a click is worse than
 * one that makes no noise.
 */

let context: AudioContext | null = null;

export function playClick(): void {
  try {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(1100, now);
    tone.frequency.exponentialRampToValueAtTime(700, now + 0.04);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    tone.connect(volume).connect(context.destination);
    tone.start(now);
    tone.stop(now + 0.05);
  } catch {
    /* silence */
  }
}
