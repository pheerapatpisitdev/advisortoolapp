import { describe, expect, it } from "vitest";
import { cleanTurns, runBotTest, type Turn } from "@/lib/chat/bot-tests";
import { answerAny } from "@/lib/assistant/dispatch";

/** ชุดเทส (/admin/teach, owner 2026-10-11): saved conversations replayed against the bot. */

const echo: Turn = async (history) => ({
  messages: [{ text: `ได้รับ: ${history.at(-1)!.content}` }],
  replies: ["สนใจสมัคร"],
  slots: { product: "undecided" } as never,
});

describe("replaying a saved conversation", () => {
  it("passes when every answer has what it should and nothing it should not", async () => {
    const run = await runBotTest([
      { say: "สวัสดี", contains: ["ได้รับ"], not: ["iShield"] },
      { say: "ช 47", contains: ["สนใจสมัคร"], not: [] },
    ], echo);
    expect(run.ok).toBe(true);
    expect(run.turns.map((t) => t.ok)).toEqual([true, true]);
  });

  it("names the words that were missing and the ones that should not be there", async () => {
    const run = await runBotTest([{ say: "iShield", contains: ["Life Protect"], not: ["ishield"] }], echo);
    expect(run.ok).toBe(false);
    expect(run.turns[0]).toMatchObject({ missing: ["Life Protect"], unwanted: ["ishield"] });
  });

  it("hands each turn the conversation so far and the slots the last one left", async () => {
    const seen: number[] = [];
    const counting: Turn = async (history, slots) => {
      seen.push(history.length);
      return { messages: [{ text: "ok" }], slots: { product: "undecided", n: ((slots as { n?: number } | null)?.n ?? 0) + 1 } as never };
    };
    await runBotTest([{ say: "a", contains: [], not: [] }, { say: "b", contains: [], not: [] }], counting);
    expect(seen).toEqual([1, 3]);
  });

  it("stops at a turn that fails, and says which", async () => {
    const broken: Turn = async () => { throw new Error("model down"); };
    const run = await runBotTest([{ say: "a", contains: [], not: [] }], broken);
    expect(run.ok).toBe(false);
    expect(run.error).toContain("model down");
  });

  it("fails an answer that says nothing", async () => {
    const silent: Turn = async () => ({ messages: [], slots: { product: "undecided" } as never });
    expect((await runBotTest([{ say: "a", contains: [], not: [] }], silent)).ok).toBe(false);
  });

  it("replays the real bot: an iShield saving asks for sex and age", async () => {
    const real: Turn = (history, slots) => answerAny(history, slots, "facebook", undefined, "105982528649026");
    const run = await runBotTest([{ say: "ออม+ประกันโรคร้าย เดือนละ 2,000 บาท", contains: ["2,000", "เพศ"], not: [] }], real);
    expect(run.ok).toBe(true);
  });
});

describe("a test's turns as stored", () => {
  it("keeps what was said and the checks, and drops empty or broken entries", () => {
    expect(cleanTurns([{ say: " ช 47 ", contains: ["Life", ""], not: "x" }, { say: "" }, null, "x"]))
      .toEqual([{ say: "ช 47", contains: ["Life"], not: [] }]);
    expect(cleanTurns("nope")).toEqual([]);
  });
});
