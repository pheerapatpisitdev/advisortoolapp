import { beforeEach, describe, expect, it, vi } from "vitest";

// Every query is a chain that ends in an await; `results` answers them in order.
const db = vi.hoisted(() => ({
  results: [] as Array<{ data?: unknown; error?: { code?: string; message: string } | null }>,
  calls: [] as Array<{ table: string; op: string; arg?: unknown; arg2?: unknown }>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const next = () => Promise.resolve({ data: null, error: null, ...(db.results.shift() ?? {}) });
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "insert", "upsert", "update", "eq", "is", "in", "gte", "order", "limit"]) {
        chain[op] = (arg?: unknown, arg2?: unknown) => { db.calls.push({ table, op, arg, arg2 }); return chain; };
      }
      chain.maybeSingle = () => next();
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => next().then(res, rej);
      return chain;
    },
  }),
}));

const store = await import("@/lib/members/pass-store");

const sent = (op: string) => db.calls.filter((c) => c.op === op).map((c) => [c.arg, c.arg2]);
const inserted = () => db.calls.filter((c) => c.op === "insert").map((c) => c.arg);

beforeEach(() => { db.results = []; db.calls = []; });

describe("ensureTrial", () => {
  it("treats a unique violation as done", async () => {
    db.results = [{ error: { code: "23505", message: "dup" } }];
    await expect(store.ensureTrial("m1", 3)).resolves.toBeUndefined();
    expect(inserted()).toEqual([{ member_id: "m1", kind: "trial", days: 3 }]);
  });
  it("throws on any other error", async () => {
    db.results = [{ error: { code: "XX000", message: "boom" } }];
    await expect(store.ensureTrial("m1", 3)).rejects.toThrow("boom");
  });
});

describe("addPaidPass", () => {
  const a = { sessionId: "cs_1", memberId: "m1", satang: 9900, paymentIntent: "pi_1" };
  it("adds a 30-day paid row", async () => {
    expect(await store.addPaidPass(a)).toBe("added");
    expect(inserted()[0]).toMatchObject({ kind: "paid", days: 30, member_id: "m1", stripe_session_id: "cs_1", payment_intent: "pi_1", amount_satang: 9900 });
  });
  it("maps duplicate and unknown member", async () => {
    db.results = [{ error: { code: "23505", message: "" } }];
    expect(await store.addPaidPass(a)).toBe("duplicate");
    db.results = [{ error: { code: "23503", message: "" } }];
    expect(await store.addPaidPass(a)).toBe("unknown");
  });
  it("throws on other errors", async () => {
    db.results = [{ error: { code: "XX000", message: "boom" } }];
    await expect(store.addPaidPass(a)).rejects.toThrow("boom");
  });
});

describe("revokePaidPass", () => {
  const a = { paymentIntent: "pi_1", reason: "refund" as const, ref: "re_1" };
  it("is unknown when no paid row has the payment", async () => {
    db.results = [{ data: null }];
    expect(await store.revokePaidPass(a)).toBe("unknown");
    expect(sent("eq")).toEqual(expect.arrayContaining([["kind", "paid"], ["payment_intent", "pi_1"]]));
    expect(inserted()).toEqual([]);
  });
  it("cancels the paid row by id", async () => {
    db.results = [{ data: { id: 7, member_id: "m1" } }, {}];
    expect(await store.revokePaidPass(a)).toBe("revoked");
    expect(inserted()).toEqual([{ member_id: "m1", kind: "revoked", days: 0, revokes: 7, note: "refund re_1" }]);
  });
  it("is duplicate when already revoked", async () => {
    db.results = [{ data: { id: 7, member_id: "m1" } }, { error: { code: "23505", message: "" } }];
    expect(await store.revokePaidPass(a)).toBe("duplicate");
  });
});

describe("linkPassPaymentIntent (review, 2026-10-13)", () => {
  it("writes the payment on the session's paid row that has none, and says it did", async () => {
    db.results = [{ data: [{ id: 7 }] }];
    expect(await store.linkPassPaymentIntent("cs_1", "pi_1")).toBe(true);
    expect(sent("update")).toEqual([[{ payment_intent: "pi_1" }, undefined]]);
    expect(sent("eq")).toEqual([["stripe_session_id", "cs_1"], ["kind", "paid"]]);
    expect(sent("is")).toEqual([["payment_intent", null]]);
    expect(db.calls.every((c) => c.table === "ins_member_passes")).toBe(true);
  });
  it("is false when no row changed", async () => {
    db.results = [{ data: [] }];
    expect(await store.linkPassPaymentIntent("cs_1", "pi_1")).toBe(false);
  });
  it("throws on a database error", async () => {
    db.results = [{ error: { message: "boom" } }];
    await expect(store.linkPassPaymentIntent("cs_1", "pi_1")).rejects.toThrow("boom");
  });
});

