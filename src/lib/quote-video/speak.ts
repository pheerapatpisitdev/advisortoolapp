import { providerKey } from "@/lib/ai/client";
import { cloudVoiceKey, speakLine, TtsError, TTS_VOICES, type Narrator, type SpeechLang } from "@/lib/ai/tts";
import { elevenAccount, elevenVoice, ELEVEN_RESERVE, ELEVENLABS, type ElevenChoice } from "@/lib/voice/elevenlabs";

/**
 * The reader a Thai clip falls back to when Gemini's voice cannot be used (owner, 2026-10-17,
 * mockup https://claude.ai/artifact/WdDKuEDh2k42TZ9nFJjW9x, option ก): อ้อม for a woman, สมชาย for a
 * man, both on ElevenLabs' shared Thai list that every member may pick from.
 */
export const FALLBACK_VOICE = { F: "nealpwJT5tCyJFKDzEq8", M: "XLXcyPK1jTjw1pYLLcM9" } as const satisfies Record<Narrator, string>;

/** Gemini's voice can be asked: the API key on in /admin/ai, or the Cloud key; the API's daily cap is a separate check (voiceFullUntil) */
export async function geminiUsable(): Promise<boolean> {
  return Boolean(await providerKey("google").catch(() => null)) || (await cloudUsable());
}

/** the Gemini voice on Cloud can take every line (owner, 2026-10-20): it has no daily cap, so no clip need wait for 14:00 */
export async function cloudUsable(): Promise<boolean> {
  return Boolean(await cloudVoiceKey());
}

/**
 * ElevenLabs can read a clip now: a key, a paid plan (a free one may not use the library voices
 * every choice is), and credits above the reserve. An account that cannot be read counts as ready:
 * the clip itself still switches if it is not.
 */
export async function elevenReady(f?: typeof fetch): Promise<boolean> {
  const key = await providerKey(ELEVENLABS).catch(() => null);
  if (!key) return false;
  const a = await elevenAccount(key, f).catch((e) => {
    console.error("eleven account not read:", e instanceof Error ? e.message : "unknown error");
    return { left: Infinity, free: false };
  });
  return !a.free && a.left >= ELEVEN_RESERVE;
}

/** the fallback reader for this narrator, when ElevenLabs can take the clip (elevenReady) */
export async function fallbackReader(narrator: Narrator, f?: typeof fetch): Promise<ElevenChoice | null> {
  return (await elevenReady(f)) ? elevenVoice(FALLBACK_VOICE[narrator]) ?? null : null;
}

export interface Spoken { pcm: Buffer; costThb: number }

/**
 * Every line of a clip spoken. A clip that named an ElevenLabs voice is read by it; any other is
 * read by Gemini (the API, then Cloud, line by line: speakGemini), and if that cannot be done a Thai clip is read again, whole, by the fallback
 * reader, so one clip never has two voices. Another language keeps Gemini's failure for now (the
 * Thai voices have not been heard on it). `fellBackTo` names the reader when the switch happened.
 * A chosen ElevenLabs voice that cannot speak goes the other way (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/J34jDCp3JK3adTytUcZ36f, ก ก): the whole clip again in Google's
 * narrator of the same sex, Kore or Orus, named by `google`.
 */
export async function speakClip(lines: string[], o: {
  task: string; narrator: Narrator; lang: SpeechLang; voice?: string; fetch?: typeof fetch;
  /** one of Gemini's 30 voices by name; without it the narrator's own */
  gemini?: string;
  /** runs `fn` over the lines, `n` at a time */
  pool: <T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>) => Promise<R[]>;
  onLine?: () => void; onSwitch?: () => void;
}): Promise<{ spoken: Spoken[]; fellBackTo: ElevenChoice | null; google: string | null }> {
  // ElevenLabs' Starter plan takes three lines at a time: two at once stays under it. Gemini three
  // at a time, not every line at once, which ran into its per-minute limit (owner, 2026-10-18)
  const run = (voice?: string, gemini = o.gemini) => o.pool(lines, voice ? 2 : 3, (line) =>
    speakLine(line, o.task, { narrator: o.narrator, gemini, voice, lang: o.lang, fetch: o.fetch }).then((r) => { o.onLine?.(); return r; }));
  if (o.voice) {
    const google = TTS_VOICES[o.narrator];
    // known not to speak (no key, free plan, out of credits): straight to Google, nothing spent on it
    if (!(await elevenReady(o.fetch))) return { spoken: await run(undefined, undefined), fellBackTo: null, google };
    try {
      return { spoken: await run(o.voice), fellBackTo: null, google: null };
    } catch (e) {
      if (!(e instanceof TtsError)) throw e;
      console.error("tts: ElevenLabs voice not usable, switching to Google", google, "-", e.message);
      o.onSwitch?.();
      return { spoken: await run(undefined, undefined), fellBackTo: null, google };
    }
  }
  try {
    return { spoken: await run(), fellBackTo: null, google: null };
  } catch (e) {
    const to = o.lang === "th" && e instanceof TtsError ? await fallbackReader(o.narrator, o.fetch) : null;
    if (!to) throw e;
    console.error("tts: Gemini voice not usable, switching to", to.name, "-", (e as Error).message);
    o.onSwitch?.();
    return { spoken: await run(to.id), fellBackTo: to, google: null };
  }
}
