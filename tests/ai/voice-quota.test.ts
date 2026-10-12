import { describe, expect, it, vi } from "vitest";

// Gemini's voice runs out for the day (owner, 2026-10-12): the clip says so and when it comes back
vi.mock("@/lib/ai/client", () => ({ providerKey: async () => "g_test" }));
vi.mock("@/lib/ai/ledger", () => ({ recordUsage: async () => undefined }));

import { speakThai, TtsError, TtsQuotaError } from "@/lib/ai/tts";
import { voiceDay, voiceFullText } from "@/lib/quote-video/voice-quota";

const refusal = (quotaId: string) => vi.fn(async () => new Response(JSON.stringify({
  error: {
    code: 429, status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota, please check your plan and billing details.",
    details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId, quotaValue: "100" }] }],
  },
}), { status: 429 }));

describe("Gemini's daily voice cap", () => {
  it("a 429 on the per-day quota is a TtsQuotaError", async () => {
    const f = refusal("GenerateRequestsPerDayPerProjectPerModel");
    await expect(speakThai("สวัสดีค่ะ", "t", { fetch: f as unknown as typeof fetch })).rejects.toBeInstanceOf(TtsQuotaError);
  });

  it("a 429 on the per-minute quota stays the plain retry error", async () => {
    const f = refusal("GenerateRequestsPerMinutePerProjectPerModel");
    const e = await speakThai("สวัสดีค่ะ", "t", { fetch: f as unknown as typeof fetch }).catch((x) => x);
    expect(e).toBeInstanceOf(TtsError);
    expect(e).not.toBeInstanceOf(TtsQuotaError);
  });
});

describe("the voice day (midnight Pacific)", () => {
  it("in October it turns over at 14:00 Bangkok", () => {
    const { from, until } = voiceDay(new Date("2026-10-12T03:16:00Z")); // 10:16 Bangkok
    expect(from.toISOString()).toBe("2026-10-11T07:00:00.000Z");
    expect(until.toISOString()).toBe("2026-10-12T07:00:00.000Z");
    expect(voiceFullText(until)).toBe("เสียงพากย์ของวันนี้ใช้ครบแล้ว ลองใหม่ได้หลัง 14:00 น.");
  });

  it("after Pacific time falls back (1 Nov 2026) it turns over at 15:00 Bangkok", () => {
    const { from, until } = voiceDay(new Date("2026-11-02T03:00:00Z"));
    expect(from.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(until.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(voiceFullText(until)).toContain("หลัง 15:00 น.");
  });

  it("just after the turn, the next one is a day away", () => {
    const { from, until } = voiceDay(new Date("2026-10-12T07:00:01Z"));
    expect(from.toISOString()).toBe("2026-10-12T07:00:00.000Z");
    expect(until.toISOString()).toBe("2026-10-13T07:00:00.000Z");
  });
});
