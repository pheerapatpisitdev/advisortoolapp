import { providerKey, voiceLane } from "@/lib/ai/client";
import { recordUsage } from "@/lib/ai/ledger";
import { ELEVEN_MODEL, ELEVENLABS, speakEleven } from "@/lib/voice/elevenlabs";
import { voiceDay } from "@/lib/quote-video/voice-quota";
import { googleToken, parseGcpKey, type GcpKey } from "@/lib/video/engines/cloudrun";

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

/** a per-minute 429 waited out this many times, a little longer each time */
const PER_MINUTE_TRIES = 3;
export const PER_MINUTE_WAIT_MS = 4_000;

const styleOf = (narrator: Narrator, lang?: SpeechLang) => (!lang || lang === "th" ? STYLE[narrator] : STYLE_IN[lang][narrator]);

const RETRY = "ทำเสียงพากย์ไม่สำเร็จ ลองใหม่อีกครั้ง";

/**
 * One line spoken, and what it cost in baht; the cost also goes on the ledger under `task` (attributed by asWho).
 * `gemini` names one of the 30 voices (src/lib/voice/gemini.ts); without it the narrator's own, Kore or Orus.
 * `wait: false` gives up on a busy minute at once instead of waiting it out, for a caller with somewhere else to go.
 */
export async function speakThai(text: string, task: string, opts: { narrator?: Narrator; gemini?: string; lang?: SpeechLang; fetch?: typeof fetch; wait?: boolean } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  const narrator = opts.narrator ?? "F";
  const style = styleOf(narrator, opts.lang);
  const tries = opts.wait === false ? 0 : PER_MINUTE_TRIES;
  const key = await providerKey("google");
  if (!key) throw new TtsError("ยังไม่ได้ตั้งค่าคีย์ Google สำหรับเสียงพากย์");
  const f = opts.fetch ?? fetch;
  let res!: Response;
  let body: GeminiAudio = {};
  let data: string | undefined;
  // now and then the voice answers 200 with no audio in it (seen in Chinese and Burmese, 2026-10-15); asked again, it speaks.
  // A per-minute 429 is waited out and asked again, three times, before the line counts as failed —
  // one line hitting it switched the whole clip to ElevenLabs (owner, 2026-10-18)
  let busy = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: style + text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.gemini ?? TTS_VOICES[narrator] } } },
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
    if (res.status === 429 && !JSON.stringify(body.error?.details ?? []).includes("PerDay") && busy < tries) {
      busy++;
      await new Promise((r) => setTimeout(r, PER_MINUTE_WAIT_MS * busy));
      attempt--;
      continue;
    }
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
 * The same Gemini voice through Google Cloud Text-to-Speech (owner, 2026-10-20, mockup
 * https://claude.ai/artifact/YTAVDuGqVAhGzVYeLvU3Sa): limited per minute, with no 100-a-day cap.
 * Signed in with the service-account key Cloud Run uses ("gcp"), which holds roles/aiplatform.user.
 * Same 30 voice names, same price; the style goes in its own `prompt` field so it is never read out.
 */
export const CLOUD_TTS_MODEL = "gemini-2.5-flash-tts";
const CLOUD_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const LANG_CODE: Record<SpeechLang, string> = { th: "th-TH", en: "en-US", zh: "cmn-CN", ru: "ru-RU", my: "my-MM" };
/** a second of speech is billed as this many audio tokens (Google's Gemini-TTS price list) */
const AUDIO_TOKENS_PER_SEC = 25;

interface CloudAudio { audioContent?: string; error?: { message?: string } }

/**
 * A line Cloud turned away for a full minute is asked again in the next one, this many times: about
 * three minutes at most, inside the 300 s a clip's request may run (studio pages' maxDuration).
 */
export const CLOUD_BUSY_TRIES = 3;

/** to the start of the next minute, plus 1–4 s so the lines that waited together do not all ask at once */
export function nextMinuteWait(now = Date.now(), jitter = Math.random()): number {
  return 60_000 - (now % 60_000) + 1_000 + Math.floor(jitter * 3_000);
}

/** the Cloud key, when one is stored and readable */
export async function cloudVoiceKey(): Promise<GcpKey | null> {
  const stored = await providerKey("gcp").catch(() => null);
  return stored ? parseGcpKey(stored) : null;
}

/** the samples of a WAV file (Cloud's LINEAR16 comes with a header); anything else is taken as samples already */
export function wavPcm(b: Buffer): Buffer {
  if (b.length < 12 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") return b;
  let at = 12;
  while (at + 8 <= b.length) {
    const size = b.readUInt32LE(at + 4);
    if (b.toString("ascii", at, at + 4) === "data") return b.subarray(at + 8, Math.min(b.length, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  return b.subarray(44);
}

export async function speakCloud(text: string, task: string, opts: { narrator?: Narrator; gemini?: string; lang?: SpeechLang; fetch?: typeof fetch; key?: GcpKey | null } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  const narrator = opts.narrator ?? "F";
  const style = styleOf(narrator, opts.lang).replace(/\s*[:：]\s*$/, "");
  const k = opts.key ?? (await cloudVoiceKey());
  if (!k) throw new TtsError("ยังไม่ได้ตั้งค่า Google Cloud สำหรับเสียงพากย์");
  const f = opts.fetch ?? fetch;
  let token: string;
  try {
    token = await googleToken(k, { fetch: f });
  } catch (e) {
    console.error("tts cloud: no token:", e instanceof Error ? e.message : "unknown error");
    throw new TtsError(RETRY);
  }
  let res!: Response;
  let body: CloudAudio = {};
  let busy = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await f(CLOUD_TTS_URL, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}`, "x-goog-user-project": k.projectId },
        body: JSON.stringify({
          input: { text, prompt: style },
          voice: { languageCode: LANG_CODE[opts.lang ?? "th"], name: opts.gemini ?? TTS_VOICES[narrator], modelName: CLOUD_TTS_MODEL },
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: TTS_RATE },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      console.error("tts cloud: no answer:", e instanceof Error ? e.name : "unknown error");
      throw new TtsError(RETRY);
    }
    body = (await res.json().catch(() => ({}))) as CloudAudio;
    // Cloud's minute is full (5 a minute on this project, first live clips 2026-10-20): wait for the
    // next one rather than fail the clip (owner: "wait until the next minute so the clip still finishes")
    if (res.status === 429 && busy < CLOUD_BUSY_TRIES) {
      busy++;
      const wait = nextMinuteWait();
      console.error(`tts cloud: minute full, waiting ${Math.round(wait / 1000)} s (${busy}/${CLOUD_BUSY_TRIES})`);
      await new Promise((r) => setTimeout(r, wait));
      attempt--;
      continue;
    }
    if (body.audioContent || !res.ok) break;
  }
  if (!res.ok || !body.audioContent) {
    console.error(`tts cloud: ${res.status}`, body.error?.message?.slice(0, 200) ?? "no audio");
    throw new TtsError(RETRY);
  }
  const pcm = wavPcm(Buffer.from(body.audioContent, "base64"));
  // Cloud sends no token count: the audio is billed by its length, the words in by their size (a few satang at most)
  const outTok = Math.round((pcm.length / (TTS_RATE * 2)) * AUDIO_TOKENS_PER_SEC);
  const inTok = (style + text).length;
  const costThb = ((inTok * PRICE.in + outTok * PRICE.out) / 1e6) * THB_PER_USD;
  await recordUsage(CLOUD_TTS_MODEL, task, inTok, outTok, costThb);
  return { pcm, costThb };
}

/** the Gemini API's day cap as this server last saw it: lines go straight to Cloud until it turns over */
let apiFullUntil = 0;
/** for tests: forget the day cap seen */
export const forgetApiFull = () => { apiFullUntil = 0; };

/**
 * A line in a Gemini voice, the two ways to it in the order of the lane เสียงพากย์คลิป on ตั้งค่า AI
 * (owner, 2026-10-21; until then and by default the owner's order of 2026-10-20: 1 the Gemini API,
 * 2 the same voice on Cloud). A way switched off there is not asked. Lines of one clip may come
 * from either; it is the same model and voice name. The API waits out a busy minute only when it
 * is the last way left; Cloud with a way after it hands its failure on rather than ending the line.
 */
export async function speakGemini(text: string, task: string, opts: { narrator?: Narrator; gemini?: string; lang?: SpeechLang; fetch?: typeof fetch } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  const [apiKey, cloud, lane] = await Promise.all([providerKey("google").catch(() => null), cloudVoiceKey(), voiceLane().catch(() => ["gemini-api", "gemini-cloud"])]);
  // a way that cannot be asked now is left out, so the last one asked is the one that may wait
  const ways = lane.filter((w) => (w === "gemini-api" && apiKey && Date.now() >= apiFullUntil) || (w === "gemini-cloud" && cloud));
  if (ways.length === 0) {
    if (!lane.some((w) => w === "gemini-api" || w === "gemini-cloud")) throw new TtsError("ปิดเสียง Gemini ไว้ในลำดับหลักและสำรอง");
    // nothing on can be asked: the API says why in its own words (no key, the day's cap)
    if (lane.includes("gemini-api")) return speakThai(text, task, opts);
    throw new TtsError("ยังไม่ได้ตั้งค่า Google Cloud สำหรับเสียงพากย์");
  }
  for (const [i, way] of ways.entries()) {
    const last = i === ways.length - 1;
    try {
      return way === "gemini-api"
        ? await speakThai(text, task, last ? opts : { ...opts, wait: false })
        : await speakCloud(text, task, { ...opts, key: cloud });
    } catch (e) {
      if (!(e instanceof TtsError) || last) throw e;
      if (way === "gemini-api" && e instanceof TtsQuotaError) apiFullUntil = voiceDay().until.getTime();
      console.error(`tts: ${way} not usable, line goes to ${ways[i + 1]} -`, e.message);
    }
  }
  throw new TtsError(RETRY);
}

/**
 * One line read by the voice a clip asked for (owner, 2026-10-11: the AI-voice switch): an
 * ElevenLabs voice when `voice` names one, Gemini's narrator otherwise (API, then Cloud). Same PCM either way;
 * the cost goes on the ledger under `task` (ElevenLabs' credits as its output count).
 */
export async function speakLine(text: string, task: string, opts: { narrator?: Narrator; gemini?: string; voice?: string; lang?: SpeechLang; fetch?: typeof fetch } = {}): Promise<{ pcm: Buffer; costThb: number }> {
  if (!opts.voice) return speakGemini(text, task, opts);
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
