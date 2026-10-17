import { describe, expect, it, vi } from "vitest";

// the AI-voice switch (owner, 2026-10-11): an ElevenLabs voice reads the clip when one is picked
const usage = vi.fn();
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => (p === "elevenlabs" ? "sk_test" : "g_test") }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: (...a: unknown[]) => usage(...a) }));

import { speakLine } from "@/lib/ai/tts";
import { ELEVEN_VOICES, elevenVoice, speakEleven } from "@/lib/voice/elevenlabs";
import { existsSync } from "node:fs";
import { videoPrice } from "@/lib/quote-video/make";
import { DEFAULT_PRICES } from "@/lib/wallet/prices";

const pcm = Buffer.alloc(48_000, 1);
const answer = (status = 200) => vi.fn(async () => new Response(status === 200 ? pcm : "nope", { status, headers: { "character-cost": "56" } }));

describe("ElevenLabs speech", () => {
  it("asks for 24 kHz PCM from eleven_v3 in Thai, with the key in its header", async () => {
    const f = answer();
    const out = await speakEleven("sk_test", "สวัสดีครับ", "abc", { fetch: f as unknown as typeof fetch });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/abc?output_format=pcm_24000");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("sk_test");
    expect(JSON.parse(String(init.body))).toEqual({ text: "สวัสดีครับ", model_id: "eleven_v3", language_code: "th" });
    expect(out.pcm.length).toBe(48_000);
    expect(out.credits).toBe(56);
    expect(out.costThb).toBeGreaterThan(0.3);
    expect(out.costThb).toBeLessThan(0.4);
  });

  it("speakLine goes to ElevenLabs only when a voice is named, and puts the credits on the ledger", async () => {
    usage.mockClear();
    const f = answer();
    const out = await speakLine("ทักมาได้เลยครับ", "quote-video-voice", { voice: "abc", fetch: f as unknown as typeof fetch });
    expect(out.pcm.length).toBe(48_000);
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain("api.elevenlabs.io");
    expect(usage).toHaveBeenCalledWith("eleven_v3", "quote-video-voice", 0, 56, out.costThb);
  });

  it("a refusal from ElevenLabs becomes the Thai retry message", async () => {
    await expect(speakLine("x", "t", { voice: "abc", fetch: answer(401) as unknown as typeof fetch })).rejects.toThrow("ทำเสียงพากย์ไม่สำเร็จ");
  });
});

describe("the voices and the price", () => {
  it("knows only the account's voices, each with a sex and a sample", () => {
    expect(elevenVoice("nope")).toBeUndefined();
    for (const v of ELEVEN_VOICES) {
      expect(elevenVoice(v.id)).toBe(v);
      expect(v.sample).toMatch(/^\/voice-samples\/.+\.mp3$/);
    }
  });

  it("an ElevenLabs voice adds ฿2 to the style's price", () => {
    const base = { variant: "WLF19H", age: 35, sex: "M" as const, sumAssured: 1_000_000 };
    expect(videoPrice(base, DEFAULT_PRICES)).toBe(500);
    expect(videoPrice({ ...base, voice: "abc" }, DEFAULT_PRICES)).toBe(700);
    expect(videoPrice({ ...base, style: "motion", voice: "abc" }, DEFAULT_PRICES)).toBe(1200);
    // the owner's own list, not the defaults, once saved
    expect(videoPrice({ ...base, voice: "abc" }, { ...DEFAULT_PRICES, videoClassic: 800, elevenExtra: 300 })).toBe(1100);
  });

  it("lists the eleven shared Thai voices for every member, no cloned ones (owner, 2026-10-13; clones out 2026-10-17)", () => {
    expect(ELEVEN_VOICES).toHaveLength(11);
    expect(ELEVEN_VOICES.filter((v) => v.sex === "F")).toHaveLength(5);
    expect(ELEVEN_VOICES.map((v) => v.name)).not.toContain("luck");
    expect(ELEVEN_VOICES.map((v) => v.name)).not.toContain("บอย");
    for (const v of ELEVEN_VOICES) expect(existsSync(`public${v.sample}`), v.sample).toBe(true);
    expect(new Set(ELEVEN_VOICES.map((v) => v.id)).size).toBe(ELEVEN_VOICES.length);
  });
});
