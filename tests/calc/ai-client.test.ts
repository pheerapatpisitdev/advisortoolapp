import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the shared reference table holds; one model is enough to show the order of things. */
const MODEL = {
  id: "m1", provider: "google", kind: "text", model_name: "gemini-3.1-flash-lite", enabled: true,
  price: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.4 },
};

let keyRows: { provider: string; api_key: string }[] | null = [{ provider: "google", api_key: "k" }];
let switches: { provider: string; enabled: boolean }[] = [];
const inserted: Record<string, unknown>[] = [];
/** the month so far: what the ledger holds, and what the owner set as the ceiling */
let ledger: { model: string; task: string; cost_thb: number }[] = [];
let budget: number | null = null;
/** what agents' wallet rounds cost the providers this month (ins_wallet_charged_thb) */
let walletCharged = 0;
/** whether the call is made inside a round an agent pays for from their wallet */
let walletRound = false;
/** what the client library does to any select: the first thousand rows, silently */
const CAP = 1000;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string) => {
      if (name === "ins_month_spend") {
        const acc = new Map<string, { model: string; task: string; calls: number; cost_thb: number }>();
        for (const r of ledger) {
          const at = acc.get(`${r.model}|${r.task}`) ?? { model: r.model, task: r.task, calls: 0, cost_thb: 0 };
          at.calls += 1;
          at.cost_thb += r.cost_thb;
          acc.set(`${r.model}|${r.task}`, at);
        }
        return { data: [...acc.values()], error: null };
      }
      if (name === "ins_wallet_charged_thb") return { data: walletCharged, error: null };
      return { data: keyRows, error: keyRows ? null : { message: "boom" } };
    },
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: [MODEL] });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: switches });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: budget } }) };
        const q = {
          order: () => q,
          range: async (from: number, to: number) => ({ data: ledger.slice(from, Math.min(to + 1, from + CAP)), error: null }),
          then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: ledger.slice(0, CAP), error: null }).then(ok),
        };
        return { gte: () => q };
      },
      insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; },
    }),
  }),
}));

vi.mock("@/lib/wallet/round", () => ({ meterCost: () => {}, inWalletRound: () => walletRound }));

const call = vi.fn<(args?: { signal?: AbortSignal }) => Promise<{ text: string; inputTokens: number; outputTokens: number }>>(
  async () => ({ text: "ok", inputTokens: 10, outputTokens: 5 }),
);
vi.mock("@/lib/ai/providers", () => ({ CALLERS: { google: (...a: unknown[]) => call(...(a as [])) }, EMBEDDERS: {} }));

const { chat, clearAiConfigCache, TurnTimeout, withTurnDeadline } = await import("@/lib/ai/client");

const ask = () => chat({ tier: "small", task: "t", messages: [{ role: "user", content: "hi" }] });

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  keyRows = [{ provider: "google", api_key: "k" }];
  switches = [];
  inserted.length = 0;
  ledger = [];
  budget = null;
  walletCharged = 0;
  walletRound = false;
  call.mockReset();
  call.mockImplementation(async () => ({ text: "ok", inputTokens: 10, outputTokens: 5 }));
  clearAiConfigCache();
});

describe("the switch beside a key", () => {
  it("takes a switched-off provider out of the chain as if its key were gone", async () => {
    switches = [{ provider: "google", enabled: false }];
    await expect(ask()).rejects.toThrow(/ไม่มีคีย์/);
    expect(call).not.toHaveBeenCalled();
  });

  it("changes nothing while the switch is on", async () => {
    switches = [{ provider: "google", enabled: true }];
    expect((await ask()).model).toBe("gemini-3.1-flash-lite");
  });
});

