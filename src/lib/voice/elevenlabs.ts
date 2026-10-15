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
 * The ElevenLabs voices a clip can be read by. `sex` sets the sentence endings (ครับ / ค่ะ);
 * `sample` is the clip under public/voice-samples; `adminOnly`: the two cloned on the account,
 * the owner's alone (owner, 2026-10-13). The other eleven are ElevenLabs' shared Thai voices,
 * open to every member (owner, 2026-10-13: "เปิดให้ทุกคนเลือกเสียงได้ อิสระ"; samples
 * https://claude.ai/artifact/S5wegf68PAyznqmsjX16Xu). A shared voice speaks by its id without
 * being added to the account.
 */
/** `mine`: the agent's own cloned voice (เสียงของฉัน, lib/voice/mine.ts), listed for them alone */
export interface ElevenChoice { id: string; name: string; sex: "F" | "M"; tag: string; sample: string; adminOnly?: boolean; mine?: true }
export const ELEVEN_VOICES: ElevenChoice[] = [
  { id: "XLXcyPK1jTjw1pYLLcM9", name: "สมชาย", sex: "M", tag: "อบอุ่น ทุ้ม", sample: "/voice-samples/somchai.mp3" },
  { id: "deCz1h6mjB7HnY2xQz08", name: "เดชา", sex: "M", tag: "ทุ้มลึก มั่นใจ", sample: "/voice-samples/decha.mp3" },
  { id: "tAV9ucNkXgK2k9TLxWkM", name: "อนันต์", sex: "M", tag: "ทุ้ม หนักแน่น", sample: "/voice-samples/anan.mp3" },
  { id: "FaUQoAqt8WX5mfvrvb3A", name: "ปรีชา", sex: "M", tag: "ใจเย็น ชัดเจน", sample: "/voice-samples/preecha.mp3" },
  { id: "H9eYlNHpm1vah6PPgYAk", name: "เอกรัฐ", sex: "M", tag: "สบายๆ เป็นกันเอง", sample: "/voice-samples/ekkarat.mp3" },
  { id: "MeUerI8vM5Ce2GSTXsRT", name: "ชัย", sex: "M", tag: "เร็ว สนุก", sample: "/voice-samples/chai.mp3" },
  { id: "nealpwJT5tCyJFKDzEq8", name: "อ้อม", sex: "F", tag: "นุ่ม มั่นใจ", sample: "/voice-samples/aom.mp3" },
  { id: "B4NdgwdU97lHqA8Udh2D", name: "กัญญา", sex: "F", tag: "อบอุ่น ใจเย็น", sample: "/voice-samples/kanya.mp3" },
  { id: "v2NF9R77fF8wZRdbGYTg", name: "ศิริพร", sex: "F", tag: "อ่อนโยน วัยกลางคน", sample: "/voice-samples/siriporn.mp3" },
  { id: "mYcpTKg1oj1H5CtzUZNO", name: "มาลี", sex: "F", tag: "สดใส ร่าเริง", sample: "/voice-samples/malee.mp3" },
  { id: "RIc0VzgLsI8EhceUkZx4", name: "หนึ่ง", sex: "F", tag: "สดใส กระฉับกระเฉง", sample: "/voice-samples/nueng.mp3" },
  { id: "1r5VsbiRKWnEIavNM4dm", name: "luck", sex: "M", tag: "เสียงโคลน", sample: "/voice-samples/luck.mp3", adminOnly: true },
  { id: "361auDRmyl5vhRNcV6Xy", name: "บอย", sex: "M", tag: "เสียงโคลน", sample: "/voice-samples/boy.mp3", adminOnly: true },
];
/** the voices this viewer may pick: the cloned two for the owner only */
export const elevenVoicesFor = (owner: boolean): ElevenChoice[] => ELEVEN_VOICES.filter((v) => owner || !v.adminOnly);

/**
 * Credits left this month (owner, 2026-10-13): a clip is not started on an ElevenLabs voice when
 * fewer than this are left — it would fail half-spoken. About six ~50-second clips.
 */
export const ELEVEN_RESERVE = 1500;
export async function elevenCreditsLeft(apiKey: string): Promise<number> {
  const res = await fetch(`${API}/user/subscription`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`api.elevenlabs.io ${res.status}`);
  const s = await res.json();
  return Number(s.character_limit) - Number(s.character_count);
}
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
