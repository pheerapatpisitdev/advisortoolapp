/**
 * A take as the recorder sends it (เสียงของฉัน, owner 2026-10-15): whatever the browser recorded
 * (webm on Chrome, mp4 on Safari) decoded, made mono, and written as 16-bit WAV, so ElevenLabs
 * gets one kind of file from every phone. Browser-safe and pure, for the tests.
 */

/** the rate the takes are kept at: plenty for a voice, small enough to upload */
export const TAKE_RATE = 22050;

/** 16-bit mono WAV bytes from samples in [-1, 1] */
export function encodeWav(samples: Float32Array, rate = TAKE_RATE): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return out;
}

/** how loud a take is: its RMS, 0 to 1. Below QUIET the recorder asks for another go */
export const QUIET = 0.01;
export function loudness(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