describe("reaching a model", () => {
  it("answers through the first provider that has a key", async () => {
    const r = await ask();
    expect(r.text).toBe("ok");
    expect(r.model).toBe("gemini-3.1-flash-lite");
  });

  it("says which models it tried when every one of them fails", async () => {
    call.mockRejectedValueOnce(new Error("429 quota"));
    await expect(ask()).rejects.toThrow(/gemini-3.1-flash-lite: .*429/);
  });

  it("names the missing keys rather than blaming the models when the key table cannot be read", async () => {
    keyRows = null;
    await expect(ask()).rejects.toThrow(/คีย์/);
  });

  /**
   * 1,180 calls at three satang is ฿35.40. Read as rows, the client stops at a thousand and
   * the guard sees ฿30.00 — under a ฿32 budget that the month has in fact already passed.
   */
  it("shuts off at the budget even when the month has more calls than one read returns", async () => {
    ledger = Array.from({ length: 1180 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 }));
    budget = 32;
    await expect(ask()).rejects.toThrow(/งบ/);
    expect(call).not.toHaveBeenCalled();
  });

  it("answers while the month is still under budget", async () => {
    ledger = Array.from({ length: 1180 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 }));
    budget = 36;
    expect((await ask()).text).toBe("ok");
  });

  it("does not keep a broken key list: the next customer is answered", async () => {
    keyRows = null;
    await expect(ask()).rejects.toThrow();
    keyRows = [{ provider: "google", api_key: "k" }];
    // a minute has not passed, so only a config that refused to be cached lets this through
    expect((await ask()).text).toBe("ok");
  });
});

/**
 * The owner's budget is the owner's money. Agents' wallet rounds are in the same ledger, and
 * once agents began spending from their wallets the owner's month filled with their rounds and
 * the bots told every customer they were out of budget (review, 2026-10-01).
 */
describe("the owner's budget and the agents' wallets", () => {
  const month = () => Array.from({ length: 1180 }, () => ({ model: "gemini-3.1-flash-lite", task: "content-write", cost_thb: 0.03 }));

  it("does not count what agents paid for from their wallets", async () => {
    ledger = month(); // ฿35.40 in the ledger
    budget = 32;
    walletCharged = 10; // ฿10 of it was agents' rounds: the owner has spent ฿25.40
    expect((await ask()).text).toBe("ok");
  });

  it("still stops when the owner's own share reaches the budget", async () => {
    ledger = month();
    budget = 32;
    walletCharged = 2; // ฿33.40 is the owner's
    await expect(ask()).rejects.toThrow(/งบ/);
  });

  it("does not stand over a round an agent is paying for", async () => {
    ledger = month();
    budget = 1;
    walletRound = true;
    expect((await ask()).text).toBe("ok");
  });
});

describe("a call's own clock", () => {
  it("gives a provider a timeout even when the caller names none", async () => {
    await ask();
    const signal = call.mock.calls[0][0]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal!.aborted).toBe(false);
  });
});

/**
 * The webhooks answer inside after(), and a function at its limit is killed before its catch
 * sends the apology. A turn's clock gives up first, so the apology always goes.
 */
describe("a turn's deadline", () => {
  it("gives up at the deadline and aborts the call still waiting on a provider", async () => {
    let seen: AbortSignal | undefined;
    call.mockImplementation((args?: { signal?: AbortSignal }) => new Promise((_, reject) => {
      seen = args?.signal;
      args?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const began = Date.now();
    await expect(withTurnDeadline(50, () => ask())).rejects.toBeInstanceOf(TurnTimeout);
    expect(Date.now() - began).toBeLessThan(2000);
    expect(seen?.aborted).toBe(true);
  });

  it("starts no further call once the turn is out of time", async () => {
    await expect(withTurnDeadline(20, async () => {
      await new Promise((r) => setTimeout(r, 60));
      return ask();
    })).rejects.toBeInstanceOf(TurnTimeout);
    // the late ask() runs on after the race is lost; give it a moment, then look
    await new Promise((r) => setTimeout(r, 80));
    expect(call).not.toHaveBeenCalled();
  });

  it("changes nothing for a turn that finishes in time", async () => {
    expect((await withTurnDeadline(5000, () => ask())).text).toBe("ok");
  });
});
