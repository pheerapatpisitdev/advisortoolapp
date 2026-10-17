import { describe, expect, it, vi } from "vitest";

// Gemini's voice cannot be used (off, no key, day cap full): a Thai clip is read by ElevenLabs instead
// (owner, 2026-10-17: เสียง ก อ้อม / สมชาย, price unchanged)
const keys: Record<string, string | null> = { google: "g_test", elevenlabs: "sk_test" };
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => keys[p] ?? null }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));

import { FALLBACK_VOICE, geminiUsable, speakClip } from "@/lib/quote-video/speak";
import { elevenVoice } from "@/lib/voice/elevenlabs";

const pcm = Buffer.alloc(48_000, 1);
const geminiOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString("base64") } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 100 } }));
const geminiFull = () => new Response(JSON.stringify({ error: { message: "quota", details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel" }] }] } }), { status: 429 });
const elevenOk = () => new Response(pcm, { headers: { "character-cost": "40" } });
const credits = (left: number) => new Response(JSON.stringify({ character_limit: 40_000, character_count: 40_000 - left }));

/** a fetch that answers by host, and remembers who was asked */
function net(gemini: () => Response, left = 30_000) {
  const asked: string[] = [];
  const f = vi.fn(async (url: string) => {
    asked.push(url.includes("generativelanguage") ? "gemini" : url.includes("/user/subscription") ? "credits" : url.split("/text-to-speech/")[1].split("?")[0]);
    if (url.includes("generativelanguage")) return gemini();
    if (url.includes("/user/subscription")) return credits(left);
    return elevenOk();
  });
  return { f: f as unknown as typeof fetch, asked };
}
const pool = async <T, R>(items: T[], _n: number, fn: (t: T, i: number) => Promise<R>) => Promise.all(items.map(fn));
const base = { task: "t", pool };

describe("the fallback voices", () => {
  it("are อ้อม for a woman and สมชาย for a man, both on the account's shared list", () => {
    expect(elevenVoice(FALLBACK_VOICE.F)?.name).toBe("อ้อม");
    expect(elevenVoice(FALLBACK_VOICE.M)?.name).toBe("สมชาย");
  });
});

describe("speakClip", () => {
  it("speaks with Gemini and never touches ElevenLabs while Gemini works", async () => {
    const { f, asked } = net(geminiOk);
    const out = await speakClip(["หนึ่ง", "สอง"], { ...base, narrator: "F", lang: "th", fetch: f });
    expect(out.fellBackTo).toBeNull();
    expect(out.spoken).toHaveLength(2);
    expect(asked.every((a) => a === "gemini")).toBe(true);
  });

  it("a full day cap switches the whole Thai clip to อ้อม", async () => {
    const { f, asked } = net(geminiFull);
    const out = await speakClip(["หนึ่ง", "สอง"], { ...base, narrator: "F", lang: "th", fetch: f });
    expect(out.fellBackTo?.name).toBe("อ้อม");
    expect(out.spoken).toHaveLength(2);
    expect(asked.filter((a) => a === FALLBACK_VOICE.F)).toHaveLength(2);
  });

  it("a man's clip goes to สมชาย", async () => {
    const { f } = net(geminiFull);
    const out = await speakClip(["หนึ่ง"], { ...base, narrator: "M", lang: "th", fetch: f });
    expect(out.fellBackTo?.name).toBe("สมชาย");
  });

  it("Gemini off in /admin/ai (no key) switches without asking Google at all", async () => {
    keys.google = null;
    const { f, asked } = net(geminiOk);
    const out = await speakClip(["หนึ่ง"], { ...base, narrator: "F", lang: "th", fetch: f });
    keys.google = "g_test";
    expect(out.fellBackTo?.name).toBe("อ้อม");
    expect(asked).not.toContain("gemini");
  });

  it("a clip that already named an ElevenLabs voice is read by it and is not a switch", async () => {
    const { f, asked } = net(geminiFull);
    const out = await speakClip(["หนึ่ง"], { ...base, narrator: "M", lang: "th", voice: "abc", fetch: f });
    expect(out.fellBackTo).toBeNull();
    expect(asked).toEqual(["abc"]);
  });

  it("another language keeps failing as before (Thai voices are not tried on it yet)", async () => {
    const { f } = net(geminiFull);
    await expect(speakClip(["hello"], { ...base, narrator: "F", lang: "en", fetch: f })).rejects.toThrow();
  });

  it("with ElevenLabs short of credits the original Gemini error stands", async () => {
    const { f } = net(geminiFull, 100);
    await expect(speakClip(["หนึ่ง"], { ...base, narrator: "F", lang: "th", fetch: f })).rejects.toThrow("ใช้ครบแล้ว");
  });

  it("with no ElevenLabs key the original Gemini error stands", async () => {
    keys.elevenlabs = null;
    const { f } = net(geminiFull);
    const e = await speakClip(["หนึ่ง"], { ...base, narrator: "F", lang: "th", fetch: f }).catch((x) => x);
    keys.elevenlabs = "sk_test";
    expect(e.message).toContain("ใช้ครบแล้ว");
  });
});

describe("geminiUsable (the form's notice)", () => {
  it("is false when the key is off, true when it is on", async () => {
    expect(await geminiUsable()).toBe(true);
    keys.google = null;
    expect(await geminiUsable()).toBe(false);
    keys.google = "g_test";
  });
});

import { voiceNotice } from "@/lib/quote-video/voice-quota";
describe("voiceNotice (the form's note)", () => {
  it("a Thai clip with a reader waiting gets a green note and is not blocked", () => {
    const n = voiceNotice({ clock: "14:00", fallback: true }, true);
    expect(n).toMatchObject({ ok: true, blocked: false });
    expect(n.text).toContain("อ้อม");
  });
  it("without a reader, or in another language, the old block stays", () => {
    expect(voiceNotice({ clock: "14:00", fallback: false }, true)).toMatchObject({ ok: false, blocked: true, text: expect.stringContaining("14:00") });
    expect(voiceNotice({ clock: "14:00", fallback: true }, false).blocked).toBe(true);
    expect(voiceNotice({ clock: null, fallback: false }, true).text).toContain("ElevenLabs");
  });
});
