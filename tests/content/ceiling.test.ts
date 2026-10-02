import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/**
 * The owner's content ceiling, asked before a round is counted (review, 2026-10-01): a round it
 * would refuse inside costs the agent nothing — no free round, no wallet hold.
 */

const store = vi.hoisted(() => ({ contentSpentThisMonth: vi.fn(), contentCap: vi.fn() }));
const quota = vi.hoisted(() => ({ allowanceOf: vi.fn(), overAllowance: (a: { limit: number | null; used: number }) => (a.limit !== null && a.used >= a.limit ? "used" : null) }));
vi.mock("@/lib/content/store", () => store);
vi.mock("@/lib/auth/quota", () => quota);

const { ceilingBeforeRound } = await import("@/lib/content/ceiling");
const AGENT = { agentId: "a1", staff: null } as unknown as Viewer;
const OWNER = { agentId: "o1", staff: { owner: true, publish: true, connect: true, admin: true } } as unknown as Viewer;
const ASSISTANT = { agentId: "s1", staff: { owner: false, publish: true, connect: true, admin: true } } as unknown as Viewer;

beforeEach(() => {
  vi.clearAllMocks();
  store.contentCap.mockResolvedValue(30);
  quota.allowanceOf.mockResolvedValue({ limit: 10, used: 3 });
});

describe("the ceiling before a round", () => {
  it("lets the round be taken while there is money under it, without counting anyone's rounds", async () => {
    store.contentSpentThisMonth.mockResolvedValue(29.9);
    expect(await ceilingBeforeRound(AGENT)).toBeNull();
    expect(quota.allowanceOf).not.toHaveBeenCalled();
  });

  it("refuses the owner's round and a free round once it is reached", async () => {
    store.contentSpentThisMonth.mockResolvedValue(30);
    expect(await ceilingBeforeRound(OWNER)).toBe(30);
    expect(await ceilingBeforeRound(AGENT)).toBe(30);
    expect(await ceilingBeforeRound(ASSISTANT)).toBe(30);
  });

  it("lets through an agent whose free rounds are used: their wallet pays, and the ceiling is the owner's", async () => {
    store.contentSpentThisMonth.mockResolvedValue(31);
    quota.allowanceOf.mockResolvedValue({ limit: 10, used: 10 });
    expect(await ceilingBeforeRound(AGENT)).toBeNull();
    // an assistant pays from their own wallet too (owner, 2026-10-02)
    expect(await ceilingBeforeRound(ASSISTANT)).toBeNull();
  });

  it("leaves a ledger it cannot read to the round's own check", async () => {
    store.contentSpentThisMonth.mockRejectedValue(new Error("db down"));
    expect(await ceilingBeforeRound(AGENT)).toBeNull();
  });
});
