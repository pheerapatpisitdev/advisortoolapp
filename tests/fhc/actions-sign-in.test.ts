import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The check's two actions ask who is calling (review, 2026-10-11): the /fhc page was gated
 * but its actions were not, so anyone holding their ids could spend the bots' AI budget.
 */
const viewer = vi.hoisted(() => ({ getViewer: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => viewer);
const ai = vi.hoisted(() => ({
  pickOrder: vi.fn(async () => ({ order: ["life", "health", "ci", "saving"], reason: "" })),
  explainHealth: vi.fn(),
  explain: vi.fn(),
}));
vi.mock("@/lib/plan/order", async (orig) => ({ ...(await orig<typeof import("@/lib/plan/order")>()), pickOrder: ai.pickOrder }));
vi.mock("@/lib/fhc/summary", async (orig) => ({ ...(await orig<typeof import("@/lib/fhc/summary")>()), explainHealth: ai.explainHealth }));
vi.mock("@/lib/plan/prose", async (orig) => ({ ...(await orig<typeof import("@/lib/plan/prose")>()), explain: ai.explain }));
vi.mock("@/lib/plan/log", () => ({ logRun: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { explainFhc, runFhc } = await import("@/app/fhc/actions");

const FORM = { age: 35, sex: "M", income: 40_000, expense: 25_000 };

beforeEach(() => vi.clearAllMocks());

describe("the health check signed out", () => {
  it("runs nothing and says to sign in", async () => {
    viewer.getViewer.mockResolvedValue(null);
    expect(await runFhc(FORM)).toEqual({ ok: false, error: "กรุณาเข้าสู่ระบบก่อน" });
    expect(ai.pickOrder).not.toHaveBeenCalled();
  });

  it("explains nothing", async () => {
    viewer.getViewer.mockResolvedValue(null);
    expect(await explainFhc(FORM)).toBeNull();
    expect(ai.explainHealth).not.toHaveBeenCalled();
    expect(ai.explain).not.toHaveBeenCalled();
  });
});

describe("the health check signed in", () => {
  it("runs as before", async () => {
    viewer.getViewer.mockResolvedValue({ agentId: "a1" });
    const reply = await runFhc(FORM);
    expect(reply.ok).toBe(true);
    expect(ai.pickOrder).toHaveBeenCalledOnce();
  });
});
