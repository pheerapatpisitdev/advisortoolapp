/**
 * ElevenLabs, a voice-over company (owner, 2026-10-11, option ข: the key first, then a voice
 * choice for วิดีโอนำเสนอ). Not a chat model and not in CALLERS: it turns words into speech,
 * so it never joins the bot's fallback chain. Its key lives with the AI keys as "elevenlabs".
 */
export const ELEVENLABS = "elevenlabs";

const API = "https://api.elevenlabs.io/v1";

export interface ElevenVoice { voice_id: string; name: string; labels?: Record<string, string> }

/**
 * The voices the account can use. Costs no credit, so the key check asks this rather than
 * speaking a word.
 */
export async function listVoices(apiKey: string, signal?: AbortSignal): Promise<ElevenVoice[]> {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey }, signal });
  if (!res.ok) throw new Error(`api.elevenlabs.io ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return Array.isArray(data.voices) ? data.voices : [];
}

/** the model that reads Thai (owner, 2026-10-11: picked from samples) */
export const ELEVEN_MODEL = "eleven_v3";
/**
 * What one credit costs, in baht: the Starter plan, $6.42 a month with tax for 40,000 credits
 * (the account's own figures, 2026-10-11). A clip's lines come to a few dozen credits each.
 */
const THB_PER_CREDIT = (6.42 / 40_000) * 36;
const TIMEOUT_MS = 90_000;

/**
 * The ElevenLabs voices a clip can be read by (owner, 2026-10-11): the two cloned on the account.
 * `sex` sets the sentence endings (ครับ / ค่ะ); `sample` is the clip under public/voice-samples.
 */
export interface ElevenChoice { id: string; name: string; sex: "F" | "M"; tag: string; sample: string }
export const ELEVEN_VOICES: ElevenChoice[] = [
  { id: "1r5VsbiRKWnEIavNM4dm", name: "luck", sex: "M", tag: "ผู้ชาย · เสียงโคลน", sample: "/voice-samples/luck.mp3" },
  { id: "361auDRmyl5vhRNcV6Xy", name: "บอย", sex: "M", tag: "ผู้ชาย · เสียงโคลน", sample: "/voice-samples/boy.mp3" },
];
export const elevenVoice = (id: string | undefined): ElevenChoice | undefined => ELEVEN_VOICES.find((v) => v.id === id);

/**
 * One line spoken by an ElevenLabs voice: 16-bit mono PCM at 24 kHz, the same shape Gemini's
 * comes in, so the clip's mixing does not care which read it. Throws on any failure.
 */
export async function speakEleven(apiKey: string, text: string, voiceId: string, opts: { fetch?: typeof fetch } = {}): Promise<{ pcm: Buffer; credits: number; costThb: number }> {
  const f = opts.fetch ?? fetch;
  const res = await f(`${API}/text-to-speech/${voiceId}?output_format=pcm_24000`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, language_code: "th" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`api.elevenlabs.io ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const pcm = Buffer.from(await res.arrayBuffer());
  if (pcm.length < 2) throw new Error("api.elevenlabs.io: no audio");
  const credits = Number(res.headers.get("character-cost")) || text.length;
  return { pcm, credits, costThb: credits * THB_PER_CREDIT };
}
