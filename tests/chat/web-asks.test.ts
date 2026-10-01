import { beforeEach, describe, expect, it, vi } from "vitest";

/** The per-address daily count behind the free-question cookie (review, 2026-10-01). */

const db = vi.hoisted(() => ({
  result: { data: true as unknown, error: null as { code?: string; message: string } | null },
  calls: [] as { fn: string; args: unknown }[],
  throws: false,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    if (db.throws) throw new Error("no service key");
    return { rpc: async (fn: string, args: unknown) => { db.calls.push({ fn, args }); return db.result; } };
  },
}));

const { claimWebAsk, WEB_ASKS_PER_IP_PER_DAY } = await import("@/lib/chat/web-asks");

beforeEach(() => {
  db.result = { data: true, error: null };
  db.calls.length = 0;
  db.throws = false;
});

describe("claimWebAsk", () => {
  it("asks the database for one of today's asks at the documented limit", async () => {
    expect(await claimWebAsk("1.2.3.4")).toBe(true);
    expect(db.calls).toEqual([{ fn: "ins_copilot_claim_ask", args: { p_ip: "1.2.3.4", p_max: WEB_ASKS_PER_IP_PER_DAY } }]);
  });

  it("refuses when the address has used its day", async () => {
    db.result = { data: false, error: null };
    expect(await claimWebAsk("1.2.3.4")).toBe(false);
  });

  it("stays open, and says so, when the count cannot be read", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    db.result = { data: null, error: { code: "PGRST202", message: "not found" } };
    expect(await claimWebAsk("1.2.3.4")).toBe(true);
    db.throws = true;
    expect(await claimWebAsk("1.2.3.4")).toBe(true);
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });

  it("lets a dozen real visitors share one address in a day", () => {
    expect(WEB_ASKS_PER_IP_PER_DAY).toBeGreaterThanOrEqual(12 * 3);
  });
});
