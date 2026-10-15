import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS } from "@/lib/ai/providers";

/** The request each new provider is sent, read back from a stubbed fetch. */
function stub() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: "สวัสดีครับ" } }], usage: { prompt_tokens: 7, completion_tokens: 3 },
  })));
  vi.stubGlobal("fetch", fetchMock);
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization };
  };
  return sent;
}

const picture = { role: "user" as const, content: "รูปนี้คืออะไร", images: [{ base64: "AAAA", mimeType: "image/png" }] };

describe("Typhoon", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks its own host in the OpenAI shape and reports the tokens", async () => {
    const sent = stub();
    const res = await CALLERS.typhoon({ apiKey: "k", model: "typhoon-v2.5-30b-a3b-instruct", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    expect(sent().url).toBe("https://api.opentyphoon.ai/v1/chat/completions");
    expect(sent().auth).toBe("Bearer k");
    expect(sent().body.max_tokens).toBe(200);
    expect(res).toEqual({ text: "สวัสดีครับ", inputTokens: 7, outputTokens: 3, truncated: false });
  });

  it("sends the words without the pictures — its chat model reads none", async () => {
    const sent = stub();
    await CALLERS.typhoon({ apiKey: "k", model: "typhoon-v2.5-30b-a3b-instruct", messages: [picture], maxTokens: 50 });
    expect(sent().body.messages[0]).toEqual({ role: "user", content: "รูปนี้คืออะไร" });
  });
});
