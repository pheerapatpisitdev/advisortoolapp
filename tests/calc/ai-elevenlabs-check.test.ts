import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ElevenLabs speaks rather than writes, so the key test asks for its voice list (no credit)
 * instead of a chat ping, and reports how many voices the account has.
 */

let keyRows: { provider: string; api_key: string }[] = [];
const inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: keyRows, error: null }),
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: [] });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: [] });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: null } }) };
        return { gte: async () => ({ data: [] }) };
      },
      insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; },
    }),
  }),
}));

const { testProviders, clearAiConfigCache } = await import("@/lib/ai/client");

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  keyRows = [{ provider: "elevenlabs", api_key: "sk_eleven-secret-1234" }];
  inserted.length = 0;
  clearAiConfigCache();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ voices: [{ voice_id: "a", name: "A" }, { voice_id: "b", name: "B" }] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("the ElevenLabs key test", () => {
  it("lists the voices with the key in xi-api-key and reports the count, writing nothing to the ledger", async () => {
    const [check] = await testProviders(["elevenlabs"]);
    expect(check).toMatchObject({ provider: "elevenlabs", state: "ok", note: "2 เสียง" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/voices");
    expect(init.headers).toEqual({ "xi-api-key": "sk_eleven-secret-1234" });
    expect(inserted).toHaveLength(0);
  });

  it("says no-key without asking anyone when the key is not set", async () => {
    keyRows = [];
    const [check] = await testProviders(["elevenlabs"]);
    expect(check.state).toBe("no-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries the refusal back, with anything key-shaped taken out", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid_api_key sk_eleven-secret-1234-abcdefghijklmnopqrstuvwxyz" });
    const [check] = await testProviders(["elevenlabs"]);
    expect(check.state).toBe("failed");
    expect(check.error).toMatch(/401/);
    expect(check.error).not.toMatch(/abcdefghijklmnopqrstuvwxyz/);
  });
});
