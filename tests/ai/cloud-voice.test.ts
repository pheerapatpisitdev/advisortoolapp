import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The owner's order for a Gemini voice (2026-10-20): 1 the Gemini API, 2 the same voice on Google
// Cloud, 3 ElevenLabs. Cloud has no 100-a-day cap, so the API's cap no longer stops a clip.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const GCP = JSON.stringify({ client_email: "clip-render@p.iam.gserviceaccount.com", private_key: privateKey, project_id: "advisortool-video", region: "asia-southeast1", job: "clip" });
const keys: Record<string, string | null> = { google: "g_test", elevenlabs: "sk_test", gcp: GCP };
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => keys[p] ?? null }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));

import { CLOUD_TTS_MODEL, forgetApiFull, speakGemini, wavPcm } from "@/lib/ai/tts";
import { cloudUsable, speakClip } from "@/lib/quote-video/speak";

const pcm = Buffer.alloc(48_000, 1);
/** a 44-byte WAV header in front of the samples, as Cloud's LINEAR16 sends them */
function wav(samples: Buffer): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + samples.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}
const apiOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString("base64") } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 100 } }));
const apiFull = () => new Response(JSON.stringify({ error: { message: "quota", details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel" }] }] } }), { status: 429 });
const apiBusy = () => new Response(JSON.stringify({ error: { message: "quota", details: [{ violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel" }] }] } }), { status: 429 });
const cloudOk = () => new Response(JSON.stringify({ audioContent: wav(pcm).toString("base64") }));
const cloudDown = () => new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });

/** a fetch that answers by host, and remembers who was asked and what Cloud was sent */
function net(api: () => Response, cloud: () => Response = cloudOk) {
  const asked: string[] = [];
  const sent: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("generativelanguage")) { asked.push("api"); return api(); }
    if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    if (url.includes("texttospeech")) {
      asked.push("cloud");
      sent.push({ body: JSON.parse(String(init?.body)), headers: init?.headers as Record<string, string> });
      return cloud();
    }
    if (url.includes("/user/subscription")) return new Response(JSON.stringify({ character_limit: 40_000, character_count: 0 }));
    asked.push("eleven");
    return new Response(pcm, { headers: { "character-cost": "40" } });
  });
  return { f: f as unknown as typeof fetch, asked, sent };
}
const pool = async <T, R>(items: T[], _n: number, fn: (t: T, i: number) => Promise<R>) => Promise.all(items.map(fn));

beforeEach(() => forgetApiFull());

describe("speakGemini: API first, Cloud second", () => {
  it("uses the API alone while it works", async () => {
    const { f, asked } = net(apiOk);
    const r = await speakGemini("สวัสดีค่ะ", "t", { fetch: f });
    expect(r.pcm.length).toBe(pcm.length);
    expect(asked).toEqual(["api"]);
  });

  it("the API's day cap sends the line to Cloud, and later lines skip the API until it turns over", async () => {
    const { f, asked } = net(apiFull);
    const r = await speakGemini("หนึ่ง", "t", { fetch: f });
    expect(r.pcm.equals(pcm)).toBe(true); // the WAV header is gone
    await speakGemini("สอง", "t", { fetch: f });
    expect(asked).toEqual(["api", "cloud", "cloud"]);
  });

  it("a busy minute on the API goes to Cloud at once, without waiting it out", async () => {
    const { f, asked } = net(apiBusy);
    await speakGemini("หนึ่ง", "t", { fetch: f });
    expect(asked).toEqual(["api", "cloud"]);
  });

  it("the API key off in /admin/ai goes straight to Cloud", async () => {
    keys.google = null;
    const { f, asked } = net(apiOk);
    await speakGemini("หนึ่ง", "t", { fetch: f });
    keys.google = "g_test";
    expect(asked).toEqual(["cloud"]);
  });

  it("asks Cloud for the same voice and language, the style in its own field, signed in with the Cloud key", async () => {
    const { f, sent } = net(apiFull);
    await speakGemini("หนึ่ง", "t", { narrator: "M", gemini: "Puck", fetch: f });
    await speakGemini("hello", "t", { narrator: "F", lang: "en", fetch: f });
    const [th, en] = sent;
    expect(th.body.voice).toEqual({ languageCode: "th-TH", name: "Puck", modelName: CLOUD_TTS_MODEL });
    expect(th.body.input).toMatchObject({ text: "หนึ่ง", prompt: expect.stringContaining("เสียงผู้ชาย") });
    expect((th.body.input as { prompt: string }).prompt).not.toMatch(/[:：]\s*$/);
    expect(th.body.audioConfig).toEqual({ audioEncoding: "LINEAR16", sampleRateHertz: 24000 });
    expect(th.headers).toMatchObject({ Authorization: "Bearer tok", "x-goog-user-project": "advisortool-video" });
    expect(en.body.voice).toMatchObject({ languageCode: "en-US", name: "Kore" });
  });

  it("without a Cloud key it is the API alone, its error as before", async () => {
    keys.gcp = null;
    const { f, asked } = net(apiFull);
    const e = await speakGemini("หนึ่ง", "t", { fetch: f }).catch((x) => x);
    keys.gcp = GCP;
    expect(e.message).toContain("ใช้ครบแล้ว");
    expect(asked).toEqual(["api"]);
  });
});

describe("speakClip: ElevenLabs only when both Gemini ways fail", () => {
  it("API full and Cloud down: the whole Thai clip goes to อ้อม", async () => {
    vi.useFakeTimers();
    const { f, asked } = net(apiFull, cloudDown);
    const said = speakClip(["หนึ่ง", "สอง"], { task: "t", pool, narrator: "F", lang: "th", fetch: f });
    await vi.advanceTimersByTimeAsync(60_000);
    const out = await said;
    vi.useRealTimers();
    expect(out.fellBackTo?.name).toBe("อ้อม");
    expect(asked.filter((a) => a === "eleven")).toHaveLength(2);
  });

  it("API full and Cloud up: no switch, every line Gemini", async () => {
    const { f, asked } = net(apiFull);
    const out = await speakClip(["หนึ่ง", "สอง"], { task: "t", pool, narrator: "F", lang: "th", fetch: f });
    expect(out.fellBackTo).toBeNull();
    expect(asked).not.toContain("eleven");
  });
});

describe("cloudUsable (no day cap to warn about)", () => {
  it("is true with the Cloud key, false without", async () => {
    expect(await cloudUsable()).toBe(true);
    keys.gcp = null;
    expect(await cloudUsable()).toBe(false);
    keys.gcp = GCP;
  });
});

describe("wavPcm", () => {
  it("keeps only the samples of a WAV, and leaves bare samples alone", () => {
    expect(wavPcm(wav(pcm)).equals(pcm)).toBe(true);
    expect(wavPcm(pcm)).toBe(pcm);
  });
});
