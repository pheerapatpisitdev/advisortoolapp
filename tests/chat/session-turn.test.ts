import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two quick messages from one customer, answered at once.
 *
 * Both loaded the same session and the later save wrote over the earlier's — the age given in
 * the first message was gone by the second (review, 2026-10-01). saveTurn writes only over the
 * row it read, and on a collision reads again and lays its own part over the other's.
 */

type Row = Record<string, unknown> & { updated_at: string };
let row: Row | null = null;
/** a save another turn makes between this turn's read and its write */
let interloper: (() => void) | null = null;
/** the database refusing every write */
let broken = false;
const writes: { kind: string; values: Record<string, unknown> }[] = [];
let clock = 0;
// a minute ago: a row older than a day is a new visit (session.ts MAX_AGE_HOURS), so a fixed date goes stale
const base = Date.now() - 60_000;
const stamp = () => new Date(base + ++clock).toISOString();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ? { ...row } : null }) }) }) }),
      insert: async (values: Record<string, unknown>) => {
        if (interloper) { const run = interloper; interloper = null; run(); }
        if (row) return { error: { code: "23505", message: "duplicate key" } };
        writes.push({ kind: "insert", values });
        row = { ...values, updated_at: stamp() } as Row;
        return { error: null };
      },
      update: (values: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const q = {
          eq: (k: string, v: unknown) => { filters[k] = v; return q; },
          select: async () => {
            if (broken) throw new Error("connection reset");
            if (interloper) { const run = interloper; interloper = null; run(); }
            if (!row || row.updated_at !== filters.updated_at) return { data: [], error: null };
            writes.push({ kind: "update", values });
            row = { ...row, ...values, updated_at: stamp() } as Row;
            return { data: [{ user_hash: "h" }], error: null };
          },
        };
        return q;
      },
      upsert: async (values: Record<string, unknown>) => {
        writes.push({ kind: "upsert", values });
        row = { ...(row ?? {}), ...values, updated_at: stamp() } as Row;
        return { error: null };
      },
    }),
  }),
}));

const { loadSession, mergeSlots, saveTurn } = await import("@/lib/chat/session");

const now = () => new Date().toISOString();

beforeEach(() => {
  row = null;
  interloper = null;
  broken = false;
  writes.length = 0;
});

describe("mergeSlots", () => {
  it("lays what this turn changed over what the other turn saved", () => {
    const base = { intent: "quote", product: "lifeprotect" } as never;
    const mine = { intent: "quote", product: "lifeprotect", coverWanted: 1_000_000 } as never;
    const theirs = { intent: "quote", product: "lifeprotect", age: 35, sex: "M" } as never;
    expect(mergeSlots(base, mine, theirs)).toEqual({ intent: "quote", product: "lifeprotect", age: 35, sex: "M", coverWanted: 1_000_000 });
  });

  it("drops a key this turn dropped, and keeps one it did not touch", () => {
    const base = { product: "legacy", age: 40, budget: { baht: 1000, per: "month" } } as never;
    const mine = { product: "legacy", age: 40 } as never;
    const theirs = { product: "legacy", age: 41, budget: { baht: 1000, per: "month" } } as never;
    expect(mergeSlots(base, mine, theirs)).toEqual({ product: "legacy", age: 41 });
  });

  it("is null when nothing is left", () => {
    expect(mergeSlots(null, null, null)).toBeNull();
  });
});

describe("saving one bot turn", () => {
  it("writes the turn over the row it read", async () => {
    row = { messages: [{ role: "user", content: "สวัสดี" }], slots: {}, muted_until: null, updated_at: now(), conversation_id: "c1" };
    const base = await loadSession("facebook", "h");
    await saveTurn("facebook", "h", {
      base, added: [{ role: "user", content: "ชาย 35" }, { role: "assistant", content: "ทุนเท่าไหร่ครับ" }],
      slots: { intent: "quote", age: 35, sex: "M" } as never, conversationId: "c1",
    });
    expect(writes.map((w) => w.kind)).toEqual(["update"]);
    expect(row!.messages).toHaveLength(3);
    expect(row!.slots).toEqual({ intent: "quote", age: 35, sex: "M" });
  });

  it("creates the row for someone who has never written, without an upsert", async () => {
    const base = await loadSession("line", "h");
    await saveTurn("line", "h", {
      base, added: [{ role: "user", content: "hi" }, { role: "assistant", content: "สวัสดีครับ" }],
      slots: null, conversationId: "c2",
    });
    expect(writes.map((w) => w.kind)).toEqual(["insert"]);
    expect(row!.conversation_id).toBe("c2");
  });

  it("keeps the other turn's words and slots when it saved first", async () => {
    row = { messages: [], slots: { intent: "quote", product: "lifeprotect" }, muted_until: null, updated_at: now(), conversation_id: "c1" };
    const base = await loadSession("facebook", "h");
    // the customer's first message ("ชาย 35") is answered and saved while this one is thinking
    interloper = () => {
      row = {
        ...row!,
        messages: [{ role: "user", content: "ชาย 35" }, { role: "assistant", content: "ทุนเท่าไหร่ครับ" }],
        slots: { intent: "quote", product: "lifeprotect", age: 35, sex: "M" },
        updated_at: stamp(),
      };
    };
    await saveTurn("facebook", "h", {
      base, added: [{ role: "user", content: "ทุน 1 ล้าน" }, { role: "assistant", content: "ขออายุครับ" }],
      slots: { intent: "quote", product: "lifeprotect", coverWanted: 1_000_000 } as never, conversationId: "c1",
    });
    expect(row!.messages).toEqual([
      { role: "user", content: "ชาย 35" }, { role: "assistant", content: "ทุนเท่าไหร่ครับ" },
      { role: "user", content: "ทุน 1 ล้าน" }, { role: "assistant", content: "ขออายุครับ" },
    ]);
    expect(row!.slots).toEqual({ intent: "quote", product: "lifeprotect", age: 35, sex: "M", coverWanted: 1_000_000 });
  });

  it("never writes the mute or the agent's stamp", async () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    row = { messages: [], slots: {}, muted_until: until, handed_over_at: null, updated_at: now(), conversation_id: "c1" };
    const base = await loadSession("facebook", "h");
    await saveTurn("facebook", "h", { base, added: [], slots: null, conversationId: "c1" });
    expect(writes[0].values).not.toHaveProperty("muted_until");
    expect(writes[0].values).not.toHaveProperty("handed_over_at");
    expect(row!.muted_until).toBe(until);
  });

  it("does not throw when the database will not take it: the customer has been answered", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    row = { messages: [], slots: {}, updated_at: now() };
    const base = await loadSession("facebook", "h");
    broken = true;
    await expect(saveTurn("facebook", "h", { base, added: [], slots: null, conversationId: null })).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
