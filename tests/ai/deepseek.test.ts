import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS } from "@/lib/ai/providers";

// DeepSeek as an AI provider (owner, 2026-10-21, mockup https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey)

function stub() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: "สวัสดีครับ" }, finish_reason: "stop" }], usage: { prompt_tokens: 9, completion_tokens: 4 },
  })));
  vi.stubGlobal("fetch", fetchMock);
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization };
  };
}

const picture = { role: "user" as const, content: "รูปนี้คืออะไร", images: [{ base64: "AAAA", mimeType: "image/png" }] };

describe("DeepSeek", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks its own host in the OpenAI shape, with thinking switched off", async () => {
    const sent = stub();
    const res = await CALLERS.deepseek({ apiKey: "sk-d", model: "deepseek-flash", messages: [{ role: "user", content: "x" }], maxTokens: 200, json: true });
    expect(sent().url).toBe("https://api.deepseek.com/chat/completions");
    expect(sent().auth).toBe("Bearer sk-d");
    // thinking is on unless told otherwise, and it eats max_tokens (the GPT-5 trouble of 2026-09-22)
    expect(sent().body).toMatchObject({ model: "deepseek-flash", max_tokens: 200, thinking: { type: "disabled" }, response_format: { type: "json_object" } });
    expect(res).toEqual({ text: "สวัสดีครับ", inputTokens: 9, outputTokens: 4, truncated: false });
  });

  it("sends pictures to Flash, which reads them", async () => {
    const sent = stub();
    await CALLERS.deepseek({ apiKey: "k", model: "deepseek-flash", messages: [picture], maxTokens: 50 });
    expect(sent().body.messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
  });

  it("sends V4 Pro the words alone: it reads no pictures", async () => {
    const sent = stub();
    await CALLERS.deepseek({ apiKey: "k", model: "deepseek-v4-pro", messages: [picture], maxTokens: 50 });
    expect(sent().body.messages[0]).toEqual({ role: "user", content: "รูปนี้คืออะไร" });
  });
});
