import { beforeEach, describe, expect, it, vi } from "vitest";

// Every query is a chain that ends in an await; `results` answers them in order.
const db = vi.hoisted(() => ({
  results: [] as Array<{ data?: unknown; error?: { code?: string; message: string } | null }>,
  calls: [] as Array<{ table: string; op: string; arg?: unknown }>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const next = () => Promise.resolve({ data: null, error: null, ...(db.results.shift() ?? {}) });
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "insert", "upsert", "eq", "in", "gte", "order", "limit"]) {
        chain[op] = (arg?: unknown) => { db.calls.push({ table, op, arg }); return chain; };
      }
      chain.maybeSingle = () => next();
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => next().then(res, rej);
      return chain;
    },
  }),
}));

const store = await import("@/lib/members/pass-store");

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

describe("passPaid", () => {
  it("is true when a row exists", async () => {
    db.results = [{ data: [{ id: 1 }] }];
    expect(await store.passPaid("cs_1", "m1")).toBe(true);
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
    expect(await store.passRevenueSatang(new Date())).toBe(9900);
  });
  it("is 0 with no paid rows", async () => {
    db.results = [{ data: [] }];
    expect(await store.passRevenueSatang(new Date())).toBe(0);
  });
});

describe("passRows", () => {
  it("maps rows to camelCase", async () => {
    db.results = [{ data: [{ id: 1, kind: "trial", days: 3, revokes: null, created_at: "2026-10-13T00:00:00Z", amount_satang: null, note: null }] }];
    expect(await store.passRows("m1")).toEqual([
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
  });
  it("throws on error", async () => {
    db.results = [{ error: { message: "boom" } }];
    await expect(store.passSettings()).rejects.toThrow("boom");
  });
});
