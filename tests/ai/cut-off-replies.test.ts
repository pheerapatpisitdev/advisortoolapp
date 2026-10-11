import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A reply that stopped at maxTokens is not an answer while another model can give a whole one
 * (review, 2026-10-11): cut-off words went out as they were, and a cut-off JSON reply was lost
 * or "repaired" with its last fields dropped.
 */
const model = (id: string, name: string, out: number) => ({
  id, provider: "google", kind: "text", model_name: name, enabled: true, price: { inputPerMTokUsd: 0.1, outputPerMTokUsd: out },
});
const MODELS = [model("a", "first-model", 0.4), model("b", "second-model", 0.8)];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string) => {
      if (name === "ins_month_spend") return { data: [], error: null };
      if (name === "ins_wallet_charged_thb") return { data: 0, error: null };
      return { data: [{ provider: "google", api_key: "k" }], error: null };
    },
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: MODELS });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: [] });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: null } }) };
        const q = { order: () => q, range: async () => ({ data: [], error: null }), then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok) };
        return { gte: () => q };
      },
      insert: async () => ({ error: null }),
    }),
  }),
}));
vi.mock("@/lib/wallet/round", () => ({ meterCost: () => {}, inWalletRound: () => false }));

type Reply = { text: string; inputTokens: number; outputTokens: number; truncated?: boolean };
const replies = vi.hoisted(() => ({ byModel: {} as Record<string, Reply> }));
const call = vi.fn(async (a: { model: string }) => replies.byModel[a.model]);
vi.mock("@/lib/ai/providers", () => ({ CALLERS: { google: (a: { model: string }) => call(a) }, EMBEDDERS: {} }));

const { chat, clearAiConfigCache } = await import("@/lib/ai/client");

const ask = (json = false) => chat({
  tier: "small", task: "t", messages: [{ role: "user", content: "hi" }], maxTokens: 300, json,
  prefer: "first-model", within: ["second-model"],
});

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  call.mockClear();
  clearAiConfigCache();
});

describe("a reply cut off at maxTokens", () => {
  it("asks the next model, and answers with its whole reply", async () => {
    replies.byModel = {
      "first-model": { text: "ประกันชีวิตคือการวางแผนเพื่อ", inputTokens: 10, outputTokens: 300, truncated: true },
      "second-model": { text: "ประกันชีวิตคือการวางแผนเพื่อคนที่คุณรัก", inputTokens: 10, outputTokens: 40 },
    };
    const r = await ask();
    expect(r.model).toBe("second-model");
    expect(r.text).toContain("คนที่คุณรัก");
  });

  it("gives back the first cut-off words when every model stopped short", async () => {
    replies.byModel = {
      "first-model": { text: "ตอนที่หนึ่ง", inputTokens: 10, outputTokens: 300, truncated: true },
      "second-model": { text: "ตอนที่สอง", inputTokens: 10, outputTokens: 300, truncated: true },
    };
    const r = await ask();
    expect(r.text).toBe("ตอนที่หนึ่ง");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("never gives back cut-off JSON", async () => {
    replies.byModel = {
      "first-model": { text: '{"hooks":["a"],"body":"ข', inputTokens: 10, outputTokens: 300, truncated: true },
      "second-model": { text: '{"hooks":["b"],"bo', inputTokens: 10, outputTokens: 300, truncated: true },
    };
    await expect(ask(true)).rejects.toThrow(/cut off at 300/);
  });

  it("is untouched when the model finished", async () => {
    replies.byModel = { "first-model": { text: "ครบ", inputTokens: 10, outputTokens: 3 }, "second-model": { text: "x", inputTokens: 1, outputTokens: 1 } };
    expect((await ask()).model).toBe("first-model");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
