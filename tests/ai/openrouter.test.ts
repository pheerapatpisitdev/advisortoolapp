import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS } from "@/lib/ai/providers";
import { laneChain } from "@/lib/ai/client";
import { LANES, laneIds } from "@/lib/ai/lanes";

function stub() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    choices: [{ message: { content: "สวัสดีครับ" }, finish_reason: "stop" }], usage: { prompt_tokens: 7, completion_tokens: 3 },
  })));
  vi.stubGlobal("fetch", fetchMock);
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization };
  };
}

describe("OpenRouter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks its own host in the OpenAI shape, the model named with its maker", async () => {
    const sent = stub();
    const res = await CALLERS.openrouter({ apiKey: "k", model: "anthropic/claude-sonnet-5", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    expect(sent().url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(sent().auth).toBe("Bearer k");
    expect(sent().body.model).toBe("anthropic/claude-sonnet-5");
    expect(res).toEqual({ text: "สวัสดีครับ", inputTokens: 7, outputTokens: 3, truncated: false });
  });

  it("holds thinking to low, out of the text, unless a caller asks for more", async () => {
    let sent = stub();
    await CALLERS.openrouter({ apiKey: "k", model: "anthropic/claude-sonnet-5", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    expect(sent().body.reasoning).toEqual({ effort: "low", exclude: true });
    vi.unstubAllGlobals();
    sent = stub();
    await CALLERS.openrouter({ apiKey: "k", model: "anthropic/claude-sonnet-5", messages: [{ role: "user", content: "x" }], maxTokens: 200, effort: "high" });
    expect(sent().body.reasoning).toEqual({ effort: "high", exclude: true });
  });

  it("sends pictures along", async () => {
    const sent = stub();
    await CALLERS.openrouter({ apiKey: "k", model: "google/gemini-3.1-flash-lite", maxTokens: 50,
      messages: [{ role: "user", content: "รูปนี้คืออะไร", images: [{ base64: "AAAA", mimeType: "image/png" }] }] });
    expect(sent().body.messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
  });
});

describe("OpenRouter in the fallback chain", () => {
  const row = (id: string, provider: string, model_name: string, i: number, o: number) =>
    ({ id, provider, kind: "text", model_name, enabled: true, price: { inputPerMTokUsd: i, outputPerMTokUsd: o } });
  const models = [
    row("gemini-small", "google", "gemini-3.1-flash-lite", 0.1, 0.4),
    row("haiku", "anthropic", "claude-haiku-4-5-20251001", 1, 5),
    row("sonnet", "anthropic", "claude-sonnet-5", 3, 15),
    row("openrouter-small", "openrouter", "google/gemini-3.1-flash-lite", 0.25, 1.5),
    row("openrouter-large", "openrouter", "anthropic/claude-sonnet-5", 2, 10),
  ];
  const keys = { google: "g", anthropic: "a", openrouter: "o" };

  it("comes last in every text lane's defaults, after every model of our own", () => {
    for (const lane of LANES.filter((l) => l.kind === "text" && l.defaults.some((d) => d.includes("/")))) {
      expect(lane.defaults.at(-1)).toMatch(/^(google|anthropic)\//);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const small = laneChain(models as any, laneIds({}, "bot-small"), keys).map((m) => m.id);
    expect(small).toEqual(["gemini-small", "haiku", "openrouter-small"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const large = laneChain(models as any, laneIds({}, "write-post"), keys).map((m) => m.id);
    expect(large).toEqual(["sonnet"]);
  });

  it("is skipped while it has no key", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = laneChain(models as any, laneIds({}, "bot-large"), { google: "g", anthropic: "a" }).map((m) => m.id);
    expect(ids).not.toContain("openrouter-large");
  });
});

describe("the free Gemma", () => {
  afterEach(() => vi.unstubAllGlobals());
  const row = (id: string, provider: string, model_name: string, i: number, o: number) =>
    ({ id, provider, kind: "text", model_name, enabled: true, price: { inputPerMTokUsd: i, outputPerMTokUsd: o } });
  const models = [
    row("gemini-small", "google", "gemini-3.1-flash-lite", 0.1, 0.4),
    row("sonnet", "anthropic", "claude-sonnet-5", 3, 15),
    row("openrouter-gemma-free", "openrouter", "google/gemma-4-31b-it:free", 0, 0),
  ];
  const keys = { google: "g", anthropic: "a", openrouter: "o" };

  it("is in no lane, and never the rescue of a lane with nothing left", () => {
    for (const lane of LANES) expect(lane.defaults).not.toContain("google/gemma-4-31b-it:free");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(laneChain(models as any, ["gone-model"], keys).map((m) => m.id)).not.toContain("openrouter-gemma-free");
  });

  it("is sent nothing about reasoning", async () => {
    const sent = stub();
    await CALLERS.openrouter({ apiKey: "k", model: "google/gemma-4-31b-it:free", messages: [{ role: "user", content: "x" }], maxTokens: 50 });
    expect(sent().body.reasoning).toBeUndefined();
  });
});
