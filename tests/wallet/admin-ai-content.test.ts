import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The owner's content figure on /admin/ai is what the ceiling counts: the month's content
 * cost less what agents paid for from their wallets (src/lib/content/store.ts).
 */

const wallet = vi.hoisted(() => ({ walletChargedThb: vi.fn() }));
vi.mock("@/lib/wallet/store", () => wallet);
vi.mock("@/lib/auth/viewer", async () => (await import("../helpers/signed-in")).asOwner);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/ai/client", () => ({ clearAiConfigCache: () => undefined, testProviders: async () => [] }));
vi.mock("@/lib/ai/ledger", () => ({
  monthStart: () => new Date("2026-09-01T00:00:00Z"),
  spendSince: async () => new Date("2026-09-01T00:00:00Z"),
  monthSpend: async () => ({ baht: 12, lines: [] }),
}));
vi.mock("@/lib/content/store", () => ({ contentBaht: () => 10, DEFAULT_CONTENT_CAP_THB: 30 }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const q = {
        order: () => q,
        maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: "500", content_budget_thb: null } }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
      };
      return { select: () => q };
    },
  }),
}));

const { loadAiPage } = await import("@/app/admin/ai/actions");

beforeEach(() => vi.clearAllMocks());

describe("the content figure on /admin/ai", () => {
  it("leaves out what agents paid for from their wallets", async () => {
    wallet.walletChargedThb.mockResolvedValue(4);
    expect((await loadAiPage()).content.spent).toBe(6);
    expect(wallet.walletChargedThb).toHaveBeenCalledWith(new Date("2026-09-01T00:00:00Z"));
  });

  it("never goes below zero", async () => {
    wallet.walletChargedThb.mockResolvedValue(15);
    expect((await loadAiPage()).content.spent).toBe(0);
  });

  it("is the whole content cost when no wallet round was paid", async () => {
    wallet.walletChargedThb.mockResolvedValue(0);
    expect((await loadAiPage()).content.spent).toBe(10);
  });
});
