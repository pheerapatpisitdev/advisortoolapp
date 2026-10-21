import { describe, expect, it, vi } from "vitest";

// one of Gemini's 30 voices reads the clip when one is named (owner, 2026-10-17)
vi.mock("@/lib/ai/client", () => ({ providerKey: async () => "g_test", voiceLane: async () => ["gemini-api", "gemini-cloud", "elevenlabs"] }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: vi.fn() }));

import { speakLine } from "@/lib/ai/tts";

const audio = () => vi.fn(async () => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ inlineData: { data: Buffer.alloc(4800, 1).toString("base64") } }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 100 },
}), { status: 200 }));
const voiceAsked = (f: ReturnType<typeof audio>) =>
  JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;

describe("Gemini's voice by name", () => {
  it("asks Gemini for the voice named", async () => {
    const f = audio();
    await speakLine("สวัสดีครับ", "t", { narrator: "M", gemini: "Puck", fetch: f as unknown as typeof fetch });
    expect(voiceAsked(f)).toBe("Puck");
  });

  it("keeps the narrator's own, Kore or Orus, when none is named", async () => {
    const f = audio();
    await speakLine("สวัสดีครับ", "t", { narrator: "M", fetch: f as unknown as typeof fetch });
    expect(voiceAsked(f)).toBe("Orus");
    const g = audio();
    await speakLine("สวัสดีค่ะ", "t", { fetch: g as unknown as typeof fetch });
    expect(voiceAsked(g)).toBe("Kore");
  });

  it("an ElevenLabs voice still goes to ElevenLabs, whatever Gemini voice the form held", async () => {
    const f = vi.fn(async () => new Response(Buffer.alloc(4800, 1), { status: 200, headers: { "character-cost": "10" } }));
    await speakLine("สวัสดีค่ะ", "t", { narrator: "F", gemini: "Zephyr", voice: "abc", fetch: f as unknown as typeof fetch });
    expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain("api.elevenlabs.io");
  });
});
