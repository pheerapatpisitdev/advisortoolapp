/**
 * ElevenLabs Instant Voice Cloning for เสียงของฉัน (owner, 2026-10-15, mockup
 * https://claude.ai/artifact/8aEHEDbMbeCJXiaKa3ie7m): add a voice from an agent's takes, delete
 * it, and count the account's voice slots. The key is the same one the clips speak with
 * (providerKey(ELEVENLABS)); speaking a cloned voice is elevenlabs.ts's speakEleven, as for any
 * other voice.
 */

const API = "https://api.elevenlabs.io/v1";

export interface Take { name: string; wav: Buffer }

/** a new cloned voice from the takes; its id */
export async function addVoice(apiKey: string, name: string, takes: Take[], labels: Record<string, string>, opts: { fetch?: typeof fetch } = {}): Promise<string> {
  const form = new FormData();
  form.append("name", name);
  form.append("description", "เสียงของตัวแทน (เสียงของฉัน) อัดในแอปพร้อมความยินยอม");
  form.append("labels", JSON.stringify(labels));
  form.append("remove_background_noise", "true");
  for (const t of takes) form.append("files", new Blob([new Uint8Array(t.wav)], { type: "audio/wav" }), t.name);
  const res = await (opts.fetch ?? fetch)(`${API}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`api.elevenlabs.io ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { voice_id?: string };
  if (!body.voice_id) throw new Error("api.elevenlabs.io: no voice_id");
  return body.voice_id;
}

/** remove a cloned voice from the account; a voice already gone counts as removed */
export async function deleteVoice(apiKey: string, voiceId: string, opts: { fetch?: typeof fetch } = {}): Promise<void> {
  const res = await (opts.fetch ?? fetch)(`${API}/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`api.elevenlabs.io ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export interface Slots { used: number; limit: number }

/**
 * How many voice slots the account has and how many are taken. The subscription names the
 * limit and the slots used; the cloned voices are counted too, whichever is more. Voices added
 * from the library (professional, generated) take no clone slot, so they are not counted: the
 * 23 library voices on the account read as 25 of 10 and turned every clone away (2026-10-15).
 */
export async function voiceSlots(apiKey: string, opts: { fetch?: typeof fetch } = {}): Promise<Slots> {
  const f = opts.fetch ?? fetch;
  const [sub, voices] = await Promise.all([
    f(`${API}/user/subscription`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10_000) }),
    f(`${API}/voices`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!sub.ok) throw new Error(`api.elevenlabs.io ${sub.status}`);
  if (!voices.ok) throw new Error(`api.elevenlabs.io ${voices.status}`);
  const s = (await sub.json()) as { voice_limit?: number; voice_slots_used?: number };
  const v = (await voices.json()) as { voices?: { category?: string }[] };
  const own = (v.voices ?? []).filter((x) => x.category === "cloned").length;
  return { used: Math.max(own, s.voice_slots_used ?? 0), limit: s.voice_limit ?? 0 };
}

/** 16-bit mono PCM (as speakEleven returns it) as a WAV file */
export function pcmToWav(pcm: Buffer, rate = 24000): Buffer {
  const len = pcm.length - (pcm.length % 2);
  const out = Buffer.alloc(44 + len);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + len, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(len, 40);
  pcm.copy(out, 44, 0, len);
  return out;
}

/**
 * Whether a buffer is the kind of take the browser makes: a RIFF/WAVE file of 16-bit mono PCM,
 * and how many seconds it plays. Anything else is refused before it reaches storage.
 */
export function wavInfo(buf: Buffer): { seconds: number } | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  if (buf.readUInt16LE(20) !== 1 || buf.readUInt16LE(22) !== 1 || buf.readUInt16LE(34) !== 16) return null;
  const rate = buf.readUInt32LE(24);
  if (rate < 8000 || rate > 48000) return null;
  return { seconds: (buf.length - 44) / 2 / rate };
}
