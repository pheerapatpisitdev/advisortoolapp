import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who used AI (owner, 2026-10-10): every ledger line made inside a question or a round carries
 * the person and the question, and the owner's page sums them per person.
 */

const inserted: Record<string, unknown>[] = [];
let missingColumn = false;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (missingColumn && "agent_id" in row) return { error: { code: "PGRST204", message: "no agent_id column" } };
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

const { recordUsage } = await import("@/lib/ai/ledger");
const { asWho } = await import("@/lib/ai/who");
const { byPerson, NO_ONE } = await import("@/app/admin/ai/people");

beforeEach(() => {
  inserted.length = 0;
  missingColumn = false;
});

describe("the ledger line", () => {
  it("names the person and ties one question's calls together", async () => {
    await asWho("agent-1", async () => {
      await recordUsage("m", "route", 1, 1, 0.01);
      await recordUsage("m", "copilot", 1, 1, 0.1);
    });
    await asWho("agent-1", () => recordUsage("m", "route", 1, 1, 0.01));
    expect(inserted.map((r) => r.agent_id)).toEqual(["agent-1", "agent-1", "agent-1"]);
    expect(inserted[0].ask_id).toBe(inserted[1].ask_id);
    expect(inserted[2].ask_id).not.toBe(inserted[0].ask_id);
  });

  it("names no one outside a question, as for the customer bots", async () => {
    await recordUsage("m", "route", 1, 1, 0.01);
    await asWho(null, () => recordUsage("m", "route", 1, 1, 0.01));
    expect(inserted).toHaveLength(2);
    for (const r of inserted) expect(r).not.toHaveProperty("agent_id");
  });

  it("still records the cost when the columns are not in the database yet", async () => {
    missingColumn = true;
    await asWho("agent-1", () => recordUsage("m", "route", 1, 1, 0.01));
    expect(inserted).toEqual([{ model: "m", task: "route", input_tokens: 1, output_tokens: 1, cost_thb: 0.01 }]);
  });
});

describe("the per-person table", () => {
  it("splits chat from Studio, highest spender first, the unnamed line last", () => {
    const people = byPerson([
      { agent_id: null, studio: false, asks: 0, calls: 500, cost_thb: "9.5" },
      { agent_id: "a", studio: false, asks: 3, calls: 8, cost_thb: "0.4" },
      { agent_id: "b", studio: true, asks: 2, calls: 6, cost_thb: "3" },
      { agent_id: "b", studio: false, asks: "5", calls: 12, cost_thb: 0.6 },
    ], { a: "Nit" });
    expect(people.map((p) => p.name)).toEqual(["b", "Nit", NO_ONE]);
    expect(people[0]).toMatchObject({ asks: 5, chatBaht: 0.6, studioBaht: 3, baht: 3.6 });
    expect(people[1]).toMatchObject({ asks: 3, chatBaht: 0.4, studioBaht: 0 });
  });
});
