import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The route is reachable from the internet and runs the sync, so it is the one place a
 * stranger could make this app spend its Meta rate limit. A scheduler's bearer is the whole
 * gate: the database's token (its cron calls since 2026-11-02) or Vercel's CRON_SECRET.
 */

const dbToken = vi.hoisted(() => ({ ok: false }));
vi.mock("@/lib/chat/cron-token", () => ({ cronCallerIsOurs: async (h: string | null) => dbToken.ok && h === "Bearer db-token" }));

const calls: unknown[] = [];
let next: { accounts: number; rows: number; errors: { actId: string; name: string; message: string }[] } =
  { accounts: 1, rows: 2, errors: [] };
vi.mock("@/lib/ads/sync", () => ({
  syncAds: async (opts: unknown) => { calls.push(opts); return next; },
}));

const { GET } = await import("@/app/api/facebook/ads/sync/route");
const req = (auth?: string) => new Request("https://x.test/api/facebook/ads/sync", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  calls.length = 0;
  delete process.env.CRON_SECRET;
  dbToken.ok = false;
  next = { accounts: 1, rows: 2, errors: [] };
});

describe("the sync route", () => {
  it("refuses everyone when neither scheduler's token matches", async () => {
    const res = await GET(req("Bearer anything"));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("lets in the database's scheduler with its token", async () => {
    dbToken.ok = true;
    expect((await GET(req("Bearer db-token"))).status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("refuses the wrong bearer", async () => {
    process.env.CRON_SECRET = "s3";
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    // same length as the real one, differing only at the end — the constant-time path
    expect((await GET(req("Bearer s4"))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("answers 500 when every account failed, so the cron's record is not green", async () => {
    process.env.CRON_SECRET = "s3";
    next = { accounts: 2, rows: 0, errors: [
      { actId: "act_1", name: "หนึ่ง", message: "x" },
      { actId: "act_2", name: "สอง", message: "y" },
    ] };
    const res = await GET(req("Bearer s3"));
    expect(res.status).toBe(500);
    expect((await res.json()).errors).toHaveLength(2);
  });

  it("still answers 200 when only some accounts failed", async () => {
    process.env.CRON_SECRET = "s3";
    next = { accounts: 2, rows: 5, errors: [{ actId: "act_1", name: "หนึ่ง", message: "x" }] };
    expect((await GET(req("Bearer s3"))).status).toBe(200);
  });

  it("runs the sync for the right one and says what it did", async () => {
    process.env.CRON_SECRET = "s3";
    const res = await GET(req("Bearer s3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: 1, rows: 2, errors: [] });
    expect(calls).toHaveLength(1);
  });
});
