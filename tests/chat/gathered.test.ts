import { beforeEach, describe, expect, it, vi } from "vitest";

/** The latest message of a burst answers for all of it (owner, 2026-10-11). */
const rows = vi.hoisted(() => ({ list: [] as { role: string; text: string }[], fail: false }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const q = {
        select: () => q, eq: () => q, gte: () => q, order: () => q,
        limit: async () => (rows.fail ? { data: null, error: { message: "down" } } : { data: rows.list, error: null }),
      };
      return q;
    },
  }),
}));

const { gathered } = await import("@/lib/chat/transcript");

beforeEach(() => { rows.list = []; rows.fail = false; });

describe("a burst of messages", () => {
  it("is answered once, by the latest, with every line since the bot last spoke", async () => {
    rows.list = [
      { role: "customer", text: "สวัสดี" }, { role: "bot", text: "สวัสดีครับ" },
      { role: "customer", text: "ชาย 35" }, { role: "customer", text: "ทุน 2 ล้าน" },
    ];
    expect(await gathered("facebook", "u", "ชาย 35")).toEqual({ latest: false, text: "ชาย 35" });
    expect(await gathered("facebook", "u", "ทุน 2 ล้าน")).toEqual({ latest: true, text: "ชาย 35\nทุน 2 ล้าน" });
  });

  it("starts after an agent's words too", async () => {
    rows.list = [{ role: "customer", text: "ก" }, { role: "agent", text: "ครับ" }, { role: "customer", text: "ข" }];
    expect(await gathered("line", "u", "ข")).toEqual({ latest: true, text: "ข" });
  });

  it("answers a message alone when the transcript cannot be read", async () => {
    rows.fail = true;
    expect(await gathered("facebook", "u", "ชาย 35")).toEqual({ latest: true, text: "ชาย 35" });
  });

  it("keeps the latest message's own words, not the scrubbed copy", async () => {
    rows.list = [{ role: "customer", text: "ชาย 35" }, { role: "customer", text: "โทร [เบอร์]" }];
    expect(await gathered("facebook", "u", "โทร 0812345678")).toEqual({ latest: true, text: "ชาย 35\nโทร 0812345678" });
  });
});
