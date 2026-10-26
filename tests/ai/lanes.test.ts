import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANES, laneEntries, laneIds, laneOf, parseLanes } from "@/lib/ai/lanes";
import type { ModelRow } from "@/lib/ai/types";

// ลำดับหลักและสำรอง (owner, 2026-10-21, mockup v3 https://claude.ai/artifact/JmmL9bs2ZBqhBi829bjUey)

const row = (model_name: string, provider: string, inUsd: number, enabled = true): ModelRow => ({
  id: model_name, provider, kind: "text", model_name, enabled, price: { inputPerMTokUsd: inUsd, outputPerMTokUsd: inUsd * 4 },
});
const MODELS = [
  row("gemini-3.1-flash-lite", "google", 0.25),
  row("gemini-3.7-flash", "google", 0.75),
  row("claude-sonnet-5", "anthropic", 2),
  row("deepseek-flash", "deepseek", 0.3),
  row("google/gemma-4-31b-it:free", "openrouter", 0),
];

let lanesRow: unknown = {};
let lanesError: unknown = null;
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: [{ provider: "google", api_key: "g" }, { provider: "anthropic", api_key: "a" }, { provider: "deepseek", api_key: "d" }], error: null }),
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === "model_configs") return Promise.resolve({ data: MODELS });
        if (table === "ins_model_prefs" || table === "ins_api_keys") return Promise.resolve({ data: [] });
        if (cols === "lanes") return { maybeSingle: async () => ({ data: lanesError ? null : { lanes: lanesRow }, error: lanesError }) };
        return { maybeSingle: async () => ({ data: { monthly_budget_thb: null } }) };
      },
      insert: async () => ({ error: null }),
    }),
  }),
}));
vi.mock("@/lib/wallet/round", () => ({ meterCost: () => {}, inWalletRound: () => false }));
const asked: string[] = [];
const answer = async ({ model }: { model: string }) => { asked.push(model); return { text: "ok", inputTokens: 1, outputTokens: 1 }; };
vi.mock("@/lib/ai/providers", () => ({ CALLERS: { google: answer, anthropic: answer, deepseek: answer }, EMBEDDERS: [] }));

const { chat, clearAiConfigCache, laneChain, voiceLane } = await import("@/lib/ai/client");

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  lanesRow = {};
  lanesError = null;
  asked.length = 0;
  clearAiConfigCache();
});

describe("which lane a call belongs to", () => {
  it("puts the chat bots' work in Autobot, by size", () => {
    for (const t of ["route", "route_health_en", "small_talk", "smalltalk", "plan_info_health"]) expect(laneOf(t, "small")).toBe("bot-small");
    expect(laneOf("chat-review", "large")).toBe("bot-large");
  });

  it("puts Studio's reading of pictures in อ่านรูปและเอกสาร, the rest of the writing by size", () => {
    expect(laneOf("content-poster-read", "large")).toBe("write-read");
    expect(laneOf("content-describe-picture", "large")).toBe("write-read");
    expect(laneOf("content", "large")).toBe("write-post");
    expect(laneOf("content-plan", "small")).toBe("write-help");
    expect(laneOf("plan-advice", "small")).toBe("write-help");
    // a name that only starts like a bot task is not one
    expect(laneOf("routes-export", "small")).toBe("write-help");
  });
});

describe("a lane's defaults", () => {
  it("are the order used before lanes, with DeepSeek just ahead of OpenRouter", () => {
    expect(laneIds({}, "bot-small")).toEqual([
      "gemini-3.1-flash-lite", "gpt-5-mini", "glm-5.3-flash", "claude-haiku-4-5-20251001",
      "typhoon-v2.5-30b-a3b-instruct", "deepseek-flash", "google/gemini-3.1-flash-lite",
    ]);
    expect(laneIds({}, "write-post")).toEqual(["claude-sonnet-5", "gpt-5", "gemini-3.7-flash"]);
    expect(laneIds({}, "image-plain")).toEqual(["gpt-image-medium", "gemini-image-lite"]);
    expect(laneIds({}, "image-face")).toEqual(["gemini-image", "gpt-image-medium", "gemini-image-lite"]);
    expect(laneIds({}, "voice")).toEqual(["gemini-api", "gemini-cloud", "elevenlabs"]);
  });

  it("cover all four groups", () => {
    expect(new Set(LANES.map((l) => l.group))).toEqual(new Set(["bot", "write", "image", "voice"]));
  });
});

