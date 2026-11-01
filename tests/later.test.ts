import { afterEach, describe, expect, it, vi } from "vitest";

const tails = vi.hoisted(() => ({ list: [] as (() => unknown)[] }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (f: () => unknown) => { tails.list.push(f); } }));

import { currentWho } from "@/lib/ai/who";
import { defineJob, openSealed, runLater, sealMessage } from "@/lib/later";
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
    expect(names).toEqual(["facebook-answers", "line-answers", "clip-produce", "clip-redraw", "later-ping"]);
    for (const n of names) expect(laterJob(n)?.name).toBe(n);
    expect(laterJob("nope")).toBeUndefined();
  });
});

describe("a queue message's seal", () => {
  const message = { job: "clip-produce", payload: { id: "v1", agentName: "ก" }, agentId: "a1" };
  afterEach(() => vi.unstubAllEnvs());

  it("opens for the message runLater sealed, within the hour", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "s");
    const sealed = JSON.parse(JSON.stringify(sealMessage(message, 1_000_000)));
    expect(openSealed(sealed, 1_000_000 + 59 * 60_000)).toEqual(message);
    expect(openSealed(sealed, 1_000_000 + 61 * 60_000)).toBeNull();
  });

  it("does not open for a changed message, another secret or nothing at all", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "s");
    const sealed = sealMessage(message, 5);
    expect(openSealed({ ...sealed, message: { ...message, agentId: "a2" } }, 5)).toBeNull();
    expect(openSealed({ ...sealed, sig: sealed.sig.replace(/.$/, (c) => (c === "0" ? "1" : "0")) }, 5)).toBeNull();
    expect(openSealed(null, 5)).toBeNull();
    vi.stubEnv("ADMIN_SESSION_SECRET", "other");
    expect(openSealed(sealed, 5)).toBeNull();
  });
});
