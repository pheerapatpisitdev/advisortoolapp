import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * บัญชีสาธิต (owner chose 1ก 2ข 3ก, 2026-11-11): code 012345 signs in a shared account of our own, whose AI is
 * free under a daily cap, with LINE told at 80% and when full, and whose sign-out does not end the others'.
 */

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }) }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);
const auth = vi.hoisted(() => ({ startSession: vi.fn(), endSession: vi.fn(), readSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => auth);
const epoch = vi.hoisted(() => ({ endEverySession: vi.fn() }));
vi.mock("@/lib/auth/epoch", () => epoch);
const who = vi.hoisted(() => ({ agentsByCode: vi.fn(), staffRow: vi.fn() }));
vi.mock("@/lib/auth/viewer", () => who);
const line = vi.hoisted(() => ({ alertDemo: vi.fn() }));
vi.mock("@/lib/line/owner-alert", () => line);
vi.mock("@/lib/supabase/admin", async () => {
  const { db } = await import("../helpers/fake-db");
  return { supabaseAdmin: () => db.client };
});

import { db, has } from "../helpers/fake-db";
const demo = await import("@/lib/auth/demo");
const { signIn, signOut } = await import("@/app/login/actions");

const ROW = { open: true, daily_cap_satang: 30000, warned_day: null, full_day: null, revoked_at: null, wiped_at: null };

const form = (code: string) => {
  const fd = new FormData();
  fd.set("code", code);
  fd.set("next", "/home");
  return fd;
};

/** the demo row, what it spent today (baht), and the alert stamps answering as written */
function answer(row: typeof ROW | null, spentBaht = 0) {
  db.on("ins_demo", (steps) => (has(steps, "update") ? { data: [{ id: true }] } : { data: row }));
  db.on("rpc:ins_demo_spent", () => ({ data: spentBaht }));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.on("ins_login_attempts", (steps) => (has(steps, "insert") ? { data: { id: "a1" } } : has(steps, "update") || has(steps, "delete") ? {} : { count: 1 }));
  answer(ROW);
});

describe("admitDemo", () => {
  it("lets the shared account in as kind demo, with no room and no staff rights", () => {
    const v = demo.admitDemo(ROW, Date.now());
    expect(v).toMatchObject({ kind: "demo", agentId: demo.DEMO_ID, code: "012345", tenantId: null, staff: null });
  });

  it("keeps everybody out while it is closed, and ends sessions issued before it was closed", () => {
    expect(demo.admitDemo({ ...ROW, open: false }, Date.now())).toBeNull();
    const closedAt = "2026-11-11T10:00:00Z";
    expect(demo.admitDemo({ ...ROW, revoked_at: closedAt }, Date.parse(closedAt) - 1)).toBeNull();
    expect(demo.admitDemo({ ...ROW, revoked_at: closedAt }, Date.parse(closedAt) + 1)).not.toBeNull();
  });
});

describe("the daily cap (2ข)", () => {
  it("is ok below 80%, warns from 80%, and is full at the cap or with no cap", () => {
    expect(demo.capState(23999, 30000)).toBe("ok");
    expect(demo.capState(24000, 30000)).toBe("warn");
    expect(demo.capState(30000, 30000)).toBe("full");
    expect(demo.capState(0, 0)).toBe("full");
  });

  it("lets a round through under the cap without telling anybody", async () => {
    answer(ROW, 100);
    expect(await demo.demoRefusal()).toBeNull();
    expect(line.alertDemo).not.toHaveBeenCalled();
  });

  it("tells the owner's LINE at 80% once and still lets the round through", async () => {
    answer(ROW, 250);
    expect(await demo.demoRefusal()).toBeNull();
    expect(line.alertDemo).toHaveBeenCalledTimes(1);
    expect(line.alertDemo.mock.calls[0][0]).toContain("฿250");
  });

  it("refuses when full and tells the owner", async () => {
    answer(ROW, 300);
    expect(await demo.demoRefusal()).toBe(demo.DEMO_FULL);
    expect(line.alertDemo).toHaveBeenCalledTimes(1);
  });

  it("does not tell the owner twice in a day", async () => {
    answer({ ...ROW, full_day: demo.bkkDay() }, 300);
    expect(await demo.demoRefusal()).toBe(demo.DEMO_FULL);
    expect(line.alertDemo).not.toHaveBeenCalled();
  });

  it("refuses when what was spent cannot be read: free AI nobody counts is not run", async () => {
    db.on("rpc:ins_demo_spent", () => ({ error: { message: "down" } }));
    expect(await demo.demoRefusal()).toBe(demo.DEMO_UNREAD);
  });

  it("counts from midnight Bangkok", () => {
    const at = new Date("2026-11-11T18:30:00Z"); // 01:30 on the 12th in Bangkok
    expect(demo.bkkDay(at)).toBe("2026-11-12");
    expect(demo.dayStart(at).toISOString()).toBe("2026-11-11T17:00:00.000Z");
    expect(demo.monthStartBkk(at).toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });
});

describe("signing in with 012345", () => {
  it("starts the demo's session without asking UnitOS", async () => {
    expect(await signIn(form("012345"))).toBeUndefined();
    expect(who.agentsByCode).not.toHaveBeenCalled();
    expect(auth.startSession).toHaveBeenCalledWith(demo.DEMO_ID);
    expect(nav.redirect).toHaveBeenCalledWith("/home");
  });

  it("says the account is closed when the owner closed it", async () => {
    answer({ ...ROW, open: false });
    expect(await signIn(form("012345"))).toEqual({ error: "บัญชีทดลองใช้ปิดอยู่ในตอนนี้" });
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it("signs one customer out without signing out the others", async () => {
    auth.readSession.mockResolvedValue({ agentId: demo.DEMO_ID, issuedAt: Date.now() });
    await signOut();
    expect(epoch.endEverySession).not.toHaveBeenCalled();
    expect(auth.endSession).toHaveBeenCalled();
  });
});

describe("a Studio round from the demo", () => {
  const viewer = demo.admitDemo(ROW, Date.now())!;

  it("is free while under the cap, and writes nothing to a wallet", async () => {
    answer(ROW, 10);
    const { takeRound } = await import("@/lib/auth/quota");
    expect(await takeRound(viewer, "ai-write")).toEqual({ ok: true, paidBy: "staff", agentId: demo.DEMO_ID });
    expect(db.writes("ins_wallet_holds", "insert")).toHaveLength(0);
  });

  it("is refused once the day's cap is spent", async () => {
    answer(ROW, 300);
    const { takeRound, allowanceOf } = await import("@/lib/auth/quota");
    expect(await takeRound(viewer, "ai-write")).toEqual({ ok: false, refusal: demo.DEMO_FULL });
    expect(await allowanceOf(viewer)).toEqual({ limit: null, used: 0 });
  });
});
