import { describe, expect, it, vi } from "vitest";

/**
 * The spend card on /admin/ai, fed by a ledger longer than the client library will return.
 *
 * On 2026-09-22 the card said 35 + 965 = exactly 1,000 calls for ฿29.68. The table said 1,180
 * for ฿34.54. A card that stops at a round number is a card that has stopped counting.
 */

const CAP = 1000;

const rows = [
  ...Array.from({ length: 1150 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 })),
  ...Array.from({ length: 20 }, () => ({ model: "gemini-3.1-flash-lite", task: "copilot", cost_thb: 0.05 })),
  ...Array.from({ length: 10 }, () => ({ model: "claude-sonnet-5", task: "copilot", cost_thb: 0.5 })),
  // the judge answers under its version, not the alias it was asked for by
  ...Array.from({ length: 50 }, () => ({ model: "jev-1.13.0", task: "route_shadow", cost_thb: 0.001 })),
];

vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, testProviders: async () => [] }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string) => {
      if (name !== "ins_month_spend") return { data: null, error: { message: `no ${name}` } };
      const acc = new Map<string, { model: string; task: string; calls: number; cost_thb: number }>();
      for (const r of rows) {
        const k = `${r.model}|${r.task}`;
        const at = acc.get(k) ?? { model: r.model, task: r.task, calls: 0, cost_thb: 0 };
        at.calls += 1;
        at.cost_thb += r.cost_thb;
        acc.set(k, at);
      }
      return { data: [...acc.values()], error: null };
    },
    from: (table: string) => {
      const q = {
        order: () => q,
        maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: 40 } }),
        gte: () => q,
        range: async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + CAP)), error: null }),
        then: (ok: (v: unknown) => unknown) => {
          const data =
            table === "model_configs"
              ? [
                  { id: "g", provider: "google", kind: "text", model_name: "gemini-3.1-flash-lite", enabled: true },
                  { id: "a", provider: "anthropic", kind: "text", model_name: "claude-sonnet-5", enabled: true },
                ]
              : table === "ins_usage_ledger" ? rows.slice(0, CAP) : [];
          return Promise.resolve({ data, error: null }).then(ok);
        },
      };
      return { select: () => q };
    },
  }),
}));

const { loadAiPage } = await import("@/app/admin/ai/actions");

describe("the spend card", () => {
  it("counts the whole month, not the first thousand calls", async () => {
    const page = await loadAiPage();
    expect(page.spentThisMonth).toBeCloseTo(1150 * 0.03 + 20 * 0.05 + 10 * 0.5 + 50 * 0.001, 6);
    expect(page.spend.reduce((n, p) => n + p.calls, 0)).toBe(1230);
  });

  it("still says which company was paid, and for what, busiest task first", async () => {
    const page = await loadAiPage();
    const google = page.spend.find((p) => p.provider === "google");
    const anthropic = page.spend.find((p) => p.provider === "anthropic");
    expect(google).toMatchObject({ calls: 1170, tasks: ["route", "copilot"] });
    expect(google?.baht).toBeCloseTo(1150 * 0.03 + 20 * 0.05, 6);
    expect(anthropic).toMatchObject({ calls: 10, tasks: ["copilot"] });
    // dearest company first, as before
    expect(page.spend[0].provider).toBe("google");
  });

  it("puts every version of Jev under TypeSafe, not under a name the card does not know", async () => {
    const page = await loadAiPage();
    expect(page.spend.find((p) => p.provider === "typesafe")).toMatchObject({ calls: 50, tasks: ["route_shadow"] });
    expect(page.spend.some((p) => p.provider.includes("ไม่รู้จักค่าย"))).toBe(false);
  });
});
