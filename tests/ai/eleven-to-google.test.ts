import { describe, expect, it, vi } from "vitest";

// A clip whose chosen ElevenLabs voice cannot speak is read again in Google's voice of the same sex
// (owner, 2026-10-20, mockup https://claude.ai/artifact/J34jDCp3JK3adTytUcZ36f, ก ก ก ก)
const keys: Record<string, string | null> = { google: "g_test", elevenlabs: "sk_test" };
vi.mock("@/lib/ai/client", () => ({ providerKey: async (p: string) => keys[p] ?? null }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));

import { elevenReady, speakClip } from "@/lib/quote-video/speak";
import { voiceRefusal } from "@/lib/quote-video/voice-check";
import { ELEVEN_TO_GOOGLE, googleInPlace } from "@/lib/quote-video/voice-quota";

const pcm = Buffer.alloc(48_000, 1);
const geminiOk = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: pcm.toString("base64") } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 100 } }));
const account = (o: { tier?: string; left?: number }) => () => new Response(JSON.stringify({ tier: o.tier ?? "starter", character_limit: 40_000, character_count: 40_000 - (o.left ?? 30_000) }));
const paidOnly = () => new Response(JSON.stringify({ detail: { code: "paid_plan_required", message: "Free users cannot use library voices via the API." } }), { status: 402 });

/** a fetch that answers by host, and remembers who was asked and which Gemini voice */
function net(sub: () => Response, eleven: () => Response = () => new Response(pcm, { headers: { "character-cost": "40" } })) {
  const asked: string[] = [];
  const voices: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("generativelanguage")) {
      asked.push("gemini");
      voices.push(JSON.parse(String(init?.body)).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName);
      return geminiOk();
    }
    if (url.includes("/user/subscription")) { asked.push("account"); return sub(); }
    asked.push("eleven");
    return eleven();
  });
  return { f: f as unknown as typeof fetch, asked, voices };
}
const pool = async <T, R>(items: T[], _n: number, fn: (t: T, i: number) => Promise<R>) => Promise.all(items.map(fn));
const base = { task: "t", pool, lang: "th" as const };

describe("a chosen ElevenLabs voice that cannot speak", () => {
  it("a working one reads the clip, no switch", async () => {
    const { f, asked } = net(account({}));
    const out = await speakClip(["หนึ่ง", "สอง"], { ...base, narrator: "M", voice: "XLXcyPK1jTjw1pYLLcM9", fetch: f });
    expect(out.google).toBeNull();
    expect(asked.filter((a) => a === "eleven")).toHaveLength(2);
  });

  it("refused mid-way (402 on the free plan read as paid): the whole clip again in Orus for a man", async () => {
    const switched = vi.fn();
    const { f, asked, voices } = net(account({}), paidOnly);
    const out = await speakClip(["หนึ่ง", "สอง"], { ...base, narrator: "M", voice: "XLXcyPK1jTjw1pYLLcM9", fetch: f, onSwitch: switched });
    expect(out.google).toBe("Orus");
    expect(out.spoken).toHaveLength(2);
    expect(voices).toEqual(["Orus", "Orus"]);
    expect(switched).toHaveBeenCalledOnce();
    expect(asked).toContain("eleven");
  });

  it("a free plan is known before any line: straight to Kore for a woman, ElevenLabs never asked to speak", async () => {
    const { f, asked, voices } = net(account({ tier: "free" }));
    const out = await speakClip(["หนึ่ง"], { ...base, narrator: "F", voice: "nealpwJT5tCyJFKDzEq8", fetch: f });
    expect(out.google).toBe("Kore");
    expect(voices).toEqual(["Kore"]);
    expect(asked).not.toContain("eleven");
  });

  it("out of credits, or no key, goes to Google the same way", async () => {
    const low = net(account({ left: 100 }));
    expect((await speakClip(["หนึ่ง"], { ...base, narrator: "M", voice: "x", fetch: low.f })).google).toBe("Orus");
    keys.elevenlabs = null;
    const none = net(account({}));
    const out = await speakClip(["หนึ่ง"], { ...base, narrator: "F", voice: "x", fetch: none.f });
    keys.elevenlabs = "sk_test";
    expect(out.google).toBe("Kore");
  });

  it("a Gemini clip never falls back to a free-plan ElevenLabs reader", async () => {
    const { f } = net(account({ tier: "free" }));
    expect(await elevenReady(f)).toBe(false);
  });
});

describe("the form and the card", () => {
  it("a clip with an ElevenLabs voice is never refused at the start", async () => {
    expect(await voiceRefusal("XLXcyPK1jTjw1pYLLcM9")).toBeNull();
  });

  it("say Google reads instead, without the ElevenLabs charge", () => {
    expect(ELEVEN_TO_GOOGLE).toMatchObject({ ok: true, blocked: false });
    expect(ELEVEN_TO_GOOGLE.text).toContain("Google");
    expect(googleInPlace("สมชาย", "Orus")).toBe("เสียง สมชาย ใช้ไม่ได้ตอนนี้ ใช้เสียง Google (Orus) แทน · ไม่คิดค่าเสียง ElevenLabs");
  });
});
