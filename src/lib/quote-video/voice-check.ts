import { providerKey } from "@/lib/ai/client";
import { elevenCreditsLeft, elevenVoice, ELEVEN_RESERVE, ELEVENLABS, type ElevenChoice } from "@/lib/voice/elevenlabs";
import { voiceFullUntil } from "./make";
import { fallbackReader, geminiUsable } from "./speak";
import { bangkokClock, voiceFullNotice } from "./voice-quota";

/** The voice a clip form asked for, before anything is held: shared by every clip's action. */

/** the ElevenLabs voice asked for: one of the library's, nothing else */
export const voiceAsked = (id: unknown): ElevenChoice | undefined => (typeof id === "string" && id ? elevenVoice(id) : undefined);

/** a Gemini-voiced clip is not started while the voice is used up: it would only fail */
export async function voiceRefusal(voice: string | undefined, thai = true): Promise<string | null> {
  if (voice) {
    // ElevenLabs' month runs low: say so before anything is held or spent (owner, 2026-10-13)
    const key = await providerKey(ELEVENLABS).catch(() => null);
    if (!key) return "เสียง ElevenLabs ใช้ไม่ได้ตอนนี้ เลือกเสียง Gemini แทน";
    const left = await elevenCreditsLeft(key).catch((e) => {
      console.error("eleven credits not read:", e instanceof Error ? e.message : "unknown error");
      return Infinity;
    });
    return left < ELEVEN_RESERVE ? "เสียง ElevenLabs ของเดือนนี้ใกล้หมดแล้ว เลือกเสียง Gemini แทน" : null;
  }
  // Gemini cannot read it, but a Thai clip goes on to อ้อม / สมชาย (owner, 2026-10-17)
  const geminiOk = await geminiUsable();
  if (thai && (!geminiOk || (await voiceFullUntil().catch(() => null)))) {
    if (await fallbackReader("F").catch(() => null)) return null;
  }
  if (!geminiOk) return thai ? "เสียงพากย์ Google ใช้ไม่ได้ตอนนี้ เลือกเสียง ElevenLabs แทน" : "เสียงพากย์ภาษานี้ใช้ Google ซึ่งใช้ไม่ได้ตอนนี้ ลองใหม่ภายหลัง";
  // a wrong answer here only hides the warning; the clip itself still fails with the reason
  const until = await voiceFullUntil().catch((e) => {
    console.error("voice quota not read:", e instanceof Error ? e.message : "unknown error");
    return null;
  });
  return until ? voiceFullNotice(bangkokClock(until)) : null;
}
