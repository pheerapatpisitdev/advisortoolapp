import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS } from "@/lib/ai/providers";

afterEach(() => vi.unstubAllGlobals());

const reply = (usageMetadata: Record<string, number>) =>
  vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "สวัสดีครับ" }] }, finishReason: "STOP" }],
    usageMetadata,
  }), { status: 200 }));

/**
 * Google bills a Gemini model's thinking at the output rate, and the answer's own count leaves
 * it out (review, 2026-10-11): 12 answer tokens after 238 of thinking were recorded as 12, so
 * the ledger, the owner's budget and the wallet's meter all ran low.
 */
describe("what a Gemini reply costs", () => {
  const ask = () => CALLERS.google({ apiKey: "k", model: "gemini-3.1-flash-lite", messages: [{ role: "user", content: "x" }], maxTokens: 500 });

  it("counts the thinking as output", async () => {
    vi.stubGlobal("fetch", reply({ promptTokenCount: 800, candidatesTokenCount: 12, thoughtsTokenCount: 238, totalTokenCount: 1050 }));
    const r = await ask();
    expect(r.inputTokens).toBe(800);
    expect(r.outputTokens).toBe(250);
  });

  it("is the answer alone when the model did not think", async () => {
    vi.stubGlobal("fetch", reply({ promptTokenCount: 800, candidatesTokenCount: 12, totalTokenCount: 812 }));
    expect((await ask()).outputTokens).toBe(12);
  });
});
