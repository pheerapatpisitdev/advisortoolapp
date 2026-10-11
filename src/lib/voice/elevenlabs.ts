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
