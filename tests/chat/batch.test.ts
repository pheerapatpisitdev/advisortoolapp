import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  eachBySender, groupBySender, SEND_MARGIN_MS, TURN_MS, turnBudgetMs, WEBHOOK_LIMIT_MS,
} from "@/lib/chat/batch";

/**
 * A webhook's batch: different people answered side by side, one person's events in order,
 * and every turn's clock inside the function's own limit (review, 2026-10-01).
 */

describe("grouping a batch by who sent it", () => {
  it("keeps one sender's events together and in the order they came", () => {
    const events = [{ who: "a", n: 1 }, { who: "b", n: 2 }, { who: "a", n: 3 }, { who: undefined, n: 4 }, { who: "b", n: 5 }];
    expect(groupBySender(events, (e) => e.who).map((g) => g.map((e) => e.n))).toEqual([[1, 3], [2, 5], [4]]);
  });
});

describe("answering a batch", () => {
  it("does not let one stuck customer hold up the others", async () => {
    const done: string[] = [];
    let release!: () => void;
    const stuck = new Promise<void>((r) => { release = r; });
    const running = eachBySender(["slow", "fast"], (e) => e, async (e) => {
      if (e === "slow") await stuck;
      done.push(e);
    }, "test");
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toEqual(["fast"]);
    release();
    await running;
    expect(done).toEqual(["fast", "slow"]);
  });

  it("answers one customer's messages one at a time, in order", async () => {
    const log: string[] = [];
    await eachBySender([{ who: "a", n: 1 }, { who: "a", n: 2 }], (e) => e.who, async (e) => {
      log.push(`start ${e.n}`);
      await new Promise((r) => setTimeout(r, e.n === 1 ? 20 : 0));
      log.push(`end ${e.n}`);
    }, "test");
    expect(log).toEqual(["start 1", "end 1", "start 2", "end 2"]);
  });

  it("carries on past a failure, and says so in the log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: number[] = [];
    await eachBySender([1, 2], () => "same", async (n) => {
      if (n === 1) throw new Error("boom");
      seen.push(n);
    }, "test");
    expect(seen).toEqual([2]);
    expect(logged).toHaveBeenCalledWith("test event failed:", expect.any(Error));
    logged.mockRestore();
  });
});

describe("a turn's clock", () => {
  it("is the whole TURN_MS early in a batch, and with no batch at all", () => {
    expect(turnBudgetMs()).toBe(TURN_MS);
    expect(turnBudgetMs(1_000, 1_000)).toBe(TURN_MS);
  });

  it("shrinks so the apology still has its margin before the function's limit", () => {
    const startedAt = 0;
    const late = WEBHOOK_LIMIT_MS - SEND_MARGIN_MS - 10_000;
    expect(turnBudgetMs(startedAt, late)).toBe(10_000);
    expect(turnBudgetMs(startedAt, WEBHOOK_LIMIT_MS)).toBeLessThanOrEqual(0);
  });

  it("matches the maxDuration the webhook routes declare", () => {
    for (const file of ["src/app/api/facebook/webhook/route.ts", "src/app/api/line/webhook/route.ts"]) {
      const declared = /export const maxDuration = (\d+);/.exec(readFileSync(file, "utf8"))?.[1];
      expect(Number(declared) * 1000).toBe(WEBHOOK_LIMIT_MS);
    }
  });
});