describe("what was saved", () => {
  it("is kept in its order, and a switched-off choice is not tried", () => {
    const saved = parseLanes({ "bot-small": [{ id: "deepseek-flash", on: true }, { id: "gemini-3.1-flash-lite", on: false }] });
    expect(laneEntries(saved, "bot-small")).toHaveLength(2);
    expect(laneIds(saved, "bot-small")).toEqual(["deepseek-flash"]);
  });

  it("drops what is not a lane or not an entry, as if never saved", () => {
    const saved = parseLanes({ nonsense: [{ id: "x", on: true }], "bot-large": [{ id: 3 }, "x"], voice: "all" });
    expect(saved).toEqual({});
    expect(parseLanes(null)).toEqual({});
  });
});

describe("laneChain", () => {
  const keys = { google: "g", anthropic: "a", deepseek: "d" };

  it("tries exactly the lane, in its order, skipping what is off or has no key", () => {
    const names = laneChain([...MODELS, row("gpt-5", "openai", 1.25)], ["claude-sonnet-5", "gpt-5", "gemini-3.7-flash"], keys).map((m) => m.model_name);
    expect(names).toEqual(["claude-sonnet-5", "gemini-3.7-flash"]);
    expect(laneChain([row("claude-sonnet-5", "anthropic", 2, false), ...MODELS.slice(0, 2)], ["claude-sonnet-5", "gemini-3.7-flash"], keys).map((m) => m.model_name))
      .toEqual(["gemini-3.7-flash"]);
  });

  it("asks a pick that is also in the lane only once", () => {
    expect(laneChain(MODELS, ["gemini-3.7-flash", "claude-sonnet-5", "gemini-3.7-flash"], keys).map((m) => m.model_name))
      .toEqual(["gemini-3.7-flash", "claude-sonnet-5"]);
  });

  it("with nothing left that can answer, rescues with the cheapest paid model, never a free one", () => {
    expect(laneChain(MODELS, ["gpt-5"], keys).map((m) => m.model_name)[0]).toBe("gemini-3.1-flash-lite");
    expect(laneChain(MODELS, ["gpt-5"], keys).map((m) => m.model_name)).not.toContain("google/gemma-4-31b-it:free");
    // a pick held to itself (ประหยัด) is not rescued by something else
    expect(laneChain(MODELS, ["gpt-5"], keys, false)).toEqual([]);
  });
});

describe("chat follows the saved lane", () => {
  const ask = (task: string, prefer?: string) => chat({ tier: "small", task, prefer, messages: [{ role: "user", content: "hi" }] });

  it("answers with the lane's top choice", async () => {
    lanesRow = { "bot-small": [{ id: "deepseek-flash", on: true }, { id: "gemini-3.1-flash-lite", on: true }] };
    expect((await ask("route")).model).toBe("deepseek-flash");
    // another lane is not touched by it
    expect((await ask("content-plan")).model).toBe("gemini-3.1-flash-lite");
  });

  it("keeps a caller's pick ahead of the lane", async () => {
    lanesRow = { "write-help": [{ id: "deepseek-flash", on: true }] };
    expect((await ask("content-plan", "gemini-3.7-flash")).model).toBe("gemini-3.7-flash");
  });

  it("uses the defaults while the column cannot be read (before its migration)", async () => {
    lanesError = { message: "column ins_ai_settings.lanes does not exist" };
    expect((await ask("route")).model).toBe("gemini-3.1-flash-lite");
    expect(await voiceLane()).toEqual(["gemini-api", "gemini-cloud", "elevenlabs"]);
  });

  it("gives the voice lane as saved", async () => {
    lanesRow = { voice: [{ id: "gemini-cloud", on: true }, { id: "gemini-api", on: false }, { id: "elevenlabs", on: true }] };
    expect(await voiceLane()).toEqual(["gemini-cloud", "elevenlabs"]);
  });
});
