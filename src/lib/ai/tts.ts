import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { ELEVEN_MODEL, ELEVENLABS, speakEleven } from "@/lib/voice/elevenlabs";

/**
 * Thai speech from Gemini (owner, 2026-10-11: the วิดีโอนำเสนอ voice). Uses the Google key the
 * AI chain already holds — no other service. Returns 16-bit mono PCM at 24 kHz, as Gemini sends it.
 *
 * Voice Kore, asked to speak casually — the owner picked it from samples the same day.
 */

export const TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const TTS_VOICE = "Kore";
/**
 * The narrator a clip is read by (owner, 2026-10-11): Kore for a woman, Orus for a man — picked
 * from samples. Each is asked for in its own words, so a man's voice is not told to sound like a woman.
 */
export const TTS_VOICES = { F: "Kore", M: "Orus" } as const;
export type Narrator = keyof typeof TTS_VOICES;
export const TTS_RATE = 24000;
const THB_PER_USD = 36;
/** USD per million tokens: text in, audio out (Gemini 2.5 Flash TTS list price) */
const PRICE = { in: 0.5, out: 10 };
const STYLE: Record<Narrator, string> = {
  F: "พูดแบบสบายๆ เป็นกันเอง อบอุ่น เหมือนเล่าให้เพื่อนฟัง ไม่เป็นทางการ: ",
  M: "พูดด้วยเสียงผู้ชาย แบบสบายๆ เป็นกันเอง อบอุ่น น่าเชื่อถือ ไม่เป็นทางการ: ",
};
/**
 * The same ask in the language a line is in (owner, 2026-10-15: iHealthy Ultra clips in the page's
 * five languages). Burmese is asked in English, naming the language, which the voice follows better
 * than an instruction in a script it reads less often.
 */
export type SpeechLang = "th" | "en" | "zh" | "ru" | "my";
const STYLE_IN: Record<Exclude<SpeechLang, "th">, Record<Narrator, string>> = {
  en: {
    F: "Say in a relaxed, warm, friendly way, like telling a friend, not formal: ",
    M: "Say in a man's voice, relaxed, warm, friendly and trustworthy, not formal: ",
  },
  zh: {
    F: "用轻松、亲切、温暖的普通话说，像跟朋友聊天，不要太正式：",
    M: "用男声普通话说，轻松、亲切、温暖、可信，不要太正式：",
  },
  ru: {
    F: "Скажи по-русски непринуждённо, тепло и дружелюбно, как другу, не официально: ",
    M: "Скажи по-русски мужским голосом, непринуждённо, тепло, дружелюбно и уверенно, не официально: ",
  },
  my: {
    F: "Say in Burmese (Myanmar language), in a relaxed, warm, friendly way, not formal: ",
    M: "Say in Burmese (Myanmar language), in a man's voice, relaxed, warm and friendly, not formal: ",
  },
};
const TIMEOUT_MS = 90_000;

export class TtsError extends Error {}
/** Gemini's daily cap on the voice model is used up (owner, 2026-10-12): no line speaks until midnight Pacific */
export class TtsQuotaError extends TtsError {}

interface GeminiAudio {
  candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; details?: unknown[] };
}

/** One line spoken, and what it cost in baht; the cost also goes on the ledger under `task` (attributed by asWho). */
export async function speakThai(text: string, task: string, opts: { narrator?: Narrator; lang?: SpeechLang; fetch?: typeof fetch } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  const narrator = opts.narrator ?? "F";
  const style = !opts.lang || opts.lang === "th" ? STYLE[narrator] : STYLE_IN[opts.lang][narrator];
  const key = await providerKey("google");
  if (!key) throw new TtsError("ยังไม่ได้ตั้งค่าคีย์ Google สำหรับเสียงพากย์");
  const f = opts.fetch ?? fetch;
  let res!: Response;
  let body: GeminiAudio = {};
  let data: string | undefined;
  // now and then the voice answers 200 with no audio in it (seen in Chinese and Burmese, 2026-10-15); asked again, it speaks
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: style + text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICES[narrator] } } },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      console.error("tts: no answer:", e instanceof Error ? e.name : "unknown error");
      throw new TtsError("ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    body = (await res.json().catch(() => ({}))) as GeminiAudio;
    data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (data || !res.ok) break;
  }
  if (!res.ok || !data) {
    console.error(`tts: ${res.status}`, body.error?.message?.slice(0, 200) ?? "no audio");
    // the per-day quota, not the per-minute one: QuotaFailure names it "…PerDay…"
    if (res.status === 429 && JSON.stringify(body.error?.details ?? []).includes("PerDay")) {
      throw new TtsQuotaError("เสียงพากย์ของวันนี้ใช้ครบแล้ว");
    }
    throw new TtsError("ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  const inTok = body.usageMetadata?.promptTokenCount ?? 0;
  const outTok = body.usageMetadata?.candidatesTokenCount ?? 0;
  const costThb = ((inTok * PRICE.in + outTok * PRICE.out) / 1e6) * THB_PER_USD;
  await recordUsage(TTS_MODEL, task, inTok, outTok, costThb);
  return { pcm: Buffer.from(data, "base64"), costThb };
}

/**
 * One line read by the voice a clip asked for (owner, 2026-10-11: the AI-voice switch): an
 * ElevenLabs voice when `voice` names one, Gemini's narrator otherwise. Same PCM either way;
 * the cost goes on the ledger under `task` (ElevenLabs' credits as its output count).
 */
export async function speakLine(text: string, task: string, opts: { narrator?: Narrator; voice?: string; lang?: SpeechLang; fetch?: typeof fetch } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  if (!opts.voice) return speakThai(text, task, opts);
  const key = await providerKey(ELEVENLABS);
  if (!key) throw new TtsError("ยังไม่ได้ตั้งค่าคีย์ ElevenLabs");
  let spoken: Awaited<ReturnType<typeof speakEleven>>;
  try {
    spoken = await speakEleven(key, text, opts.voice, { fetch: opts.fetch });
  } catch (e) {
    console.error("tts eleven:", e instanceof Error ? e.message.slice(0, 200) : "unknown error");
    throw new TtsError("ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  await recordUsage(ELEVEN_MODEL, task, 0, spoken.credits, spoken.costThb);
  return { pcm: spoken.pcm, costThb: spoken.costThb };
}