describe("passPaid", () => {
  it("is true when a row exists", async () => {
    db.results = [{ data: [{ id: 1 }] }];
    expect(await store.passPaid("cs_1", "m1")).toBe(true);
    expect(sent("eq")).toEqual(expect.arrayContaining([["kind", "paid"], ["stripe_session_id", "cs_1"], ["member_id", "m1"]]));
    db.results = [{ data: [] }];
    expect(await store.passPaid("cs_1", "m1")).toBe(false);
  });
});

describe("passRevenueSatang", () => {
  it("sums paid rows less the revoked ones", async () => {
    db.results = [
      { data: [{ id: 1, amount_satang: 9900 }, { id: 2, amount_satang: 9900 }] },
      { data: [{ revokes: 2 }] },
    ];
    const since = new Date("2026-10-01T00:00:00Z");
    expect(await store.passRevenueSatang(since)).toBe(9900);
    expect(sent("eq")).toEqual(expect.arrayContaining([["kind", "paid"], ["kind", "revoked"]]));
    expect(sent("gte")).toEqual([["created_at", since.toISOString()]]);
    expect(sent("in")).toEqual([["revokes", [1, 2]]]);
  });
  it("is 0 with no paid rows", async () => {
    db.results = [{ data: [] }];
    expect(await store.passRevenueSatang(new Date())).toBe(0);
  });
});

describe("passRows", () => {
  it("maps rows to camelCase", async () => {
    db.results = [{ data: [{ id: 1, kind: "trial", days: 3, revokes: null, created_at: "2026-10-13T00:00:00Z", amount_satang: null, note: null }] }];
    const rows = await store.passRows("m1");
    expect(sent("eq")).toEqual([["member_id", "m1"]]);
    expect(rows).toEqual([
      { id: 1, kind: "trial", days: 3, revokes: null, createdAt: "2026-10-13T00:00:00Z", amountSatang: null, note: null },
    ]);
  });
  it("groups rows by member in one query", async () => {
    db.results = [{ data: [
      { id: 1, member_id: "a", kind: "trial", days: 3, revokes: null, created_at: "x", amount_satang: null, note: null },
      { id: 2, member_id: "b", kind: "paid", days: 30, revokes: null, created_at: "y", amount_satang: 9900, note: null },
    ] }];
    const m = await store.passRowsOf(["a", "b", "c"]);
    expect(m.get("a")?.length).toBe(1);
    expect(m.get("b")?.[0].kind).toBe("paid");
    expect(m.get("c")).toBeUndefined();
  });
});

describe("passSettings", () => {
  it("falls back to the defaults with no row", async () => {
    db.results = [{ data: null }];
    expect((await store.passSettings()).enabled).toBe(false);
    expect(sent("select")).toEqual([["member_pass_enabled, member_pass_satang, member_trial_days, member_trial_credit_satang, member_pass_credit_satang", undefined]]);
  });
  it("throws on error", async () => {
    db.results = [{ error: { message: "boom" } }];
    await expect(store.passSettings()).rejects.toThrow("boom");
  });
});

describe("grantPass", () => {
  it("inserts a granted row with who gave it", async () => {
    await store.grantPass("m1", 7, "gift", "owner-1");
    expect(inserted()).toEqual([{ member_id: "m1", kind: "granted", days: 7, note: "gift", created_by: "owner-1" }]);
  });
});

describe("savePassSettings", () => {
  it("upserts the one settings row", async () => {
    await store.savePassSettings({ enabled: true, satang: 19900, trialDays: 3, trialCreditSatang: 1500, creditSatang: 5000 });
    const up = db.calls.find((c) => c.op === "upsert");
    expect(up?.arg).toEqual({
      id: true, member_pass_enabled: true, member_pass_satang: 19900, member_trial_days: 3,
      member_trial_credit_satang: 1500, member_pass_credit_satang: 5000,
      updated_at: expect.any(String),
    });
    expect(up?.arg2).toEqual({ onConflict: "id" });
  });
});
