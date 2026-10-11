import { providerKey } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";

/**
 * Thai speech from Gemini (owner, 2026-10-11: the วิดีโอนำเสนอ voice). Uses the Google key the
 * AI chain already holds — no other service. Returns 16-bit mono PCM at 24 kHz, as Gemini sends it.
 *
 * Voice Kore, asked to speak casually — the owner picked it from samples the same day.
 */

export const TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const TTS_VOICE = "Kore";
export const TTS_RATE = 24000;
const THB_PER_USD = 36;
/** USD per million tokens: text in, audio out (Gemini 2.5 Flash TTS list price) */
const PRICE = { in: 0.5, out: 10 };
const STYLE = "พูดแบบสบายๆ เป็นกันเอง อบอุ่น เหมือนเล่าให้เพื่อนฟัง ไม่เป็นทางการ: ";
const TIMEOUT_MS = 90_000;

export class TtsError extends Error {}

interface GeminiAudio {
  candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/** One line spoken; the cost goes on the ledger under `task` (attributed by asWho). */
export async function speakThai(text: string, task: string, opts: { voice?: string; fetch?: typeof fetch } = {}): Promise<Buffer> {
  const key = await providerKey("google");
  if (!key) throw new TtsError("ยังไม่ได้ตั้งค่าคีย์ Google สำหรับเสียงพากย์");
  const f = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: STYLE + text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice ?? TTS_VOICE } } },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("tts: no answer:", e instanceof Error ? e.name : "unknown error");
    throw new TtsError("ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  const body = (await res.json().catch(() => ({}))) as GeminiAudio;
  const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!res.ok || !data) {
    console.error(`tts: ${res.status}`, body.error?.message?.slice(0, 200) ?? "no audio");
    throw new TtsError("ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  const inTok = body.usageMetadata?.promptTokenCount ?? 0;
  const outTok = body.usageMetadata?.candidatesTokenCount ?? 0;
  await recordUsage(TTS_MODEL, task, inTok, outTok, ((inTok * PRICE.in + outTok * PRICE.out) / 1e6) * THB_PER_USD);
  return Buffer.from(data, "base64");
}
