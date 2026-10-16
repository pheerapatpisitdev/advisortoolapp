import { providerKey } from "@/lib/ai/client";
import { elevenCreditsLeft, elevenVoice, ELEVEN_RESERVE, ELEVENLABS, type ElevenChoice } from "@/lib/voice/elevenlabs";
import { myVoiceChoice } from "@/lib/voice/mine";
import { voiceFullUntil } from "./make";
import { bangkokClock, voiceFullNotice } from "./voice-quota";

/** The voice a clip form asked for, before anything is held: shared by every clip's action. */

export const ADMIN_VOICE = "เสียงนี้ใช้ได้เฉพาะแอดมิน เลือกเสียงอื่นแทน";

/** the ElevenLabs voice asked for: one of the library's, or the agent's own cloned one */
export async function voiceAsked(agentId: string, id: unknown): Promise<ElevenChoice | undefined> {
  if (typeof id !== "string" || !id) return undefined;
  const listed = elevenVoice(id);
  if (listed) return listed;
  const mine = await myVoiceChoice(agentId);
  return mine && mine.id === id ? mine : undefined;
}

/** a Gemini-voiced clip is not started while the voice is used up: it would only fail */
export async function voiceRefusal(voice: string | undefined): Promise<string | null> {
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
  // a wrong answer here only hides the warning; the clip itself still fails with the reason
  const until = await voiceFullUntil().catch((e) => {
    console.error("voice quota not read:", e instanceof Error ? e.message : "unknown error");
    return null;
  });
  return until ? voiceFullNotice(bangkokClock(until)) : null;
}
