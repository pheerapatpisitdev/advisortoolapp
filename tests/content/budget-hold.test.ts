import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The content ceiling under requests running at once: money is set aside in the ledger
 * first, and a request goes ahead only when what others spent and hold leaves it room.
 */

const ledger = vi.hoisted(() => ({ reserve: vi.fn(), release: vi.fn(), monthSpend: vi.fn(), sweepHolds: vi.fn() }));
const settings = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/ai/ledger", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/ledger")>()), ...ledger }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => settings.result }) }) }),
}));
const walletStore = vi.hoisted(() => ({
  walletChargedThb: vi.fn(async () => 0),
  releaseWallet: vi.fn(async () => {}),
  settleWallet: vi.fn(async () => 0),
}));
vi.mock("@/lib/wallet/store", () => walletStore);

const { admits, monthStart } = await import("@/lib/ai/ledger");
const { CONTENT_RESERVE_TASK, contentCap, contentSpentThisMonth, DEFAULT_CONTENT_CAP_THB, holdContentBudget } = await import("@/lib/content/store");

const spent = (baht: number) => ({ calls: 1, baht, lines: [{ model: "x", task: "content", calls: 1, baht }] });

beforeEach(() => {
  vi.clearAllMocks();
  ledger.reserve.mockResolvedValue("r1");
  ledger.release.mockResolvedValue(undefined);
});

describe("admits", () => {
  it("goes while everything spent and held, this request included, fits under the ceiling", () => {
    expect(admits(29.4 + 0.6, 30)).toBe(true);
    expect(admits(29.9 + 0.6, 30)).toBe(false);
  });

  it("sees a round already running: two at ฿20 each cannot both start under ฿30", () => {
    // each reads the other's hold as spent
    expect(admits(20 + 20, 30)).toBe(false);
    expect(admits(20, 30)).toBe(true);
  });
});

describe("holdContentBudget", () => {
  it("writes the hold under a content task, then reads the ledger with it in", async () => {
    ledger.monthSpend.mockResolvedValue(spent(3.5));
    expect(await holdContentBudget(3, 30)).toEqual({ ok: true, id: "r1" });
    expect(ledger.reserve).toHaveBeenCalledWith(CONTENT_RESERVE_TASK, 3);
    expect(CONTENT_RESERVE_TASK.startsWith("content")).toBe(true);
    expect(ledger.release).not.toHaveBeenCalled();
  });

  it("gives the hold back and refuses when it would pass the ceiling", async () => {
    // ฿28 spent before this ฿3 hold: it would pass ฿30, and ฿2 is what is left
    ledger.monthSpend.mockResolvedValue(spent(31));
    expect(await holdContentBudget(3, 30)).toEqual({ ok: false, left: 2 });
    expect(ledger.release).toHaveBeenCalledWith("r1");
  });

  it("gives the hold back when the ledger cannot be read", async () => {
    ledger.monthSpend.mockRejectedValue(new Error("down"));
    await expect(holdContentBudget(3, 30)).rejects.toThrow("down");
    expect(ledger.release).toHaveBeenCalledWith("r1");
  });
});

describe("contentSpentThisMonth", () => {
  it("is the one reader that counts holds, and sweeps dead ones first", async () => {
    ledger.monthSpend.mockResolvedValue(spent(2));
    await contentSpentThisMonth();
    expect(ledger.sweepHolds).toHaveBeenCalled();
    expect(ledger.monthSpend).toHaveBeenCalledWith(expect.any(Date), { holds: true });
    expect(ledger.sweepHolds.mock.invocationCallOrder[0]).toBeLessThan(ledger.monthSpend.mock.invocationCallOrder[0]);
  });
});

describe("contentCap", () => {
  it("is the default only when the owner never set one", async () => {
    settings.result = { data: null, error: null };
    expect(await contentCap()).toBe(DEFAULT_CONTENT_CAP_THB);
    settings.result = { data: { content_budget_thb: 50 }, error: null };
    expect(await contentCap()).toBe(50);
  });

  it("throws on a failed read, so nothing spends against a made-up ceiling", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    settings.result = { data: null, error: { message: "timeout" } };
    await expect(contentCap()).rejects.toThrow("timeout");
  });
});

describe("monthStart", () => {
  it("starts the month at midnight in Thailand, not in UTC", () => {
    // 01:00 on 1 October in Bangkok is still 30 September in UTC
    expect(monthStart(new Date("2026-09-30T18:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    // 06:00 on 30 September in Bangkok is September
    expect(monthStart(new Date("2026-09-29T23:00:00Z")).toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(monthStart(new Date("2027-01-01T00:00:00Z")).toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });
});

describe("rounds an agent pays for from the wallet", () => {
  it("are taken off what the content ceiling counts", async () => {
    ledger.monthSpend.mockResolvedValue(spent(10));
    walletStore.walletChargedThb.mockResolvedValueOnce(4);
    expect(await contentSpentThisMonth()).toBe(6);
  });

  it("are not stopped by the owner's ceiling", async () => {
    const { payRound } = await import("@/lib/wallet/round");
    settings.result = { data: { content_budget_thb: 30 }, error: null };
    const cap = await payRound(
      { ok: true, paidBy: "wallet", holdId: "h", heldSatang: 1, multiplier: 2 },
      async () => ({ ok: false, cap: await contentCap() }),
    );
    expect(cap.cap).toBe(Infinity);
    expect(await contentCap()).toBe(30);
  });
});
