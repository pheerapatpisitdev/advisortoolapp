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
// not gated unless a test says so: an agent's rounds never depend on a member's pass
const access = vi.hoisted(() => ({ memberAccess: vi.fn() }));
vi.mock("@/lib/members/access", async (orig) => ({
  ...(await orig<typeof import("@/lib/members/access")>()),
  memberAccess: access.memberAccess,
}));

const { allowanceOf, freeWindow, FREE_ROUNDS, FREE_ROUNDS_FROM, overAllowance } = await import("@/lib/auth/quota");
const { DEFAULT_PASS_SETTINGS } = await import("@/lib/members/pass");

const agent: Viewer = {
  kind: "unitos", agentId: "00000000-0000-4000-8000-000000000002", code: "1", name: "a", tenantId: "t", tenantSlug: "t", tenantName: "t",
  trial: false, staff: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.count = 0;
  db.since = "";
  access.memberAccess.mockResolvedValue({ gated: false });
});

describe("the free rounds", () => {
  it("are none for a UnitClub agent, paying room or trial room: the ฿15 starter credit took their place (owner, 2026-10-18)", async () => {
    expect(FREE_ROUNDS).toBe(10);
    expect(await allowanceOf(agent)).toEqual({ limit: 0, used: 0 });
    expect(await allowanceOf({ ...agent, trial: true })).toEqual({ limit: 0, used: 0 });
  });

  it("still count every round since 10 October 2026 11:10 in Thailand, never from the start of a month", async () => {
    db.count = 3;
    expect(await allowanceOf(agent)).toEqual({ limit: 0, used: 3 });
    expect(db.since).toBe(new Date("2026-10-10T11:10:00+07:00").toISOString());
    expect(FREE_ROUNDS_FROM.toISOString()).toBe("2026-10-10T04:10:00.000Z");
  });

  it("are not the owner's to count", async () => {
    expect(await allowanceOf({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } }))
      .toEqual({ limit: null, used: 0 });
  });

  it("are an assistant's as any agent's, whatever was ticked (owner, 2026-10-02): none, the credit pays", async () => {
    db.count = 4;
    expect(await allowanceOf({ ...agent, staff: { owner: false, publish: true, connect: true, admin: true } }))
      .toEqual({ limit: 0, used: 4 });
  });
});

describe("a member's rounds under the pass (owner, 2026-10-13)", () => {
  const member: Viewer = { ...agent, kind: "member", tenantId: null };
  const on = { ...DEFAULT_PASS_SETTINGS, enabled: true };
  const start = new Date("2026-10-12T03:00:00Z");
  const live = { status: "live", period: { rowId: 1, kind: "paid", start, end: new Date("2026-11-11T03:00:00Z") }, end: new Date("2026-11-11T03:00:00Z") };

  it("are none under a live pass: its credit pays instead (owner, 2026-10-17)", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: live, settings: on });
    expect(await freeWindow(member)).toEqual({ limit: 0, from: start });
    db.count = 4;
    expect(await allowanceOf(member)).toEqual({ limit: 0, used: 4 });
    expect(db.since).toBe(start.toISOString());
  });

  it("are the one-time ten while the switch is off", async () => {
    access.memberAccess.mockResolvedValue({ gated: false });
    expect(await freeWindow(member)).toEqual({ limit: FREE_ROUNDS, from: FREE_ROUNDS_FROM });
  });

  it("fall back to the one-time ten when the pass is not live", async () => {
    access.memberAccess.mockResolvedValue({ gated: true, state: { status: "expired", end: start }, settings: on });
    expect(await freeWindow(member)).toEqual({ limit: FREE_ROUNDS, from: FREE_ROUNDS_FROM });
  });

  it("let an unreadable pass throw on a display page, as an unreadable count does", async () => {
    access.memberAccess.mockRejectedValue(new Error("down"));
    await expect(allowanceOf(member)).rejects.toThrow("down");
  });

  it("are none for an agent, whatever the pass says (owner, 2026-10-18)", async () => {
    expect(await freeWindow(agent)).toEqual({ limit: 0, from: FREE_ROUNDS_FROM });
  });

  it("are never looked up for the owner", async () => {
    await allowanceOf({ ...agent, staff: { owner: true, publish: true, connect: true, admin: true } });
    expect(access.memberAccess).not.toHaveBeenCalled();
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
