import { providerKey } from "@/lib/ai/client";
import { speakLine, TtsError, type Narrator, type SpeechLang } from "@/lib/ai/tts";
import { elevenCreditsLeft, elevenVoice, ELEVEN_RESERVE, ELEVENLABS, type ElevenChoice } from "@/lib/voice/elevenlabs";

/**
 * The reader a Thai clip falls back to when Gemini's voice cannot be used (owner, 2026-10-17,
 * mockup https://claude.ai/artifact/WdDKuEDh2k42TZ9nFJjW9x, option ก): อ้อม for a woman, สมชาย for a
 * man, both on ElevenLabs' shared Thai list that every member may pick from.
 */
export const FALLBACK_VOICE = { F: "nealpwJT5tCyJFKDzEq8", M: "XLXcyPK1jTjw1pYLLcM9" } as const satisfies Record<Narrator, string>;

/** Gemini's key is on in /admin/ai; the daily cap is a separate check (voiceFullUntil) */
export async function geminiUsable(): Promise<boolean> {
  return Boolean(await providerKey("google").catch(() => null));
}

/** the fallback reader for this narrator, when ElevenLabs can take the clip: a key, and credits above the reserve */
export async function fallbackReader(narrator: Narrator, f?: typeof fetch): Promise<ElevenChoice | null> {
  const key = await providerKey(ELEVENLABS).catch(() => null);
  if (!key) return null;
  const left = await elevenCreditsLeft(key, f).catch((e) => {
    console.error("eleven credits not read:", e instanceof Error ? e.message : "unknown error");
    return Infinity;
  });
  return left < ELEVEN_RESERVE ? null : elevenVoice(FALLBACK_VOICE[narrator]) ?? null;
}

export interface Spoken { pcm: Buffer; costThb: number }

/**
 * Every line of a clip spoken. A clip that named an ElevenLabs voice is read by it; any other is
 * read by Gemini, and if that cannot be done a Thai clip is read again, whole, by the fallback
 * reader, so one clip never has two voices. Another language keeps Gemini's failure for now (the
 * Thai voices have not been heard on it). `fellBackTo` names the reader when the switch happened.
 */
export async function speakClip(lines: string[], o: {
  task: string; narrator: Narrator; lang: SpeechLang; voice?: string; fetch?: typeof fetch;
  /** one of Gemini's 30 voices by name; without it the narrator's own */
  gemini?: string;
  /** runs `fn` over the lines, `n` at a time */
  pool: <T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>) => Promise<R[]>;
  onLine?: () => void; onSwitch?: () => void;
}): Promise<{ spoken: Spoken[]; fellBackTo: ElevenChoice | null }> {
  // ElevenLabs' Starter plan takes three lines at a time: two at once stays under it
  const run = (voice?: string) => o.pool(lines, voice ? 2 : Math.max(1, lines.length), (line) =>
    speakLine(line, o.task, { narrator: o.narrator, gemini: o.gemini, voice, lang: o.lang, fetch: o.fetch }).then((r) => { o.onLine?.(); return r; }));
  try {
    return { spoken: await run(o.voice), fellBackTo: null };
  } catch (e) {
    const to = !o.voice && o.lang === "th" && e instanceof TtsError ? await fallbackReader(o.narrator, o.fetch) : null;
    if (!to) throw e;
    console.error("tts: Gemini voice not usable, switching to", to.name, "-", (e as Error).message);
    o.onSwitch?.();
    return { spoken: await run(to.id), fellBackTo: to };
  }
}
