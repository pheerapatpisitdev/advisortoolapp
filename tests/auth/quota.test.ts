import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Viewer } from "@/lib/auth/access";

/** Ten free AI rounds for every agent, once, counted from 10 October 2026 11:10 Thailand (owner, 2026-10-10). */

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
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

beforeEach(() => {
  db.count = 0;
  db.since = "";
});

describe("the free rounds", () => {
  it("are ten, for a paying room and a trial room alike", async () => {
    expect(FREE_ROUNDS).toBe(10);
    expect(await allowanceOf(agent)).toEqual({ limit: 10, used: 0 });
    expect(await allowanceOf({ ...agent, trial: true })).toEqual({ limit: 10, used: 0 });
  });

  it("count every round since 10 October 2026 11:10 in Thailand, never from the start of a month", async () => {
    db.count = 3;
    expect(await allowanceOf(agent)).toEqual({ limit: 10, used: 3 });
    expect(db.since).toBe(new Date("2026-10-10T11:10:00+07:00").toISOString());
    expect(FREE_ROUNDS_FROM.toISOString()).toBe("2026-10-10T04:10:00.000Z");
  });

  it("are not the owner's to count", async () => {
    expect(await allowanceOf({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }))
      .toEqual({ limit: null, used: 0 });
  });

  it("are an assistant's as any agent's, whatever was ticked (owner, 2026-10-02)", async () => {
    db.count = 4;
    expect(await allowanceOf({ ...agent, staff: { owner: false, publish: true, connect: true, admin: true } }))
      .toEqual({ limit: 10, used: 4 });
  });
});

describe("overAllowance", () => {
  it("lets the owner through, whatever they have used", () => {
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
