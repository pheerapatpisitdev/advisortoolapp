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
    expect(res).toEqual({ text: "สวัสดีครับ", inputTokens: 7, outputTokens: 3 });
  });

  it("sends the words without the pictures — its chat model reads none", async () => {
    const sent = stub();
    await CALLERS.typhoon({ apiKey: "k", model: "typhoon-v2.5-30b-a3b-instruct", messages: [picture], maxTokens: 50 });
    expect(sent().body.messages[0]).toEqual({ role: "user", content: "รูปนี้คืออะไร" });
  });
});

describe("Kimi", () => {
  afterEach(() => vi.unstubAllGlobals());

  /**
   * Kimi thinks by default and the thinking counts against max_tokens — the GPT-5 trouble of
   * 2026-09-22, when customers got nothing back because every token went to reasoning.
   */
  it("switches K2.6's thinking off", async () => {
    const sent = stub();
    await CALLERS.moonshot({ apiKey: "k", model: "kimi-k2.6", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    expect(sent().url).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect(sent().body.thinking).toEqual({ type: "disabled" });
    expect(sent().body.reasoning_effort).toBeUndefined();
  });

  it("keeps K3, which always thinks, to its lowest effort unless a caller asks for more", async () => {
    let sent = stub();
    await CALLERS.moonshot({ apiKey: "k", model: "kimi-k3", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    expect(sent().body.reasoning_effort).toBe("low");
    expect(sent().body.thinking).toBeUndefined();
    vi.unstubAllGlobals();
    sent = stub();
    await CALLERS.moonshot({ apiKey: "k", model: "kimi-k3", messages: [{ role: "user", content: "x" }], maxTokens: 200, effort: "high" });
    expect(sent().body.reasoning_effort).toBe("high");
  });

  it("sends pictures along — Kimi reads them", async () => {
    const sent = stub();
    await CALLERS.moonshot({ apiKey: "k", model: "kimi-k2.6", messages: [picture], maxTokens: 50 });
    const content = sent().body.messages[0].content;
    expect(content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
  });
});
