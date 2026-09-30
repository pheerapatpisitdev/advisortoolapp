import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Five free AI rounds for every agent, once, counted from 1 October 2026 (owner, 2026-09-30). */

const db = vi.hoisted(() => ({ count: 0, since: "" }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            gte: async (_col: string, since: string) => {
              db.since = since;
              return { count: db.count, error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/wallet/store", () => ({ walletSettings: vi.fn(), holdWallet: vi.fn() }));

const { allowanceOf, FREE_ROUNDS, FREE_ROUNDS_FROM, overAllowance } = await import("@/lib/auth/quota");

const agent: Viewer = {
  agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

beforeEach(() => {
  db.count = 0;
  db.since = "";
});

describe("the free rounds", () => {
  it("are five, for a paying room and a trial room alike", async () => {
    expect(FREE_ROUNDS).toBe(5);
    expect(await allowanceOf(agent)).toEqual({ limit: 5, used: 0 });
    expect(await allowanceOf({ ...agent, trial: true })).toEqual({ limit: 5, used: 0 });
  });

  it("count every round since 1 October 2026 in Thailand, never from the start of a month", async () => {
    db.count = 3;
    expect(await allowanceOf(agent)).toEqual({ limit: 5, used: 3 });
    expect(db.since).toBe(new Date("2026-10-01T00:00:00+07:00").toISOString());
    expect(FREE_ROUNDS_FROM.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("are not staff's to count", async () => {
    expect(await allowanceOf({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }))
      .toEqual({ limit: null, used: 0 });
  });
});

describe("overAllowance", () => {
  it("lets staff through, whatever they have used", () => {
    expect(overAllowance({ limit: null, used: 999 })).toBeNull();
  });

  it("lets an agent through until the five are used, then says so without a month", () => {
    expect(overAllowance({ limit: 5, used: 4 })).toBeNull();
    const refusal = overAllowance({ limit: 5, used: 5 });
    expect(refusal).toMatch(/รอบฟรีครบ 5 ครั้ง/);
    expect(refusal).not.toMatch(/เดือน/);
  });

  it("treats an allowance of 0 as closed", () => {
    expect(overAllowance({ limit: 0, used: 0 })).not.toBeNull();
  });
});
