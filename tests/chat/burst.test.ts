import { beforeEach, describe, expect, it, vi } from "vitest";

let rows: { text: string }[] = [];
let fail: "error" | "throw" | null = null;
const asked: Record<string, unknown> = {};
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => {
    const chain = {
      select: () => chain,
      eq: (k: string, v: unknown) => { asked[k] = v; return chain; },
      gte: (k: string, v: unknown) => { asked[k] = v; return chain; },
      order: () => chain,
      limit: async () => {
        if (fail === "throw") throw new Error("network down");
        return fail === "error" ? { data: null, error: { message: "x" } } : { data: rows, error: null };
      },
    };
    return { from: () => chain };
  },
}));

const { wroteJustBefore } = await import("@/lib/chat/transcript");

beforeEach(() => { rows = []; fail = null; for (const k of Object.keys(asked)) delete asked[k]; });

describe("wroteJustBefore", () => {
  it("is true when another customer message came first in the burst", async () => {
    rows = [{ text: "Life Protect มรดกทุน 1,000,000" }, { text: "สนใจ" }];
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(true);
  });

  it("is false for the first message of the burst, even when a later one is already logged", async () => {
    rows = [{ text: "Life Protect มรดกทุน 1,000,000" }, { text: "สนใจ" }];
    expect(await wroteJustBefore("facebook", "h1", "Life Protect มรดกทุน 1,000,000")).toBe(false);
  });

  it("is false when the customer wrote nothing else lately", async () => {
    rows = [{ text: "สนใจ" }];
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(false);
  });

  it("counts two identical messages as first, so two turns never both stay silent", async () => {
    rows = [{ text: "สนใจ" }, { text: "สนใจ" }];
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(false);
  });

  it("is false when this message was never logged", async () => {
    rows = [{ text: "อย่างอื่น" }];
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(false);
  });

  it("looks only at this customer's own customer turns", async () => {
    rows = [{ text: "สนใจ" }];
    await wroteJustBefore("line", "h9", "สนใจ");
    expect(asked).toMatchObject({ channel: "line", user_hash: "h9", role: "customer" });
  });

  it("is false, and never throws, when the database is down", async () => {
    fail = "error";
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(false);
    fail = "throw";
    expect(await wroteJustBefore("facebook", "h1", "สนใจ")).toBe(false);
  });
});
