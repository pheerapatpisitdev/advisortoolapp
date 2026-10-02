import { describe, expect, it } from "vitest";
import { localize, postWithRetry, splitArgs } from "../../infra/lambda-ffmpeg/core.mjs";

describe("lambda core", () => {
  it("splits a command like a shell, keeping quoted filters whole", () => {
    expect(splitArgs(`-i a.mp4 -filter_complex "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]" -map "[b]" out.mp4`))
      .toEqual(["-i", "a.mp4", "-filter_complex", "[0:v]trim=start=1:end=2[v0];[v0]overlay=enable='between(t,0,1)'[b]", "-map", "[b]", "out.mp4"]);
  });
  it("puts local files where the placeholders were", () => {
    expect(localize("-i {{in_1}} -i {{in_2}} {{out_1}}", { in_1: "/tmp/in_1", in_2: "/tmp/in_2" }, { out_1: "/tmp/out_1.mp4" }))
      .toBe("-i /tmp/in_1 -i /tmp/in_2 /tmp/out_1.mp4");
  });
});

describe("postWithRetry", () => {
  const noSleep = async () => {};
  it("retries a 5xx and a network error, then succeeds", async () => {
    const answers = [() => ({ ok: false, status: 503 }), () => { throw new Error("ECONNRESET"); }, () => ({ ok: true, status: 200 })];
    const calls: number[] = [];
    await postWithRetry("https://app/cb", { id: "1" }, { fetchFn: (async () => { calls.push(1); return answers[calls.length - 1](); }) as never, sleep: noSleep });
    expect(calls).toHaveLength(3);
  });
  it("gives up after four attempts, naming the reason but not the url", async () => {
    const logs: string[] = [];
    let n = 0;
    await expect(postWithRetry("https://app/cb?secret", { id: "1" }, { fetchFn: (async () => { n++; return { ok: false, status: 500 }; }) as never, sleep: noSleep, log: (m: string) => logs.push(m) }))
      .rejects.toThrow("status 500");
    expect(n).toBe(4);
    expect(logs.join(" ")).not.toContain("secret");
  });
});
