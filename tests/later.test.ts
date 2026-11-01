import { afterEach, describe, expect, it, vi } from "vitest";

const tails = vi.hoisted(() => ({ list: [] as (() => unknown)[] }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (f: () => unknown) => { tails.list.push(f); } }));

import { currentWho } from "@/lib/ai/who";
import { defineJob, runLater } from "@/lib/later";
import { LATER_JOBS, laterJob } from "@/lib/later-jobs";

/** Work after the answer (src/lib/later.ts): data in, as a queue would carry it. */

afterEach(() => {
  tails.list = [];
  vi.restoreAllMocks();
});

describe("runLater", () => {
  it("hands the job its payload after JSON, as a queue message would be", async () => {
    const seen: unknown[] = [];
    const job = defineJob<{ at: Date; n: number; gone?: () => void }>("t", async (p) => { seen.push(p); });
    runLater(job, { at: new Date("2026-11-02T00:00:00Z"), n: 1, gone: () => {} });
    expect(seen).toEqual([]);
    await tails.list[0]();
    expect(seen).toEqual([{ at: "2026-11-02T00:00:00.000Z", n: 1 }]);
  });

  it("runs as the member it was started for", async () => {
    let who: string | undefined;
    runLater(defineJob("w", async () => { who = currentWho()?.agentId; }), {}, { agentId: "a1" });
    await tails.list[0]();
    expect(who).toBe("a1");
  });

  it("logs a failed job rather than throwing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    runLater(defineJob("boom", async () => { throw new Error("x"); }), {});
    await expect(tails.list[0]()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith("later: boom failed:", "x");
  });
});

describe("the job list a queue consumer reads", () => {
  it("names every job once", () => {
    const names = LATER_JOBS.map((j) => j.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(["facebook-answers", "line-answers", "clip-produce", "clip-redraw"]);
    for (const n of names) expect(laterJob(n)?.name).toBe(n);
    expect(laterJob("nope")).toBeUndefined();
  });
});
